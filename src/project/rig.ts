import type { CharacterLook, Easing, Grade, MotionId, RigClip } from "../types";

/* ---------- Skeleton ---------- */

export interface Joint {
  id: string;
  name: string;
  x: number; // rig space 0-400
  y: number; // rig space 0-500
  parent?: string;
  color: string;
}

export const RIG_W = 400;
export const RIG_H = 500;
/** The rig's feet rest at this y; casting anchors here. */
export const RIG_FLOOR = 470;

export const INITIAL_JOINTS: Joint[] = [
  { id: "pelvis", name: "Pelvis", x: 200, y: 260, color: "#ef4444" },
  { id: "spine", name: "Spine", x: 200, y: 210, parent: "pelvis", color: "#3b82f6" },
  { id: "neck", name: "Neck", x: 200, y: 140, parent: "spine", color: "#3b82f6" },
  { id: "head", name: "Head", x: 200, y: 90, parent: "neck", color: "#ec4899" },
  { id: "l_shoulder", name: "L shoulder", x: 150, y: 150, parent: "neck", color: "#10b981" },
  { id: "l_elbow", name: "L elbow", x: 100, y: 150, parent: "l_shoulder", color: "#10b981" },
  { id: "l_hand", name: "L hand", x: 50, y: 150, parent: "l_elbow", color: "#10b981" },
  { id: "r_shoulder", name: "R shoulder", x: 250, y: 150, parent: "neck", color: "#8b5cf6" },
  { id: "r_elbow", name: "R elbow", x: 300, y: 150, parent: "r_shoulder", color: "#8b5cf6" },
  { id: "r_hand", name: "R hand", x: 350, y: 150, parent: "r_elbow", color: "#8b5cf6" },
  { id: "l_hip", name: "L hip", x: 160, y: 270, parent: "pelvis", color: "#eab308" },
  { id: "l_knee", name: "L knee", x: 160, y: 370, parent: "l_hip", color: "#eab308" },
  { id: "l_ankle", name: "L ankle", x: 160, y: 460, parent: "l_knee", color: "#eab308" },
  { id: "r_hip", name: "R hip", x: 240, y: 270, parent: "pelvis", color: "#f97316" },
  { id: "r_knee", name: "R knee", x: 240, y: 370, parent: "r_hip", color: "#f97316" },
  { id: "r_ankle", name: "R ankle", x: 240, y: 460, parent: "r_knee", color: "#f97316" },
];

/** A relaxed standing pose: arms down, used as the default for new clips. */
export const STANDING_POSE: Record<string, { x: number; y: number }> = {
  ...Object.fromEntries(INITIAL_JOINTS.map((j) => [j.id, { x: j.x, y: j.y }])),
  l_elbow: { x: 135, y: 215 },
  l_hand: { x: 128, y: 278 },
  r_elbow: { x: 265, y: 215 },
  r_hand: { x: 272, y: 278 },
};

export type Pose = Record<string, { x: number; y: number }>;

export const MOTION_PRESETS: { id: MotionId; name: string; description: string }[] = [
  { id: "idle", name: "Breathing", description: "Subtle chest expansion and arm sway" },
  { id: "run", name: "Run cycle", description: "Rhythmic running stride" },
  { id: "float", name: "Zero-G float", description: "Weightless drift" },
  { id: "strike", name: "Lunge", description: "Coil back, then a sweeping strike" },
  { id: "wave", name: "Ripple", description: "A wave rolling through the body" },
];

/** Offset for one joint at motion time t (same maths the rig preview uses). */
export function motionOffset(motion: MotionId, id: string, base: { x: number; y: number }, t: number, i: number) {
  let dx = 0;
  let dy = 0;
  if (motion === "idle") {
    if (id === "spine" || id === "neck" || id === "head") {
      dx = Math.sin(t) * 4 * i;
      dy = Math.cos(t * 2) * 2 * i;
    } else if (id.startsWith("l_")) {
      dx = Math.sin(t) * 6 * i;
      dy = Math.cos(t) * 3 * i;
    } else if (id.startsWith("r_")) {
      dx = -Math.sin(t) * 6 * i;
      dy = Math.cos(t) * 3 * i;
    }
  } else if (motion === "run") {
    if (id === "pelvis") {
      dy = Math.sin(t * 2) * 8 * i;
      dx = Math.cos(t) * 3 * i;
    } else if (id === "head" || id === "neck") {
      dy = Math.sin(t * 2) * 4 * i;
    } else if (id === "l_elbow" || id === "l_hand") {
      dx = Math.sin(t) * 35 * i;
      dy = Math.cos(t) * 15 * i;
    } else if (id === "r_elbow" || id === "r_hand") {
      dx = -Math.sin(t) * 35 * i;
      dy = -Math.cos(t) * 15 * i;
    } else if (id === "l_knee") {
      dx = Math.sin(t) * 30 * i;
      dy = Math.max(0, Math.cos(t) * 25) * i;
    } else if (id === "r_knee") {
      dx = -Math.sin(t) * 30 * i;
      dy = Math.max(0, -Math.cos(t) * 25) * i;
    } else if (id === "l_ankle") {
      dx = Math.sin(t) * 35 * i;
      dy = Math.sin(t + 0.5) * 30 * i;
    } else if (id === "r_ankle") {
      dx = -Math.sin(t) * 35 * i;
      dy = -Math.sin(t + 0.5) * 30 * i;
    }
  } else if (motion === "float") {
    dx = Math.sin(t + base.y * 0.01) * 15 * i;
    dy = Math.cos(t * 0.7 + base.x * 0.01) * 15 * i;
  } else if (motion === "strike") {
    const phase = t % (Math.PI * 2);
    if (phase < Math.PI) {
      if (id === "pelvis" || id === "spine") {
        dx = -15 * i;
        dy = 10 * i;
      } else if (id.includes("hand")) {
        dx = -40 * i;
        dy = -10 * i;
      }
    } else {
      const s = (phase - Math.PI) * 2;
      if (id.includes("hand") || id.includes("elbow")) {
        dx = (Math.sin(s) * 80 - 10) * i;
        dy = (Math.cos(s) * 40 + 20) * i;
      } else if (id === "pelvis" || id === "spine") {
        dx = 25 * i;
      }
    }
  } else if (motion === "wave") {
    const offset = (base.x / RIG_W) * Math.PI * 2;
    dy = Math.sin(t * 1.5 + offset) * 15 * i;
    dx = Math.cos(t * 1.5 + offset) * 5 * i;
  }
  return { dx, dy };
}

/** Motion clock: the rig preview advanced 0.05 * speed per frame at ~60 fps. */
export const motionTime = (seconds: number, speed: number) => seconds * 3 * speed;

export const EASINGS: { id: Easing; label: string; hint: string }[] = [
  { id: "smooth", label: "Smooth", hint: "Eases out of one key and into the next" },
  { id: "linear", label: "Linear", hint: "Constant speed" },
  { id: "in", label: "Ease in", hint: "Starts slow, arrives fast" },
  { id: "out", label: "Ease out", hint: "Starts fast, settles in" },
  { id: "back", label: "Overshoot", hint: "Swings past the next pose and settles back" },
  { id: "bounce", label: "Bounce", hint: "Lands and bounces into the next pose" },
  { id: "hold", label: "Hold", hint: "Holds still, then snaps to the next pose" },
];

/** Shape an interpolation fraction 0-1. */
export function ease(kind: Easing, k: number): number {
  const p = Math.max(0, Math.min(1, k));
  switch (kind) {
    case "hold":
      return 0;
    case "linear":
      return p;
    case "in":
      return p * p * p;
    case "out":
      return 1 - Math.pow(1 - p, 3);
    case "back": {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
    }
    case "bounce": {
      const n = 7.5625;
      const d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p - 1.5 / d) ** 2 + 0.75;
      if (p < 2.5 / d) return n * (p - 2.25 / d) ** 2 + 0.9375;
      return n * (p - 2.625 / d) ** 2 + 0.984375;
    }
    default:
      return p * p * (3 - 2 * p);
  }
}

/** Key times for a clip (older clips space keys evenly). */
export function keyTimesOf(clip: Pick<RigClip, "keyframes" | "keyframeSeconds" | "keyTimes">): number[] {
  if (clip.keyTimes && clip.keyTimes.length === clip.keyframes.length) return clip.keyTimes;
  const span = Math.max(0.05, clip.keyframeSeconds);
  return clip.keyframes.map((_, i) => i * span);
}

/** Loop length of a clip's keyframes, seconds. */
export function clipLength(clip: Pick<RigClip, "keyframes" | "keyframeSeconds" | "keyTimes" | "length">): number {
  const times = keyTimesOf(clip);
  const last = times.length ? times[times.length - 1] : 0;
  return Math.max(last + 0.05, clip.length ?? last + Math.max(0.05, clip.keyframeSeconds));
}

/** Interpolated keyframe pose at `seconds` (looping), or null without keys. */
export function keyedPose(clip: RigClip, seconds: number): Pose | null {
  const frames = clip.keyframes;
  if (!frames.length) return null;
  if (frames.length === 1) return { ...clip.pose, ...frames[0] };
  const times = keyTimesOf(clip);
  const length = clipLength(clip);
  const t = ((seconds % length) + length) % length;
  // The key at or before t; before the first key we're still travelling from the last one
  let k = frames.length - 1;
  for (let i = 0; i < times.length; i++) if (times[i] <= t) k = i;
  const next = (k + 1) % frames.length;
  const from = times[k] > t ? times[k] - length : times[k];
  const to = next === 0 ? times[0] + length : times[next];
  const span = Math.max(1e-6, to - from);
  const e = ease(clip.keyEasing?.[k] ?? "smooth", (t - from) / span);
  const a = frames[k];
  const b = frames[next];
  return Object.fromEntries(
    Object.keys(clip.pose).map((id) => {
      const pa = a[id] ?? clip.pose[id];
      const pb = b[id] ?? clip.pose[id];
      return [id, { x: pa.x + (pb.x - pa.x) * e, y: pa.y + (pb.y - pa.y) * e }];
    }),
  );
}

/** Pose of a clip at `seconds`: keyframes (if any) interpolated, plus the procedural motion. */
export function poseAt(clip: RigClip, seconds: number): Pose {
  const base: Pose = keyedPose(clip, seconds) ?? clip.pose;
  if (!clip.motion) return base;
  const t = motionTime(seconds, clip.speed);
  const motion = clip.motion;
  return Object.fromEntries(
    Object.entries(base).map(([id, p]) => {
      const { dx, dy } = motionOffset(motion, id, p, t, clip.intensity);
      return [id, { x: p.x + dx, y: p.y + dy }];
    }),
  );
}

/** Each joint's children, for moving a limb as one piece. */
export const CHILDREN: Record<string, string[]> = INITIAL_JOINTS.reduce<Record<string, string[]>>((acc, j) => {
  if (j.parent) (acc[j.parent] ??= []).push(j.id);
  return acc;
}, {});

export function descendants(id: string): string[] {
  const out: string[] = [];
  const walk = (j: string) => (CHILDREN[j] ?? []).forEach((c) => {
    out.push(c);
    walk(c);
  });
  walk(id);
  return out;
}

/* ---------- Defaults ---------- */

export const DEFAULT_CHARACTER: CharacterLook = {
  id: "char_default",
  name: "Lead",
  skin: "#d1dbed",
  hair: "#1d1b2e",
  eyes: "#ff0055",
  costume: "#2a2f45",
  accent: "#ffb224",
  hairStyle: "sleek",
};

export const DEFAULT_CLIP: RigClip = {
  id: "clip_default",
  name: "Breathing",
  pose: STANDING_POSE,
  motion: "idle",
  speed: 1,
  intensity: 1,
  keyframes: [],
  keyframeSeconds: 0.8,
};

export const GRADE_PRESETS: Record<Grade["preset"], Grade> = {
  none: { preset: "none", contrast: 100, saturation: 100, vignette: 35, tint: "#000000", tintAmount: 0 },
  "teal-orange": { preset: "teal-orange", contrast: 112, saturation: 120, vignette: 40, tint: "#ff8a3d", tintAmount: 10 },
  noir: { preset: "noir", contrast: 135, saturation: 0, vignette: 60, tint: "#000000", tintAmount: 0 },
  violet: { preset: "violet", contrast: 110, saturation: 125, vignette: 45, tint: "#7b3fe4", tintAmount: 14 },
  gold: { preset: "gold", contrast: 108, saturation: 110, vignette: 40, tint: "#ffb224", tintAmount: 12 },
  vivid: { preset: "vivid", contrast: 115, saturation: 150, vignette: 30, tint: "#000000", tintAmount: 0 },
};
