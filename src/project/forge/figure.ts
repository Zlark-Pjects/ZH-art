import type { CharacterBuild, CharacterLook, CharacterProportions, PartSlot } from "../../types";
import type { Pose } from "../rig";
import { mix } from "../builder";

/*
 * Character figure renderer. A character is a set of parts (one per slot),
 * proportions and a palette. buildFigure() turns a rig pose into an ordered
 * list of draw ops in rig space (400 x 500). The same ops are drawn by the
 * SVG stage and by the canvas exporter, so previews and videos match.
 */

/* ---------- Draw ops ---------- */

export interface Tf {
  x: number;
  y: number;
  r?: number; // degrees
  s?: number;
}

export type DrawOp =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; color: string; opacity?: number }
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; tf?: Tf };

type P = { x: number; y: number };

const f = (n: number) => Math.round(n * 10) / 10;
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
const poly = (pts: P[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}Z`;
const angle = (a: P, b: P) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const add = (a: P, dx: number, dy: number): P => ({ x: a.x + dx, y: a.y + dy });

function bezier(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Tapered limb: a quad between two widths, with round ends. */
function taper(a: P, b: P, w1: number, w2: number, color: string): DrawOp[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  return [
    { t: "path", d: poly([add(a, (nx * w1) / 2, (ny * w1) / 2), add(b, (nx * w2) / 2, (ny * w2) / 2), add(b, (-nx * w2) / 2, (-ny * w2) / 2), add(a, (-nx * w1) / 2, (-ny * w1) / 2)]), fill: color },
    { t: "path", d: circle(a.x, a.y, w1 / 2), fill: color },
    { t: "path", d: circle(b.x, b.y, w2 / 2), fill: color },
  ];
}

const line = (a: P, b: P, w: number, color: string, opacity?: number): DrawOp => ({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, color, opacity });

/* ---------- Catalogue ---------- */

export interface PartOption {
  id: string;
  label: string;
}

export const SLOTS: { slot: PartSlot; label: string; options: PartOption[] }[] = [
  { slot: "torso", label: "Body", options: [
    { id: "slim", label: "Slim" }, { id: "broad", label: "Broad" }, { id: "round", label: "Round" },
    { id: "armored", label: "Armoured" }, { id: "robe", label: "Robe" }, { id: "core", label: "Floating core" },
  ] },
  { slot: "head", label: "Head", options: [
    { id: "round", label: "Round" }, { id: "long", label: "Long" }, { id: "block", label: "Block" },
    { id: "beast", label: "Muzzle" }, { id: "beak", label: "Beak" }, { id: "orb", label: "Orb" },
  ] },
  { slot: "face", label: "Eyes", options: [
    { id: "two", label: "Two" }, { id: "one", label: "Cyclops" }, { id: "three", label: "Three" },
    { id: "visor", label: "Visor" }, { id: "many", label: "Many" }, { id: "slits", label: "Slits" },
  ] },
  { slot: "hair", label: "Hair", options: [
    { id: "none", label: "None" }, { id: "sleek", label: "Sleek" }, { id: "quantum", label: "Spikes" },
    { id: "mech", label: "Cap" }, { id: "ethereal", label: "Flowing" }, { id: "mane", label: "Mane" },
  ] },
  { slot: "headgear", label: "Headgear", options: [
    { id: "none", label: "None" }, { id: "horns", label: "Horns" }, { id: "antlers", label: "Antlers" },
    { id: "antenna", label: "Antennae" }, { id: "crown", label: "Crown" }, { id: "halo", label: "Halo" },
    { id: "cat-ears", label: "Pointed ears" }, { id: "long-ears", label: "Long ears" }, { id: "crest", label: "Crest" },
  ] },
  { slot: "arms", label: "Arms", options: [
    { id: "human", label: "Arms" }, { id: "claws", label: "Claws" }, { id: "tentacle", label: "Tentacles" },
    { id: "mech", label: "Mechanical" }, { id: "blade", label: "Blade arms" }, { id: "none", label: "None" },
  ] },
  { slot: "legs", label: "Legs", options: [
    { id: "human", label: "Legs" }, { id: "beast", label: "Paws" }, { id: "mech", label: "Mechanical" },
    { id: "hooves", label: "Hooves" }, { id: "wisp", label: "Wisp" }, { id: "arachnid", label: "Six legs" },
  ] },
  { slot: "back", label: "Back", options: [
    { id: "none", label: "None" }, { id: "feathers", label: "Feathered wings" }, { id: "bat", label: "Bat wings" },
    { id: "insect", label: "Insect wings" }, { id: "cape", label: "Cape" }, { id: "jetpack", label: "Jetpack" },
    { id: "crystals", label: "Crystals" },
  ] },
  { slot: "tail", label: "Tail", options: [
    { id: "none", label: "None" }, { id: "long", label: "Long" }, { id: "fluffy", label: "Fluffy" },
    { id: "spiked", label: "Spiked" }, { id: "ribbon", label: "Ribbon" }, { id: "scorpion", label: "Stinger" },
  ] },
  { slot: "prop", label: "Holds", options: [
    { id: "none", label: "Nothing" }, { id: "sword", label: "Sword" }, { id: "staff", label: "Staff" },
    { id: "orb", label: "Orb" }, { id: "lantern", label: "Lantern" }, { id: "shield", label: "Shield" },
  ] },
];

export const DEFAULT_PROPORTIONS: CharacterProportions = { head: 1, shoulders: 1, arms: 1, legs: 1, bulk: 1 };

/** Characters made before the Forge are drawn as a plain humanoid in their colours. */
export function buildOf(look: CharacterLook): CharacterBuild {
  if (look.build) return look.build;
  return {
    seed: 0,
    archetype: "classic",
    parts: { torso: "slim", head: "round", face: "two", hair: look.hairStyle, headgear: "none", arms: "human", legs: "human", back: "none", tail: "none", prop: "none" },
    proportions: DEFAULT_PROPORTIONS,
    palette: { skin: look.skin, primary: look.costume, secondary: mix(look.costume, "#000000", 0.35), accent: look.accent, glow: look.eyes, hair: look.hair },
  };
}

/* ---------- Proportions ---------- */

const REST_LEG = 190; // hip (270) to ankle (460) in the rig

export function applyProportions(pose: Pose, p: CharacterProportions): Pose {
  const out: Pose = { ...pose };
  const neck = pose.neck;
  const pelvis = pose.pelvis;
  for (const side of ["l", "r"] as const) {
    const sh0 = pose[`${side}_shoulder`];
    const el0 = pose[`${side}_elbow`];
    const ha0 = pose[`${side}_hand`];
    const sh = { x: neck.x + (sh0.x - neck.x) * p.shoulders, y: sh0.y };
    const el = { x: sh.x + (el0.x - sh0.x) * p.arms, y: sh.y + (el0.y - sh0.y) * p.arms };
    const ha = { x: el.x + (ha0.x - el0.x) * p.arms, y: el.y + (ha0.y - el0.y) * p.arms };
    out[`${side}_shoulder`] = sh;
    out[`${side}_elbow`] = el;
    out[`${side}_hand`] = ha;

    const hip0 = pose[`${side}_hip`];
    const kn0 = pose[`${side}_knee`];
    const an0 = pose[`${side}_ankle`];
    const hipSpread = 1 + (p.shoulders - 1) * 0.6;
    const hip = { x: pelvis.x + (hip0.x - pelvis.x) * hipSpread, y: hip0.y };
    const kn = { x: hip.x + (kn0.x - hip0.x) * p.legs, y: hip.y + (kn0.y - hip0.y) * p.legs };
    const an = { x: kn.x + (an0.x - kn0.x) * p.legs, y: kn.y + (an0.y - kn0.y) * p.legs };
    out[`${side}_hip`] = hip;
    out[`${side}_knee`] = kn;
    out[`${side}_ankle`] = an;
  }
  out.head = { x: neck.x + (pose.head.x - neck.x) * (0.65 + 0.35 * p.head), y: neck.y + (pose.head.y - neck.y) * (0.65 + 0.35 * p.head) };
  // Keep the feet on the floor when legs get longer or shorter
  const lift = (p.legs - 1) * REST_LEG;
  if (lift) for (const id of Object.keys(out)) out[id] = { x: out[id].x, y: out[id].y - lift };
  return out;
}

/* ---------- Hair (local head space, centre 0,0, radius r) ---------- */

function hairPath(style: string, r: number): string | null {
  const x = 0;
  const y = 0;
  switch (style) {
    case "sleek":
      return `M${x - r - 2} ${y + 4}C${x - r} ${y - r * 1.5} ${x + r} ${y - r * 1.5} ${x + r + 2} ${y + 4}C${x + r * 0.4} ${y - r * 0.5} ${x - r * 0.4} ${y - r * 0.5} ${x - r - 2} ${y + 4}Z`;
    case "quantum":
      return `M${x - r} ${y}L${x - r * 0.9} ${y - r * 1.4}L${x - r * 0.4} ${y - r * 0.9}L${x - r * 0.1} ${y - r * 1.7}L${x + r * 0.3} ${y - r * 0.95}L${x + r * 0.8} ${y - r * 1.5}L${x + r} ${y}C${x + r * 0.4} ${y - r * 0.55} ${x - r * 0.4} ${y - r * 0.55} ${x - r} ${y}Z`;
    case "mech":
      return `M${x - r - 4} ${y - r * 0.1}L${x - r - 4} ${y - r * 0.9}Q${x} ${y - r * 1.45} ${x + r + 4} ${y - r * 0.9}L${x + r + 4} ${y - r * 0.1}Z`;
    case "ethereal":
      return `M${x - r - 2} ${y}C${x - r * 1.2} ${y - r * 1.6} ${x + r * 1.2} ${y - r * 1.6} ${x + r + 2} ${y}C${x + r * 1.6} ${y + r * 1.4} ${x + r * 1.1} ${y + r * 2.2} ${x + r * 0.7} ${y + r * 2.6}C${x + r * 0.8} ${y + r} ${x + r * 0.5} ${y - r * 0.4} ${x} ${y - r * 0.55}C${x - r * 0.5} ${y - r * 0.4} ${x - r * 0.8} ${y + r} ${x - r * 0.7} ${y + r * 2.6}C${x - r * 1.1} ${y + r * 2.2} ${x - r * 1.6} ${y + r * 1.4} ${x - r - 2} ${y}Z`;
    default:
      return null;
  }
}

/** Shaggy mane drawn behind the head. */
function manePath(r: number) {
  const pts: P[] = [];
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 1.65 : r * 1.2;
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr + r * 0.1 });
  }
  return poly(pts);
}

/* ---------- Build ---------- */

/**
 * Draw ops for a character in a pose. `t` (seconds) drives secondary motion:
 * wings beat, tails and capes sway, crystals bob.
 */
export function buildFigure(rawPose: Pose, look: CharacterLook, t = 0): DrawOp[] {
  const build = buildOf(look);
  const { parts, palette: c } = build;
  const p = build.proportions;
  const pose = applyProportions(rawPose, p);
  const b = p.bulk;
  const ops: DrawOp[] = [];
  const dark = mix(c.secondary, "#000000", 0.45);
  const metal = mix("#d9dee6", c.accent, 0.12);
  const bone = mix("#efe4cf", c.skin, 0.2);

  const neck = pose.neck;
  const pelvis = pose.pelvis;
  const ls = pose.l_shoulder;
  const rs = pose.r_shoulder;
  const lh = pose.l_hip;
  const rh = pose.r_hip;
  const shoulderMid = mid(ls, rs);

  /* --- back (behind everything) --- */
  const flap = Math.sin(t * 3) * 7;
  switch (parts.back) {
    case "feathers":
      for (const side of [-1, 1]) {
        const root = add(shoulderMid, side * 18, 12);
        for (let i = 0; i < 5; i++) {
          const len = (120 + i * 16) * (0.8 + 0.2 * p.shoulders);
          const deg = side < 0 ? 195 + i * 16 - flap : -15 - i * 16 + flap;
          ops.push({ t: "path", d: ellipse(len / 2, 0, len / 2, 13), fill: mix(c.secondary, c.accent, i / 6), tf: { x: root.x, y: root.y, r: deg } });
        }
      }
      break;
    case "bat":
      for (const side of [-1, 1]) {
        const root = add(shoulderMid, side * 18, 8);
        const s = side;
        const lift = flap * 1.5;
        const tip1 = add(root, s * 175, -95 - lift);
        const tip2 = add(root, s * 205, 15 - lift / 2);
        const tip3 = add(root, s * 130, 95);
        ops.push({
          t: "path",
          d: `M${f(root.x)} ${f(root.y)}L${f(tip1.x)} ${f(tip1.y)}Q${f(root.x + s * 170)} ${f(root.y - 20)} ${f(tip2.x)} ${f(tip2.y)}Q${f(root.x + s * 140)} ${f(root.y + 40)} ${f(tip3.x)} ${f(tip3.y)}Q${f(root.x + s * 60)} ${f(root.y + 70)} ${f(root.x)} ${f(root.y + 60)}Z`,
          fill: c.secondary,
          opacity: 0.95,
        });
        for (const tip of [tip1, tip2, tip3]) ops.push(line(root, tip, 5, dark));
      }
      break;
    case "insect":
      for (const side of [-1, 1]) {
        const root = add(shoulderMid, side * 14, 20);
        for (const [len, deg] of [[150, -35], [115, 20]] as const) {
          const a = side < 0 ? 180 - deg - flap * 2 : deg + flap * 2;
          ops.push({ t: "path", d: ellipse(len / 2, 0, len / 2, 26), fill: c.glow, stroke: c.glow, sw: 2, opacity: 0.35, tf: { x: root.x, y: root.y, r: a } });
        }
      }
      break;
    case "cape": {
      const sway = Math.sin(t * 1.6) * 14;
      const bottom = pelvis.y + 200;
      ops.push({
        t: "path",
        d: `M${f(ls.x - 6)} ${f(ls.y - 6)}L${f(rs.x + 6)} ${f(rs.y - 6)}L${f(rh.x + 55)} ${f(bottom)}Q${f(pelvis.x + sway)} ${f(bottom + 22)} ${f(lh.x - 55)} ${f(bottom)}Z`,
        fill: c.secondary,
      });
      break;
    }
    case "jetpack":
      for (const side of [-1, 1]) {
        const x = shoulderMid.x + side * 34;
        ops.push({ t: "path", d: `M${f(x - 16)} ${f(neck.y + 10)}h32v84q0 10 -16 10q-16 0 -16 -10Z`, fill: c.secondary });
        const flame = 30 + Math.sin(t * 20 + side) * 8;
        ops.push({ t: "path", d: `M${f(x - 10)} ${f(neck.y + 104)}Q${f(x)} ${f(neck.y + 104 + flame * 1.6)} ${f(x + 10)} ${f(neck.y + 104)}Z`, fill: c.glow, opacity: 0.9 });
      }
      break;
    case "crystals":
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const bob = Math.sin(t * 1.8 + i) * 8;
        const cx = shoulderMid.x + side * (70 + (i >> 1) * 45);
        const cy = shoulderMid.y - 20 - (i >> 1) * 40 + bob;
        const h = 46 - (i >> 1) * 10;
        ops.push({ t: "path", d: poly([{ x: cx, y: cy - h }, { x: cx + 13, y: cy }, { x: cx, y: cy + h * 0.6 }, { x: cx - 13, y: cy }]), fill: c.glow, opacity: 0.8 });
      }
      break;
  }

  /* --- tail (behind body) --- */
  const sway = Math.sin(t * 2.2) * 18;
  const tailRoot = add(pelvis, 0, 12);
  switch (parts.tail) {
    case "long": {
      const p1 = add(tailRoot, 70, 40);
      const p2 = add(tailRoot, 150 + sway, 10);
      const p3 = add(tailRoot, 175 + sway, -55);
      ops.push({ t: "path", d: `M${f(tailRoot.x)} ${f(tailRoot.y)}C${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(p3.x)} ${f(p3.y)}`, stroke: c.primary, sw: 18 * b, fill: "none" });
      ops.push({ t: "path", d: circle(p3.x, p3.y, 10 * b), fill: c.accent });
      break;
    }
    case "fluffy":
      ops.push({ t: "path", d: ellipse(70, 0, 72, 34 * b), fill: c.hair, tf: { x: tailRoot.x, y: tailRoot.y + 20, r: -30 + sway / 3 } });
      ops.push({ t: "path", d: ellipse(126, 0, 18, 22 * b), fill: mix(c.hair, "#ffffff", 0.6), tf: { x: tailRoot.x, y: tailRoot.y + 20, r: -30 + sway / 3 } });
      break;
    case "spiked": {
      const a0 = tailRoot;
      const a1 = add(tailRoot, 80, 60);
      const a2 = add(tailRoot, 150 + sway, 50);
      const a3 = add(tailRoot, 190 + sway, 0);
      ops.push({ t: "path", d: `M${f(a0.x)} ${f(a0.y)}C${f(a1.x)} ${f(a1.y)} ${f(a2.x)} ${f(a2.y)} ${f(a3.x)} ${f(a3.y)}`, stroke: c.primary, sw: 22 * b, fill: "none" });
      for (let i = 1; i <= 5; i++) {
        const q = bezier(a0, a1, a2, a3, i / 6);
        ops.push({ t: "path", d: poly([{ x: -8, y: 0 }, { x: 0, y: -24 }, { x: 8, y: 0 }]), fill: c.accent, tf: { x: q.x, y: q.y - 8 * b, r: 0 } });
      }
      break;
    }
    case "ribbon": {
      const pts: string[] = [];
      for (let i = 0; i <= 24; i++) {
        const k = i / 24;
        pts.push(`${f(tailRoot.x + k * 220)} ${f(tailRoot.y + 30 + Math.sin(k * 9 - t * 4) * 16 * k - k * 40)}`);
      }
      ops.push({ t: "path", d: `M${pts.join("L")}`, stroke: c.glow, sw: 9, fill: "none", opacity: 0.85 });
      break;
    }
    case "scorpion": {
      const s0 = tailRoot;
      const s1 = add(tailRoot, 160, 40);
      const s2 = { x: pelvis.x + 175 + sway / 2, y: neck.y - 130 };
      const s3 = { x: pelvis.x + 70, y: neck.y - 95 };
      for (let i = 0; i < 9; i++) {
        const q = bezier(s0, s1, s2, s3, i / 9);
        ops.push({ t: "path", d: circle(q.x, q.y, (16 - i) * b), fill: i % 2 ? c.primary : c.secondary });
      }
      ops.push({ t: "path", d: poly([{ x: 0, y: -10 }, { x: -34, y: 0 }, { x: 0, y: 10 }]), fill: c.accent, tf: { x: s3.x, y: s3.y, r: -20 } });
      break;
    }
  }

  /* --- legs --- */
  const legSides = [
    { hip: lh, knee: pose.l_knee, ankle: pose.l_ankle, dir: -1 },
    { hip: rh, knee: pose.r_knee, ankle: pose.r_ankle, dir: 1 },
  ];
  switch (parts.legs) {
    case "wisp": {
      const tip = { x: pelvis.x + Math.sin(t * 1.5) * 26, y: pelvis.y + 205 * p.legs };
      ops.push({
        t: "path",
        d: `M${f(lh.x - 8)} ${f(lh.y)}C${f(lh.x - 10)} ${f(lh.y + 110)} ${f(tip.x - 30)} ${f(tip.y - 50)} ${f(tip.x)} ${f(tip.y)}C${f(tip.x + 30)} ${f(tip.y - 50)} ${f(rh.x + 10)} ${f(rh.y + 110)} ${f(rh.x + 8)} ${f(rh.y)}Z`,
        fill: c.primary,
        opacity: 0.9,
      });
      ops.push({ t: "path", d: ellipse(pelvis.x, pelvis.y + 70, 26, 60), fill: c.glow, opacity: 0.25 });
      break;
    }
    case "arachnid":
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const step = Math.sin(t * 6 + i * 2 + (side > 0 ? 1 : 0)) * 10;
          const root = add(pelvis, side * 18, 4 + i * 6);
          const knee = add(root, side * (70 + i * 26), -50 + i * 14 + step);
          const foot = { x: root.x + side * (95 + i * 42), y: 470 + Math.min(0, step) };
          ops.push(line(root, knee, 12 * b, c.secondary));
          ops.push(line(knee, foot, 8 * b, c.secondary));
          ops.push({ t: "path", d: circle(knee.x, knee.y, 7 * b), fill: c.accent });
        }
      }
      break;
    default:
      for (const s of legSides) {
        if (parts.legs === "beast") {
          ops.push(...taper(s.hip, s.knee, 36 * b, 24 * b, c.primary));
          ops.push(line(s.knee, s.ankle, 18 * b, c.primary));
          ops.push({ t: "path", d: ellipse(s.ankle.x + s.dir * 4, s.ankle.y + 4, 19 * b, 10 * b), fill: c.skin });
          for (const k of [-1, 0, 1]) ops.push({ t: "path", d: poly([{ x: -3, y: 0 }, { x: 0, y: 9 }, { x: 3, y: 0 }]), fill: bone, tf: { x: s.ankle.x + s.dir * 4 + k * 9 * b, y: s.ankle.y + 10 } });
        } else if (parts.legs === "mech") {
          ops.push(line(s.hip, s.knee, 20 * b, c.secondary));
          ops.push(line(s.knee, s.ankle, 16 * b, c.secondary));
          for (const j of [s.hip, s.knee]) ops.push({ t: "path", d: circle(j.x, j.y, 12 * b), fill: c.accent });
          ops.push({ t: "path", d: `M${f(s.ankle.x - 20)} ${f(s.ankle.y - 4)}h40l6 14h-52Z`, fill: dark });
        } else if (parts.legs === "hooves") {
          ops.push(...taper(s.hip, s.knee, 32 * b, 20 * b, c.primary));
          ops.push(line(s.knee, s.ankle, 12 * b, c.skin));
          ops.push({ t: "path", d: `M${f(s.ankle.x - 10)} ${f(s.ankle.y - 2)}h20l4 16h-28Z`, fill: dark });
        } else {
          ops.push(line(s.hip, s.knee, 26 * b, c.primary));
          ops.push(line(s.knee, s.ankle, 22 * b, c.primary));
          ops.push({ t: "path", d: ellipse(s.ankle.x + s.dir * 3, s.ankle.y + 4, 17 * b, 9 * b), fill: c.secondary });
        }
      }
  }

  /* --- torso --- */
  const torsoLen = Math.max(40, pelvis.y - neck.y);
  const belt = (): DrawOp => line(add(lh, -4, -10), add(rh, 4, -10), 9 * b, c.accent);
  const trapezoid = (pad: number) =>
    poly([add(ls, -pad, -8), add(rs, pad, -8), add(rh, pad * 0.6, 6), add(lh, -pad * 0.6, 6)]);
  switch (parts.torso) {
    case "broad":
      ops.push({ t: "path", d: trapezoid(14 * b), fill: c.primary });
      ops.push({ t: "path", d: ellipse(neck.x, neck.y + 2, 26 * b, 12), fill: c.secondary });
      ops.push(belt());
      break;
    case "round":
      ops.push({ t: "path", d: ellipse(pelvis.x, neck.y + torsoLen * 0.58, Math.max(52, (rs.x - ls.x) * 0.58) * Math.sqrt(b), torsoLen * 0.62), fill: c.primary });
      ops.push({ t: "path", d: ellipse(pelvis.x, neck.y + torsoLen * 0.72, Math.max(30, (rs.x - ls.x) * 0.34) * Math.sqrt(b), torsoLen * 0.36), fill: mix(c.primary, "#ffffff", 0.25) });
      break;
    case "armored":
      ops.push({ t: "path", d: trapezoid(16 * b), fill: c.secondary });
      ops.push({ t: "path", d: poly([add(ls, 6, 6), add(rs, -6, 6), add(mid(rs, rh), -12, 0), add(pelvis, 0, -18), add(mid(ls, lh), 12, 0)]), fill: metal });
      ops.push({ t: "path", d: circle(neck.x, neck.y + torsoLen * 0.35, 9 * b), fill: c.accent });
      for (const s of [ls, rs]) ops.push({ t: "path", d: ellipse(s.x, s.y - 2, 24 * b, 16 * b), fill: metal });
      ops.push(belt());
      break;
    case "robe": {
      const hem = pelvis.y + 175 * p.legs;
      const flare = (rh.x - lh.x) * 1.4 + 50;
      ops.push({ t: "path", d: poly([add(ls, -8, -6), add(rs, 8, -6), { x: pelvis.x + flare / 2, y: hem }, { x: pelvis.x - flare / 2, y: hem }]), fill: c.primary });
      ops.push(line({ x: pelvis.x - flare / 2, y: hem }, { x: pelvis.x + flare / 2, y: hem }, 8, c.accent));
      ops.push(line(add(ls, 10, 4), add(rh, 6, 0), 10 * b, c.secondary));
      break;
    }
    case "core":
      ops.push(line(neck, pelvis, 10 * b, c.secondary));
      ops.push(line(ls, rs, 12 * b, c.secondary));
      ops.push(line(lh, rh, 10 * b, c.secondary));
      ops.push({ t: "path", d: circle(neck.x, neck.y + torsoLen * 0.45, 28 * b), fill: c.glow, opacity: 0.9 });
      ops.push({ t: "path", d: circle(neck.x, neck.y + torsoLen * 0.45, (38 + Math.sin(t * 3) * 3) * b), stroke: c.accent, sw: 3, fill: "none" });
      break;
    default:
      ops.push(line(pelvis, neck, 46 * b, c.primary));
      ops.push(line(ls, rs, 30 * b, c.primary));
      ops.push(belt());
  }

  /* --- arms --- */
  const armSides = [
    { sh: ls, el: pose.l_elbow, ha: pose.l_hand },
    { sh: rs, el: pose.r_elbow, ha: pose.r_hand },
  ];
  for (const s of armSides) {
    const fore = angle(s.el, s.ha);
    switch (parts.arms) {
      case "none":
        break;
      case "tentacle":
        ops.push(...taper(s.sh, s.el, 22 * b, 16 * b, c.skin));
        ops.push(...taper(s.el, s.ha, 16 * b, 7 * b, c.skin));
        for (let i = 1; i <= 3; i++) {
          const q = { x: s.el.x + ((s.ha.x - s.el.x) * i) / 4, y: s.el.y + ((s.ha.y - s.el.y) * i) / 4 };
          ops.push({ t: "path", d: circle(q.x, q.y, 3.2 * b), fill: c.accent });
        }
        break;
      case "mech":
        ops.push(line(s.sh, s.el, 16 * b, c.secondary));
        ops.push(line(s.el, s.ha, 13 * b, c.secondary));
        for (const j of [s.sh, s.el]) ops.push({ t: "path", d: circle(j.x, j.y, 11 * b), fill: c.accent });
        ops.push({ t: "path", d: "M0 -9L16 -5L16 -1L0 -2ZM0 9L16 5L16 1L0 2Z", fill: metal, tf: { x: s.ha.x, y: s.ha.y, r: fore } });
        break;
      default:
        ops.push(line(s.sh, s.el, 22 * b, c.primary));
        ops.push(line(s.el, s.ha, 18 * b, parts.arms === "blade" ? c.primary : c.skin));
        ops.push({ t: "path", d: circle(s.ha.x, s.ha.y, 11 * b), fill: c.skin });
        if (parts.arms === "claws") {
          for (const k of [-7, 0, 7]) ops.push({ t: "path", d: `M2 ${k - 3}L${f(24 * b)} ${k}L2 ${k + 3}Z`, fill: bone, tf: { x: s.ha.x, y: s.ha.y, r: fore } });
        }
        if (parts.arms === "blade") {
          ops.push({ t: "path", d: `M0 -7L${f(78 * b)} 0L0 7Z`, fill: metal, tf: { x: s.ha.x, y: s.ha.y, r: fore } });
        }
    }
  }

  /* --- head --- */
  const head = pose.head;
  const r = 38 * p.head;
  const tilt = angle(neck, head) + 90;
  const H = (d: string, fill: string, extra: Partial<Extract<DrawOp, { t: "path" }>> = {}): DrawOp => ({ t: "path", d, fill, tf: { x: head.x, y: head.y, r: tilt }, ...extra });
  ops.push(line(neck, head, 16 * b, c.skin));
  if (parts.hair === "mane") ops.push(H(manePath(r), c.hair));
  switch (parts.head) {
    case "long":
      ops.push(H(ellipse(0, 0, r * 0.8, r * 1.2), c.skin));
      break;
    case "block":
      ops.push(H(`M${f(-r)} ${f(-r * 0.6)}Q${f(-r)} ${f(-r)} ${f(-r * 0.6)} ${f(-r)}H${f(r * 0.6)}Q${f(r)} ${f(-r)} ${f(r)} ${f(-r * 0.6)}V${f(r * 0.6)}Q${f(r)} ${f(r)} ${f(r * 0.6)} ${f(r)}H${f(-r * 0.6)}Q${f(-r)} ${f(r)} ${f(-r)} ${f(r * 0.6)}Z`, c.skin));
      break;
    case "beast":
      ops.push(H(circle(0, 0, r), c.skin));
      ops.push(H(ellipse(0, r * 0.5, r * 0.55, r * 0.38), mix(c.skin, "#ffffff", 0.35)));
      ops.push(H(ellipse(0, r * 0.32, r * 0.16, r * 0.1), dark));
      break;
    case "beak":
      ops.push(H(circle(0, 0, r), c.skin));
      ops.push(H(poly([{ x: -r * 0.28, y: r * 0.18 }, { x: r * 0.28, y: r * 0.18 }, { x: 0, y: r * 0.85 }]), c.accent));
      break;
    case "orb":
      ops.push(H(circle(0, 0, r), c.glow, { opacity: 0.92 }));
      ops.push(H(circle(-r * 0.25, -r * 0.25, r * 0.35), "#ffffff", { opacity: 0.35 }));
      ops.push(H(ellipse(0, 0, r * 1.35, r * 0.35), "none", { stroke: c.accent, sw: 3 }));
      break;
    default:
      ops.push(H(circle(0, 0, r), c.skin));
  }
  // Eyes
  // On a glowing orb head the eyes go dark so they stay visible
  const eyeColor = parts.head === "orb" ? mix(c.secondary, "#000000", 0.6) : c.glow;
  const eye = (x: number, y: number, rr: number) => H(circle(x, y, rr), eyeColor);
  switch (parts.face) {
    case "one":
      ops.push(H(circle(0, r * 0.05, r * 0.28), "#f4f1ea"));
      ops.push(eye(0, r * 0.05, r * 0.14));
      break;
    case "three":
      ops.push(eye(-r * 0.4, r * 0.15, r * 0.11), eye(r * 0.4, r * 0.15, r * 0.11), eye(0, -r * 0.18, r * 0.11));
      break;
    case "visor":
      ops.push(H(`M${f(-r * 0.75)} ${f(-r * 0.12)}H${f(r * 0.75)}Q${f(r * 0.85)} ${f(r * 0.05)} ${f(r * 0.75)} ${f(r * 0.2)}H${f(-r * 0.75)}Q${f(-r * 0.85)} ${f(r * 0.05)} ${f(-r * 0.75)} ${f(-r * 0.12)}Z`, eyeColor, { opacity: 0.95 }));
      break;
    case "many":
      for (const [x, y, rr] of [[-0.45, 0.1, 0.1], [0.45, 0.1, 0.1], [-0.2, -0.12, 0.08], [0.2, -0.12, 0.08], [-0.25, 0.35, 0.07], [0.25, 0.35, 0.07]]) ops.push(eye(r * x, r * y, r * rr));
      break;
    case "slits":
      ops.push(H(ellipse(-r * 0.36, r * 0.1, r * 0.18, r * 0.05), eyeColor), H(ellipse(r * 0.36, r * 0.1, r * 0.18, r * 0.05), eyeColor));
      break;
    default:
      ops.push(eye(-r * 0.36, r * 0.1, r * 0.13), eye(r * 0.36, r * 0.1, r * 0.13));
  }
  const hp = hairPath(parts.hair, r);
  if (hp) ops.push(H(hp, c.hair));
  // Headgear
  switch (parts.headgear) {
    case "horns":
      for (const s of [-1, 1]) ops.push(H(`M${f(s * r * 0.5)} ${f(-r * 0.6)}Q${f(s * r * 1.35)} ${f(-r * 1.2)} ${f(s * r * 0.95)} ${f(-r * 1.95)}Q${f(s * r * 0.95)} ${f(-r * 1.2)} ${f(s * r * 0.2)} ${f(-r * 0.82)}Z`, bone));
      break;
    case "antlers":
      for (const s of [-1, 1])
        ops.push(H(`M${f(s * r * 0.4)} ${f(-r * 0.8)}L${f(s * r * 0.9)} ${f(-r * 1.9)}M${f(s * r * 0.62)} ${f(-r * 1.3)}L${f(s * r * 1.3)} ${f(-r * 1.55)}M${f(s * r * 0.8)} ${f(-r * 1.7)}L${f(s * r * 0.5)} ${f(-r * 2.2)}`, "none", { stroke: bone, sw: r * 0.14 }));
      break;
    case "antenna":
      for (const s of [-1, 1]) {
        ops.push(H(`M${f(s * r * 0.3)} ${f(-r * 0.85)}Q${f(s * r * 0.5)} ${f(-r * 1.6)} ${f(s * r * 0.85)} ${f(-r * 1.9)}`, "none", { stroke: c.secondary, sw: 4 }));
        ops.push(H(circle(s * r * 0.85, -r * 1.9, r * 0.14), c.glow));
      }
      break;
    case "crown":
      ops.push(H(poly([{ x: -r * 0.62, y: -r * 0.82 }, { x: -r * 0.62, y: -r * 1.38 }, { x: -r * 0.3, y: -r * 1.05 }, { x: 0, y: -r * 1.48 }, { x: r * 0.3, y: -r * 1.05 }, { x: r * 0.62, y: -r * 1.38 }, { x: r * 0.62, y: -r * 0.82 }]), c.accent));
      break;
    case "halo":
      ops.push(H(ellipse(0, -r * 1.55 + Math.sin(t * 2) * 3, r * 0.7, r * 0.18), "none", { stroke: c.glow, sw: r * 0.1 }));
      break;
    case "cat-ears":
      for (const s of [-1, 1]) {
        ops.push(H(poly([{ x: s * r * 0.25, y: -r * 0.85 }, { x: s * r * 0.9, y: -r * 1.55 }, { x: s * r * 0.92, y: -r * 0.45 }]), c.hair));
        ops.push(H(poly([{ x: s * r * 0.45, y: -r * 0.8 }, { x: s * r * 0.82, y: -r * 1.25 }, { x: s * r * 0.83, y: -r * 0.6 }]), c.accent, { opacity: 0.7 }));
      }
      break;
    case "long-ears":
      for (const s of [-1, 1]) ops.push(H(ellipse(s * r * 0.5, -r * 1.35, r * 0.2, r * 0.72), c.skin));
      break;
    case "crest":
      for (const [x, h] of [[-0.3, 1.45], [0, 1.95], [0.3, 1.45]]) ops.push(H(poly([{ x: r * (x - 0.13), y: -r * 0.85 }, { x: r * x, y: -r * h }, { x: r * (x + 0.13), y: -r * 0.85 }]), c.accent));
      break;
  }

  /* --- prop --- */
  const rhand = pose.r_hand;
  const lhand = pose.l_hand;
  const rFore = angle(pose.r_elbow, rhand);
  switch (parts.prop) {
    case "sword":
      ops.push({ t: "path", d: "M8 -5L118 -4L132 0L118 4L8 5Z", fill: metal, tf: { x: rhand.x, y: rhand.y, r: rFore } });
      ops.push({ t: "path", d: "M2 -16h8v32h-8Z", fill: c.accent, tf: { x: rhand.x, y: rhand.y, r: rFore } });
      break;
    case "staff":
      ops.push(line(add(rhand, 0, -150), add(rhand, 0, 130), 8, mix("#7a5232", c.secondary, 0.2)));
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 162, 16 + Math.sin(t * 3) * 2), fill: c.glow, opacity: 0.9 });
      break;
    case "orb":
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 26, 20), fill: c.glow, opacity: 0.9 });
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 26, 28 + Math.sin(t * 4) * 3), stroke: c.glow, sw: 2, fill: "none", opacity: 0.5 });
      break;
    case "lantern": {
      const swing = Math.sin(t * 2) * 6;
      ops.push(line(rhand, add(rhand, swing, 30), 3, dark));
      ops.push({ t: "path", d: `M${f(rhand.x + swing - 13)} ${f(rhand.y + 30)}h26v34h-26Z`, fill: dark });
      ops.push({ t: "path", d: circle(rhand.x + swing, rhand.y + 47, 10), fill: c.glow });
      break;
    }
    case "shield":
      ops.push({ t: "path", d: circle(lhand.x, lhand.y, 44), fill: c.secondary });
      ops.push({ t: "path", d: circle(lhand.x, lhand.y, 44), stroke: c.accent, sw: 5, fill: "none" });
      ops.push({ t: "path", d: poly([{ x: lhand.x, y: lhand.y - 22 }, { x: lhand.x + 16, y: lhand.y }, { x: lhand.x, y: lhand.y + 22 }, { x: lhand.x - 16, y: lhand.y }]), fill: c.accent });
      break;
  }

  return ops;
}

/** Draw ops onto a canvas context (already transformed into rig space). */
export function drawOps(ctx: CanvasRenderingContext2D, ops: DrawOp[]) {
  for (const op of ops) {
    ctx.save();
    ctx.globalAlpha = op.opacity ?? 1;
    if (op.t === "line") {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
    } else {
      if (op.tf) {
        ctx.translate(op.tf.x, op.tf.y);
        if (op.tf.r) ctx.rotate((op.tf.r * Math.PI) / 180);
        if (op.tf.s) ctx.scale(op.tf.s, op.tf.s);
      }
      const path = new Path2D(op.d);
      if (op.fill && op.fill !== "none") {
        ctx.fillStyle = op.fill;
        ctx.fill(path);
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.sw ?? 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(path);
      }
    }
    ctx.restore();
  }
}

export const tfAttr = (tf?: Tf) => (tf ? `translate(${f(tf.x)} ${f(tf.y)})${tf.r ? ` rotate(${f(tf.r)})` : ""}${tf.s ? ` scale(${tf.s})` : ""}` : undefined);
