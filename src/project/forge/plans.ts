import type { BodyPlan, CharacterLook, RigClip } from "../../types";
import { mix } from "../builder";
import { STANDING_POSE, poseAt, type Pose } from "../rig";
import { add, circle, drawBack, drawHead, drawTail, ellipse, f, FLOOR, line, makeKit, poly, taper, TAU, type DrawOp, type Kit, type P } from "./draw";
import { buildFigure, buildOf, drawArm, drawLeg } from "./figure";

/*
 * Body plans and game animation states. Every plan draws the same parts
 * (head, eyes, hair, headgear, back, tail, palette, proportions) on its own
 * skeleton. Animations are functions of the state's phase, so each loop is
 * seamless — which is what sprite sheets need.
 */

export type GameState = "idle" | "walk" | "run" | "jump" | "attack";

export const GAME_STATES: { id: GameState; label: string; seconds: number }[] = [
  { id: "idle", label: "Idle", seconds: 2.1 },
  { id: "walk", label: "Walk", seconds: 1.0 },
  { id: "run", label: "Run", seconds: 0.6 },
  { id: "jump", label: "Jump", seconds: 0.9 },
  { id: "attack", label: "Attack", seconds: 0.8 },
];

export const stateSeconds = (s: GameState) => GAME_STATES.find((g) => g.id === s)?.seconds ?? 1;

export const BODY_PLANS: { id: BodyPlan; label: string; hint: string }[] = [
  { id: "biped", label: "Two legs", hint: "Stands upright, front view; uses Motion clips in films" },
  { id: "quadruped", label: "Four legs", hint: "Side view; legs follow the leg style, six with spider legs" },
  { id: "flyer", label: "Flyer", hint: "Side view; always winged, hovers and swoops" },
  { id: "serpent", label: "Serpent", hint: "Side view; a long body that slithers, legs make it a centipede" },
  { id: "floater", label: "Floater", hint: "Drifts above the ground with trailing tendrils" },
];

export const planOf = (look: CharacterLook): BodyPlan => buildOf(look).plan ?? "biped";

/** Which game state a Motion clip reads as, for characters that aren't bipeds. */
export function stateForClip(clip: RigClip): GameState {
  if (clip.motion === "run") return clip.intensity < 0.6 ? "walk" : "run";
  if (clip.motion === "strike") return "attack";
  if (clip.motion === "wave") return "walk";
  return "idle";
}

/** Draw a character in a game state at time t (seconds). `loop` makes secondary motion repeat exactly. */
export function drawCharacter(look: CharacterLook, state: GameState, t: number, loop = false): DrawOp[] {
  const build = buildOf(look);
  const seconds = stateSeconds(state);
  const plan = build.plan ?? "biped";
  if (plan === "biped") return buildFigure(bipedPose(state, t), look, t, loop ? seconds : undefined);
  const k = makeKit(build, t, loop ? seconds : undefined);
  const phase = (TAU * t) / seconds;
  if (plan === "quadruped") quadruped(k, state, phase);
  else if (plan === "flyer") flyer(k, state, phase);
  else if (plan === "serpent") serpent(k, state, phase);
  else floater(k, state, phase);
  return k.ops;
}

/* ---------- Biped ---------- */

const BIPED_MOTION: Record<Exclude<GameState, "jump">, { motion: RigClip["motion"]; intensity: number }> = {
  idle: { motion: "idle", intensity: 1 },
  walk: { motion: "run", intensity: 0.45 },
  run: { motion: "run", intensity: 1 },
  attack: { motion: "strike", intensity: 1 },
};

export function bipedPose(state: GameState, t: number): Pose {
  const seconds = stateSeconds(state);
  if (state !== "jump") {
    const m = BIPED_MOTION[state];
    // One full motion cycle per state duration (the rig advances 3 * speed rad/s)
    const clip: RigClip = { id: "state", name: state, pose: STANDING_POSE, motion: m.motion, speed: TAU / (3 * seconds), intensity: m.intensity, keyframes: [], keyframeSeconds: 1 };
    return poseAt(clip, t);
  }
  const phase = (TAU * t) / seconds;
  const air = Math.max(0, Math.sin(phase));
  const crouch = Math.max(0, -Math.sin(phase));
  const out: Pose = {};
  for (const [id, p] of Object.entries(STANDING_POSE)) {
    let { x, y } = p;
    const lower = id.includes("knee") || id.includes("ankle");
    if (!lower) y += crouch * 22;
    if (id.includes("knee")) {
      y += crouch * 10 - air * 30;
      x += (id.startsWith("l_") ? -1 : 1) * (crouch * 12 + air * 10);
    }
    if (id.includes("ankle")) y -= air * 55;
    if (id.includes("elbow")) y -= air * 40;
    if (id.includes("hand")) y -= air * 95;
    out[id] = { x, y: y - air * 80 };
  }
  return out;
}

/* ---------- Four legs (side view, facing right) ---------- */

function quadruped(k: Kit, state: GameState, phase: number) {
  const { ops, c, p, b, osc } = k;
  const L = 140 * p.legs;
  const BL = 200 * p.shoulders;
  const BH = 66 * b;
  let stride = 0;
  let lift = 0;
  let bob = Math.sin(phase) * 3;
  let rise = 0;
  let tuck = 0;
  let crouch = 0;
  let lunge = 0;
  let gallop = false;
  if (state === "walk") {
    stride = 30;
    lift = 16;
    bob = -Math.abs(Math.sin(phase)) * 4;
  } else if (state === "run") {
    stride = 56;
    lift = 30;
    bob = Math.sin(phase * 2) * 8;
    gallop = true;
  } else if (state === "jump") {
    rise = Math.max(0, Math.sin(phase)) * 110;
    tuck = Math.max(0, Math.sin(phase));
    crouch = Math.max(0, -Math.sin(phase)) * 16;
  } else if (state === "attack") {
    lunge = Math.pow(Math.max(0, Math.sin(phase)), 2) * 40;
  }
  const C = { x: 200 + lunge, y: FLOOR - L - BH * 0.3 + bob - rise + crouch };
  const hipY = C.y + BH * 0.2;

  const offsets = gallop ? { nf: 0, ff: 0.6, nb: Math.PI, fb: Math.PI + 0.6 } : { nf: 0, ff: Math.PI, nb: Math.PI, fb: 0 };
  const leg = (rootX: number, off: number, front: boolean, far: boolean) => {
    const root = { x: rootX + (far ? -8 : 0), y: hipY };
    let foot: P;
    if (state === "jump") {
      foot = { x: root.x + (front ? 18 : -18) * tuck, y: root.y + L * (1 - 0.5 * tuck) };
    } else {
      const a = phase * (state === "run" ? 1 : 1) + off;
      foot = { x: root.x + Math.sin(a) * stride - (state === "attack" ? lunge * (front ? -0.2 : 0.6) : 0), y: Math.min(root.y + L, FLOOR - Math.max(0, Math.cos(a)) * lift) };
    }
    const bend = front ? 12 : -16;
    const knee = { x: (root.x + foot.x) / 2 + bend, y: (root.y + foot.y) / 2 };
    drawLeg(k, root, knee, foot, front ? 1 : -1, far ? 0.6 : undefined);
  };
  const legRoots = k.parts.legs === "arachnid" ? [0.36, 0.05, -0.3] : [0.33, -0.33];

  drawBack(k, { x: C.x + BL * 0.08, y: C.y - BH * 0.5 }, { span: 0.9, flapAmp: state === "run" ? 14 : 8, trail: -1 });
  drawTail(k, { x: C.x - BL * 0.48, y: C.y - BH * 0.1 }, -1, 0.9);
  legRoots.forEach((r, i) => leg(C.x + BL * r, i % 2 === 0 ? offsetsFor(offsets, true, true) : offsetsFor(offsets, false, true), r > 0, true));

  // Body
  const rx = BL * 0.55;
  switch (k.parts.torso) {
    case "core":
      ops.push(line({ x: C.x - rx, y: C.y }, { x: C.x + rx, y: C.y - 8 }, 12 * b, c.secondary));
      for (let i = -2; i <= 2; i++) ops.push({ t: "path", d: `M${f(C.x + i * rx * 0.3)} ${f(C.y - 4)}q12 ${f(BH * 0.5)} 0 ${f(BH * 0.8)}`, stroke: c.secondary, sw: 5, fill: "none" });
      ops.push({ t: "path", d: circle(C.x, C.y + BH * 0.15, 24 * b), fill: c.glow, opacity: 0.9 });
      break;
    default: {
      const ry = BH * 0.5 * (k.parts.torso === "round" ? 1.35 : k.parts.torso === "broad" ? 1.18 : 1);
      ops.push({ t: "path", d: ellipse(C.x, C.y, rx, ry), fill: c.primary });
      ops.push({ t: "path", d: ellipse(C.x + 6, C.y + ry * 0.4, rx * 0.7, ry * 0.45), fill: mix(c.primary, "#ffffff", 0.2) });
      if (k.parts.torso === "broad") ops.push({ t: "path", d: ellipse(C.x + rx * 0.45, C.y - ry * 0.35, rx * 0.4, ry * 0.65), fill: c.primary });
      if (k.parts.torso === "armored") {
        for (let i = -1; i <= 1; i++) ops.push({ t: "path", d: ellipse(C.x + i * rx * 0.55, C.y - ry * 0.55, rx * 0.3, ry * 0.32), fill: k.metal });
        ops.push({ t: "path", d: circle(C.x, C.y - ry * 0.55, 6 * b), fill: c.accent });
      }
      if (k.parts.torso === "robe") {
        ops.push({ t: "path", d: `M${f(C.x - rx * 0.75)} ${f(C.y - ry * 0.7)}H${f(C.x + rx * 0.6)}L${f(C.x + rx * 0.7)} ${f(C.y + ry * 1.3)}Q${f(C.x)} ${f(C.y + ry * 1.5 + osc(2) * 4)} ${f(C.x - rx * 0.85)} ${f(C.y + ry * 1.3)}Z`, fill: c.secondary });
        ops.push(line({ x: C.x - rx * 0.85, y: C.y + ry * 1.3 }, { x: C.x + rx * 0.7, y: C.y + ry * 1.3 }, 6, c.accent));
      }
    }
  }
  legRoots.forEach((r, i) => leg(C.x + BL * r, i % 2 === 0 ? offsetsFor(offsets, true, false) : offsetsFor(offsets, false, false), r > 0, false));

  // Neck and head
  const dip = state === "attack" ? Math.pow(Math.max(0, Math.sin(phase)), 2) : 0;
  const neckBase = { x: C.x + rx * 0.78, y: C.y - BH * 0.25 };
  const r = 30 * p.head;
  const head = { x: neckBase.x + 40 + r * 0.5 + dip * 30, y: neckBase.y - 58 * Math.sqrt(p.head) + dip * 45 + Math.sin(phase * (state === "run" ? 2 : 1)) * 3 };
  ops.push(...taper(neckBase, head, 34 * b, 18 * b, c.primary));
  drawHead(k, null, head, r, 12 + dip * 20);
}

function offsetsFor(o: { nf: number; ff: number; nb: number; fb: number }, front: boolean, far: boolean) {
  return front ? (far ? o.ff : o.nf) : far ? o.fb : o.nb;
}

/* ---------- Flyer (side view, facing right) ---------- */

function flyer(k: Kit, state: GameState, phase: number) {
  const { ops, c, p, b } = k;
  let bob = Math.sin(phase) * 10;
  let tilt = 0;
  let flapRate = 3;
  let flapAmp = 26;
  let dx = 0;
  if (state === "walk") {
    bob = Math.sin(phase) * 6;
    tilt = -8;
    flapAmp = 30;
  } else if (state === "run") {
    bob = Math.sin(phase * 2) * 4;
    tilt = -18;
    flapAmp = 18;
  } else if (state === "jump") {
    bob = -Math.max(0, Math.sin(phase)) * 70;
    tilt = -14 * Math.max(0, Math.sin(phase));
    flapAmp = 40;
  } else if (state === "attack") {
    const s = Math.pow(Math.max(0, Math.sin(phase)), 2);
    dx = s * 50;
    bob = s * 40;
    tilt = 26 * s;
    flapAmp = 10;
  }
  // Flaps lock to the state's phase so the cycle loops
  flapRate = (TAU / stateSeconds(state)) * (state === "run" ? 3 : 2);
  const C = { x: 200 + dx, y: 250 + bob };
  const rot = (pt: P): P => {
    const a = (tilt * Math.PI) / 180;
    const x = pt.x - C.x;
    const y = pt.y - C.y;
    return { x: C.x + x * Math.cos(a) - y * Math.sin(a), y: C.y + x * Math.sin(a) + y * Math.cos(a) };
  };
  // Flyers always have wings: if the design has none, they get feathered ones
  const wingKit: Kit = ["feathers", "bat", "insect"].includes(k.parts.back) ? k : { ...k, parts: { ...k.parts, back: "feathers" } };
  drawBack(wingKit, rot({ x: C.x - 10, y: C.y - 22 }), { span: 1.25 * p.shoulders, flapAmp, flapRate });
  drawTail(k, rot({ x: C.x - 64 * p.shoulders, y: C.y + 4 }), -1, 0.85);
  // Tucked legs
  if (k.parts.legs !== "wisp") {
    for (const s of [0, 1]) {
      const hip = rot({ x: C.x - 6 - s * 14, y: C.y + 24 });
      const knee = rot({ x: C.x - 20 - s * 14, y: C.y + 40 + 10 * p.legs });
      const foot = rot({ x: C.x - 40 - s * 14, y: C.y + 58 + 16 * p.legs });
      drawLeg(k, hip, knee, foot, -1, s === 0 ? 0.7 : undefined);
    }
  }
  ops.push({ t: "path", d: ellipse(0, 0, 72 * p.shoulders, 34 * b), fill: c.primary, tf: { x: C.x, y: C.y, r: tilt } });
  ops.push({ t: "path", d: ellipse(8, 12 * b, 48 * p.shoulders, 18 * b), fill: mix(c.primary, "#ffffff", 0.25), tf: { x: C.x, y: C.y, r: tilt } });
  if (k.parts.torso === "armored") ops.push({ t: "path", d: ellipse(0, -16 * b, 50 * p.shoulders, 14 * b), fill: k.metal, tf: { x: C.x, y: C.y, r: tilt } });
  if (k.parts.torso === "core") ops.push({ t: "path", d: circle(0, 0, 18 * b), fill: c.glow, opacity: 0.9, tf: { x: C.x, y: C.y, r: tilt } });
  const r = 28 * p.head;
  const neck = rot({ x: C.x + 56 * p.shoulders, y: C.y - 12 });
  const head = rot({ x: C.x + 74 * p.shoulders + r * 0.6, y: C.y - 30 });
  ops.push(...taper(neck, head, 26 * b, 16 * b, c.primary));
  drawHead(k, null, head, r, tilt + 10);
}

/* ---------- Serpent (side view, facing right) ---------- */

function serpent(k: Kit, state: GameState, phase: number) {
  const { ops, c, p, b } = k;
  const N = 16;
  const spacing = 17 * p.shoulders;
  const base = 26 * b * (k.parts.torso === "round" ? 1.3 : k.parts.torso === "broad" ? 1.15 : 1);
  let amp = 10;
  let freq = 1;
  let rise = 0;
  let strike = 0;
  if (state === "walk") amp = 22;
  else if (state === "run") {
    amp = 30;
    freq = 2;
  } else if (state === "jump") rise = Math.max(0, Math.sin(phase)) * 90;
  else if (state === "attack") strike = Math.pow(Math.max(0, Math.sin(phase)), 3);
  const raise = 110 * p.legs + strike * 30;
  const thick = (i: number) => base * (1 - (i / N) * 0.75);
  const pts: P[] = [];
  for (let i = 0; i < N; i++) {
    const tail = i / N;
    let x = 290 - i * spacing;
    let y = FLOOR - thick(i) + Math.sin(i * 0.7 - phase * freq) * amp * (tail + 0.2);
    if (i < 5) {
      const h = Math.pow(1 - i / 5, 2);
      y -= raise * h;
      x += strike * 70 * h;
    }
    y -= rise * Math.sin(Math.PI * Math.min(1, (i + 2) / (N + 2)));
    pts.push({ x, y });
  }
  drawBack(k, { x: pts[3].x, y: pts[3].y - thick(3) }, { span: 0.75, flapAmp: 10, trail: -1 });
  drawTail(k, pts[N - 1], -1, 0.55);
  for (let i = N - 1; i >= 0; i--) {
    const q = pts[i];
    if (k.parts.legs === "arachnid" && i > 2) {
      const step = Math.sin(phase * 2 + i) * 6;
      ops.push(line(q, { x: q.x - 6 + step, y: q.y + thick(i) + 18 }, 5 * b, c.secondary));
    }
    ops.push({ t: "path", d: circle(q.x, q.y, thick(i)), fill: i % 2 ? c.primary : mix(c.primary, c.secondary, 0.5) });
    if (k.parts.torso === "armored" && i % 2 === 0) ops.push({ t: "path", d: ellipse(q.x, q.y - thick(i) * 0.55, thick(i) * 0.7, thick(i) * 0.4), fill: k.metal });
    if (k.parts.torso === "core" && i % 3 === 0) ops.push({ t: "path", d: circle(q.x, q.y, thick(i) * 0.35), fill: c.glow });
    if (k.parts.torso === "robe" && i % 2 === 1) ops.push({ t: "path", d: poly([{ x: q.x - 6, y: q.y - thick(i) * 0.8 }, { x: q.x, y: q.y - thick(i) * 1.6 }, { x: q.x + 6, y: q.y - thick(i) * 0.8 }]), fill: c.accent });
  }
  const r = 30 * p.head;
  drawHead(k, null, add(pts[0], 14, -8), r, 18 + strike * 25);
}

/* ---------- Floater ---------- */

function floater(k: Kit, state: GameState, phase: number) {
  const { ops, c, p, b } = k;
  let bob = Math.sin(phase) * 14;
  let drift = 0;
  let tilt = 0;
  let pulse = 0;
  if (state === "walk") {
    drift = Math.sin(phase) * 10;
    tilt = 8;
  } else if (state === "run") {
    tilt = 18;
    bob = Math.sin(phase * 2) * 6;
  } else if (state === "jump") bob = -Math.max(0, Math.sin(phase)) * 70;
  else if (state === "attack") pulse = Math.pow(Math.max(0, Math.sin(phase)), 2);
  const C = { x: 200 + drift, y: 230 + bob };
  const rx = 70 * p.shoulders * (1 + pulse * 0.15);
  const ry = 56 * b * (1 + pulse * 0.15);

  drawBack(k, { x: C.x, y: C.y - 10 }, { span: 0.85, flapAmp: 8, trail: -1 });
  drawTail(k, { x: C.x, y: C.y + ry * 0.6 }, -1, 0.7);

  // Tendrils trail behind the direction of travel
  const tendrilColor = k.parts.arms === "tentacle" ? c.skin : k.parts.arms === "mech" ? c.secondary : c.glow;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const x0 = C.x + (i - (count - 1) / 2) * (rx * 0.28);
    const len = 150 * p.legs;
    const pts: string[] = [];
    for (let s = 0; s <= 10; s++) {
      const q = s / 10;
      pts.push(`${f(x0 - tilt * 2 * q + Math.sin(phase + i + q * 4) * 14 * q)} ${f(C.y + ry * 0.4 + q * len)}`);
    }
    ops.push({ t: "path", d: `M${pts.join("L")}`, stroke: tendrilColor, sw: (k.parts.arms === "tentacle" ? 10 : 6) * b, fill: "none", opacity: k.parts.arms === "tentacle" || k.parts.arms === "mech" ? 1 : 0.7 });
  }

  switch (k.parts.torso) {
    case "core":
      ops.push({ t: "path", d: circle(C.x, C.y + 10, 36 * b), fill: c.glow, opacity: 0.9 });
      ops.push({ t: "path", d: ellipse(C.x, C.y + 10, rx, 16), stroke: c.accent, sw: 4, fill: "none" });
      break;
    case "robe":
      ops.push({ t: "path", d: `M${f(C.x - rx * 0.7)} ${f(C.y - 20)}Q${f(C.x)} ${f(C.y - ry * 1.2)} ${f(C.x + rx * 0.7)} ${f(C.y - 20)}L${f(C.x + rx)} ${f(C.y + ry * 1.6)}Q${f(C.x + rx * 0.5)} ${f(C.y + ry * 1.3 + Math.sin(phase) * 8)} ${f(C.x)} ${f(C.y + ry * 1.6)}Q${f(C.x - rx * 0.5)} ${f(C.y + ry * 1.3 - Math.sin(phase) * 8)} ${f(C.x - rx)} ${f(C.y + ry * 1.6)}Z`, fill: c.primary, opacity: 0.92 });
      break;
    default: {
      // A jellyfish-like bell
      ops.push({ t: "path", d: `M${f(C.x - rx)} ${f(C.y + ry * 0.4)}C${f(C.x - rx)} ${f(C.y - ry * 1.2)} ${f(C.x + rx)} ${f(C.y - ry * 1.2)} ${f(C.x + rx)} ${f(C.y + ry * 0.4)}Q${f(C.x)} ${f(C.y + ry * 0.75)} ${f(C.x - rx)} ${f(C.y + ry * 0.4)}Z`, fill: c.primary, opacity: 0.95 });
      if (k.parts.torso === "armored") ops.push(line({ x: C.x - rx * 0.9, y: C.y + ry * 0.1 }, { x: C.x + rx * 0.9, y: C.y + ry * 0.1 }, 10 * b, k.metal));
    }
  }
  if (pulse > 0) ops.push({ t: "path", d: circle(C.x, C.y, rx * (1.2 + pulse * 0.6)), stroke: c.glow, sw: 4, fill: "none", opacity: 1 - pulse * 0.6 });
  // Small arms for designs that have hands
  if (["human", "claws", "blade"].includes(k.parts.arms)) {
    for (const s of [-1, 1]) {
      const sh = { x: C.x + s * rx * 0.85, y: C.y + 4 };
      const el = { x: sh.x + s * 26, y: sh.y + 30 + Math.sin(phase + s) * 6 };
      const ha = { x: el.x + s * 6, y: el.y + 30 };
      drawArm(k, sh, el, ha);
    }
  }
  drawHead(k, null, { x: C.x, y: C.y - ry * 0.35 }, 40 * p.head, tilt);
}

