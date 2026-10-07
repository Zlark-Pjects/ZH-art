import type { CharacterLook, ElementSpec, Grade, RigClip, Scene } from "../../types";
import { RIG_FLOOR, ease } from "../../project/rig";
import type { DrawOp } from "../../project/forge/figure";
import { drawClip } from "../../project/forge/plans";

/**
 * Pure description of one frame of a storyboard scene, shared by the live SVG
 * stage and the canvas exporter so both draw exactly the same picture.
 * Coordinates use a 1600 x 900 frame.
 */
export const FRAME_W = 1600;
export const FRAME_H = 900;

export const SHAPES: Record<ElementSpec["shape"], { d: string; stroked: boolean }> = {
  circle: { d: "M50 10a40 40 0 1 0 0.01 0Z", stroked: false },
  ring: { d: "M50 14a36 36 0 1 0 0.01 0Z", stroked: true },
  star: { d: "M50 12 L61.5 37 L89 39.5 L68 57.5 L74.5 85 L50 70.5 L25.5 85 L32 57.5 L11 39.5 L38.5 37 Z", stroked: false },
  polygon: { d: "M50 13 L88 79 L12 79 Z", stroked: false },
  rect: { d: "M16 16H84V84H16Z", stroked: false },
  line: { d: "M6 50H94", stroked: true },
  spline: { d: "M6 50 Q28 14 50 50 T94 50", stroked: true },
};

const DEPTHS = {
  1: { camera: 0.4, zoom: 0.96, opacity: 0.2, stroke: 4, audio: "bass" },
  2: { camera: 0.8, zoom: 1.05, opacity: 1, stroke: 5, audio: "mid" },
  3: { camera: 1.3, zoom: 1.15, opacity: 1, stroke: 7, audio: "treble" },
} as const;

export interface Levels {
  bass: number;
  mid: number;
  treble: number;
}

export interface FrameItem {
  /** Index of the source element in scene.elements */
  index: number;
  d: string;
  stroked: boolean;
  strokeWidth: number;
  color: string;
  opacity: number;
  /** SVG transform inside the 1600x900 frame */
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export interface FrameLayer {
  zoom: number;
  dx: number;
  dy: number;
  items: FrameItem[];
}

export interface FrameParticle {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

export interface Frame {
  gradient: string[];
  layers: FrameLayer[];
  particles: FrameParticle[];
  particleColor: string;
  particleOpacity: number;
}

// Deterministic PRNG so particles keep their positions between renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLE_DRIFT: Record<string, { vx: number; vy: number; wobble: number }> = {
  rain: { vx: -0.6, vy: 9, wobble: 0 },
  snow: { vx: 0.2, vy: 1.4, wobble: 1.2 },
  "cherry-blossoms": { vx: 1, vy: 1.8, wobble: 2 },
  sparks: { vx: 0.3, vy: -2.4, wobble: 0.8 },
  bubbles: { vx: 0, vy: -1.6, wobble: 1.4 },
  stars: { vx: 0.15, vy: 0, wobble: 0.3 },
  "dust-motes": { vx: 0.4, vy: -0.3, wobble: 1 },
};

const seedCache = new Map<string, { x: number; y: number; r: number; phase: number }[]>();

function particleSeeds(scene: Scene) {
  const count = Math.min(48, Math.max(0, scene.particles?.count ?? 0));
  const key = `${scene.sceneNumber}:${count}:${scene.title}`;
  let seeds = seedCache.get(key);
  if (!seeds) {
    const rand = mulberry32(scene.sceneNumber * 9973 + count);
    seeds = Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: 0.6 + rand(),
      phase: rand() * Math.PI * 2,
    }));
    if (seedCache.size > 64) seedCache.clear();
    seedCache.set(key, seeds);
  }
  return seeds;
}

const wrap = (v: number) => ((v % 100) + 100) % 100;

/** Build the frame for `scene` at `t` seconds into the scene. */
/** Where the camera is at `t` seconds into a scene: its keys if it has any, else the preset move. */
export function cameraAt(scene: Scene, t: number): { zoom: number; x: number; y: number } {
  const keys = scene.cameraKeys;
  if (keys?.length) {
    const sorted = [...keys].sort((a, b) => a.t - b.t);
    if (t <= sorted[0].t) return sorted[0];
    const last = sorted[sorted.length - 1];
    if (t >= last.t) return last;
    let k = 0;
    while (k < sorted.length - 2 && sorted[k + 1].t <= t) k++;
    const a = sorted[k];
    const b = sorted[k + 1];
    const e = ease(a.easing, (t - a.t) / Math.max(1e-6, b.t - a.t));
    return { zoom: a.zoom + (b.zoom - a.zoom) * e, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }
  const m = scene.cameraMotion;
  const p = scene.duration > 0 ? Math.min(1, Math.max(0, t / scene.duration)) : 0;
  // Ease the camera so moves start and land softly
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return { zoom: m.scaleStart + (m.scaleEnd - m.scaleStart) * e, x: m.xStart + (m.xEnd - m.xStart) * e, y: m.yStart + (m.yEnd - m.yStart) * e };
}

export function computeFrame(scene: Scene, t: number, levels: Levels): Frame {
  const cam = cameraAt(scene, t);
  const zoom = cam.zoom;
  const cx = cam.x * 2;
  const cy = cam.y * 2;

  const layers: FrameLayer[] = ([1, 2, 3] as const).map((depth) => {
    const cfg = DEPTHS[depth];
    const audioBoost = levels[cfg.audio] * (depth === 1 ? 0.15 : depth === 2 ? 0.2 : 0.25);
    const items = scene.elements
      .map((el, index) => ({ el, index }))
      .filter(({ el }) => (el.depth || 2) === depth)
      .map(({ el, index }, i): FrameItem => {
        const shape = SHAPES[el.shape] ?? SHAPES.circle;
        const phase = i * 1.7 + depth;
        let rotate = 0;
        let wobble = 0;
        let pulse = 1;
        let glide = 0;
        if (el.movement === "rotate") rotate = (t * 18 + i * 40) % 360;
        if (el.movement === "float") wobble = Math.sin(t * 1.1 + phase) * 14;
        if (el.movement === "pulse") pulse = 1 + Math.sin(t * 2.4 + phase) * 0.06;
        if (el.movement === "glide") glide = Math.sin(t * 0.5 + phase) * 30;
        const size = (Math.max(10, el.size) / 900) * FRAME_W;
        return {
          index,
          d: shape.d,
          stroked: shape.stroked,
          strokeWidth: cfg.stroke,
          color: el.color,
          opacity: cfg.opacity,
          x: (el.position.x / 100) * FRAME_W + glide,
          y: (el.position.y / 100) * FRAME_H + wobble,
          rotate,
          scale: (size / 100) * pulse * (1 + audioBoost),
        };
      });
    return { zoom: zoom * cfg.zoom, dx: cx * cfg.camera, dy: cy * cfg.camera, items };
  });

  const ptype = scene.particles?.type ?? "none";
  const drift = PARTICLE_DRIFT[ptype] ?? PARTICLE_DRIFT["dust-motes"];
  const speed = Math.max(0.3, Math.min(3, scene.particles?.speed ?? 1));
  const baseSize = Math.max(1, Math.min(6, scene.particles?.size ?? 2.5));
  const particles: FrameParticle[] =
    ptype === "none"
      ? []
      : particleSeeds(scene).map((s) => ({
          x: (wrap(s.x + drift.vx * speed * t + Math.sin(t + s.phase) * drift.wobble) / 100) * FRAME_W,
          y: (wrap(s.y + drift.vy * speed * t + Math.cos(t * 0.8 + s.phase) * drift.wobble) / 100) * FRAME_H,
          r: baseSize * s.r * 1.6,
          alpha: ptype === "stars" ? 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + s.phase)) : 0.85,
        }));

  return {
    gradient: scene.gradientColors?.length ? scene.gradientColors : [scene.backgroundColor, scene.backgroundColor],
    layers,
    particles,
    particleColor: scene.particles?.color || "#ffffff",
    particleOpacity: 0.55 + levels.treble * 0.45,
  };
}

export function layerTransform(layer: FrameLayer) {
  return `translate(${FRAME_W / 2 + layer.dx} ${FRAME_H / 2 + layer.dy}) scale(${layer.zoom}) translate(${-FRAME_W / 2} ${-FRAME_H / 2})`;
}

export function itemTransform(item: FrameItem) {
  return `translate(${item.x} ${item.y}) rotate(${item.rotate}) scale(${item.scale}) translate(-50 -50)`;
}

/* ---------- Cast characters ---------- */

export interface PlacedFigure {
  /** SVG transform from rig space (400x500) into the 1600x900 frame */
  transform: string;
  /** Same placement as numbers, for canvas */
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  ops: DrawOp[];
}

/** Figures for every cast member of the scene, posed at time t. */
export function castFigures(scene: Scene, t: number, characters: CharacterLook[], clips: RigClip[]): PlacedFigure[] {
  if (!scene.cast?.length) return [];
  const out: PlacedFigure[] = [];
  for (const member of scene.cast) {
    const look = characters.find((c) => c.id === member.characterId);
    const clip = clips.find((c) => c.id === member.clipId);
    if (!look || !clip) continue;
    // Bipeds perform the rig clip; other body plans play the matching game animation
    const ops = drawClip(look, clip, t);
    const x = (member.x / 100) * FRAME_W;
    const y = (member.y / 100) * FRAME_H;
    // Rig height from head top (~50) to feet maps to `scale` of the frame height
    const scale = (Math.max(0.1, member.scale) * FRAME_H) / (RIG_FLOOR - 50);
    const flip = Boolean(member.flip);
    out.push({
      transform: `translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale}) translate(-200 ${-RIG_FLOOR})`,
      x,
      y,
      scale,
      flip,
      ops,
    });
  }
  return out;
}

/* ---------- Grade ---------- */

export function gradeFilter(grade: Grade) {
  return `contrast(${grade.contrast}%) saturate(${grade.saturation}%)`;
}
