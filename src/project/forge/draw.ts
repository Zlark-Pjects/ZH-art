import type { CharacterBuild, CharacterPalette, CharacterProportions, PartSlot } from "../../types";
import { mix } from "../builder";

/*
 * Shared drawing kit for every body plan: draw ops, geometry helpers, and
 * the parts that look the same on any body (head, back, tail). Positions are
 * in rig space (400 x 500, floor at y = 470).
 */

export interface Tf {
  x: number;
  y: number;
  r?: number; // degrees
  s?: number;
}

export type DrawOp =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; color: string; opacity?: number }
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; tf?: Tf };

export type P = { x: number; y: number };

export const TAU = Math.PI * 2;
export const FLOOR = 470;

export const f = (n: number) => Math.round(n * 10) / 10;
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
export const poly = (pts: P[]) => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}Z`;
export const angle = (a: P, b: P) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
export const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const add = (a: P, dx: number, dy: number): P => ({ x: a.x + dx, y: a.y + dy });
export const line = (a: P, b: P, w: number, color: string, opacity?: number): DrawOp => ({ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, color, opacity });

export function bezier(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Tapered limb: a quad between two widths, with round ends. */
export function taper(a: P, b: P, w1: number, w2: number, color: string, opacity?: number): DrawOp[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  return [
    { t: "path", d: poly([add(a, (nx * w1) / 2, (ny * w1) / 2), add(b, (nx * w2) / 2, (ny * w2) / 2), add(b, (-nx * w2) / 2, (-ny * w2) / 2), add(a, (-nx * w1) / 2, (-ny * w1) / 2)]), fill: color, opacity },
    { t: "path", d: circle(a.x, a.y, w1 / 2), fill: color, opacity },
    { t: "path", d: circle(b.x, b.y, w2 / 2), fill: color, opacity },
  ];
}

/* ---------- Drawing context ---------- */

export interface Kit {
  ops: DrawOp[];
  c: CharacterPalette;
  parts: Record<PartSlot, string>;
  p: CharacterProportions;
  b: number;
  dark: string;
  metal: string;
  bone: string;
  t: number;
  /** sin(t * rate + offset), with the rate snapped so it loops over `loop` seconds when given. */
  osc: (rate: number, offset?: number) => number;
}

export function makeKit(build: CharacterBuild, t: number, loop?: number): Kit {
  const snap = (rate: number) => (loop ? (Math.max(1, Math.round((rate * loop) / TAU)) * TAU) / loop : rate);
  const c = build.palette;
  return {
    ops: [],
    c,
    parts: build.parts,
    p: build.proportions,
    b: build.proportions.bulk,
    dark: mix(c.secondary, "#000000", 0.45),
    metal: mix("#d9dee6", c.accent, 0.12),
    bone: mix("#efe4cf", c.skin, 0.2),
    t,
    osc: (rate, offset = 0) => Math.sin(t * snap(rate) + offset),
  };
}

/* ---------- Back: wings, cape, jetpack, crystals ---------- */

/**
 * Draws the back part around `root`. `span` scales wings; `flapAmp` and
 * `flapRate` control the beat. For side views, `trail` is the direction the
 * cape streams out (-1 = behind a right-facing body).
 */
export function drawBack(
  k: Kit,
  root: P,
  opts: { span?: number; flapAmp?: number; flapRate?: number; flap?: number; cape?: { left: P; right: P; bottom: number }; trail?: -1 | 1 } = {},
) {
  const { ops, c, dark, osc } = k;
  const span = opts.span ?? 1;
  // `flap` (-1..1) sets the wing angle directly, e.g. from a retargeted pose
  const flap = (opts.flap ?? osc(opts.flapRate ?? 3)) * (opts.flapAmp ?? 7);
  switch (k.parts.back) {
    case "feathers":
      for (const side of [-1, 1]) {
        const base = add(root, side * 18, 12);
        for (let i = 0; i < 5; i++) {
          const len = (120 + i * 16) * span;
          const deg = side < 0 ? 195 + i * 16 - flap : -15 - i * 16 + flap;
          ops.push({ t: "path", d: ellipse(len / 2, 0, len / 2, 13 * Math.sqrt(span)), fill: mix(c.secondary, c.accent, i / 6), tf: { x: base.x, y: base.y, r: deg } });
        }
      }
      break;
    case "bat":
      for (const side of [-1, 1]) {
        const base = add(root, side * 18, 8);
        const s = side * span;
        const lift = flap * 1.5;
        const tip1 = add(base, s * 175, -95 * span - lift);
        const tip2 = add(base, s * 205, 15 * span - lift / 2);
        const tip3 = add(base, s * 130, 95 * span);
        ops.push({
          t: "path",
          d: `M${f(base.x)} ${f(base.y)}L${f(tip1.x)} ${f(tip1.y)}Q${f(base.x + s * 170)} ${f(base.y - 20)} ${f(tip2.x)} ${f(tip2.y)}Q${f(base.x + s * 140)} ${f(base.y + 40)} ${f(tip3.x)} ${f(tip3.y)}Q${f(base.x + s * 60)} ${f(base.y + 70)} ${f(base.x)} ${f(base.y + 60)}Z`,
          fill: c.secondary,
          opacity: 0.95,
        });
        for (const tip of [tip1, tip2, tip3]) ops.push(line(base, tip, 5, dark));
      }
      break;
    case "insect":
      for (const side of [-1, 1]) {
        const base = add(root, side * 14, 20);
        for (const [len, deg] of [[150, -35], [115, 20]] as const) {
          const a = side < 0 ? 180 - deg - flap * 2 : deg + flap * 2;
          ops.push({ t: "path", d: ellipse((len * span) / 2, 0, (len * span) / 2, 26 * span), fill: c.glow, stroke: c.glow, sw: 2, opacity: 0.35, tf: { x: base.x, y: base.y, r: a } });
        }
      }
      break;
    case "cape": {
      const sway = osc(1.6) * 14;
      if (opts.cape) {
        const { left, right, bottom } = opts.cape;
        ops.push({
          t: "path",
          d: `M${f(left.x - 6)} ${f(left.y - 6)}L${f(right.x + 6)} ${f(right.y - 6)}L${f(right.x + 70)} ${f(bottom)}Q${f((left.x + right.x) / 2 + sway)} ${f(bottom + 22)} ${f(left.x - 70)} ${f(bottom)}Z`,
          fill: c.secondary,
        });
      } else {
        // Side view: a cape streaming behind
        const dir = opts.trail ?? -1;
        ops.push({
          t: "path",
          d: `M${f(root.x + dir * -10)} ${f(root.y - 8)}Q${f(root.x + dir * 90)} ${f(root.y - 30 + sway)} ${f(root.x + dir * 170)} ${f(root.y + 20 + sway)}L${f(root.x + dir * 120)} ${f(root.y + 60)}Q${f(root.x + dir * 50)} ${f(root.y + 40)} ${f(root.x)} ${f(root.y + 30)}Z`,
          fill: c.secondary,
        });
      }
      break;
    }
    case "jetpack":
      for (const side of [-1, 1]) {
        const x = root.x + side * 34;
        ops.push({ t: "path", d: `M${f(x - 16)} ${f(root.y + 10)}h32v84q0 10 -16 10q-16 0 -16 -10Z`, fill: c.secondary });
        const flame = 30 + osc(20, side) * 8;
        ops.push({ t: "path", d: `M${f(x - 10)} ${f(root.y + 104)}Q${f(x)} ${f(root.y + 104 + flame * 1.6)} ${f(x + 10)} ${f(root.y + 104)}Z`, fill: c.glow, opacity: 0.9 });
      }
      break;
    case "crystals":
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const bob = osc(1.8, i) * 8;
        const cx = root.x + side * (70 + (i >> 1) * 45) * span;
        const cy = root.y - 20 - (i >> 1) * 40 + bob;
        const h = 46 - (i >> 1) * 10;
        ops.push({ t: "path", d: poly([{ x: cx, y: cy - h }, { x: cx + 13, y: cy }, { x: cx, y: cy + h * 0.6 }, { x: cx - 13, y: cy }]), fill: c.glow, opacity: 0.8 });
      }
      break;
  }
}

/* ---------- Tail ---------- */

/** Tail from `root`, extending in `dir` (+1 right, -1 left). */
export function drawTail(k: Kit, root: P, dir: 1 | -1, scale = 1) {
  const { ops, c, b, osc } = k;
  const sway = osc(2.2) * 18;
  const X = (dx: number) => root.x + dir * dx * scale;
  const Y = (dy: number) => root.y + dy * scale;
  switch (k.parts.tail) {
    case "long": {
      const p1 = { x: X(70), y: Y(40) };
      const p2 = { x: X(150) + dir * sway, y: Y(10) };
      const p3 = { x: X(175) + dir * sway, y: Y(-55) };
      ops.push({ t: "path", d: `M${f(root.x)} ${f(root.y)}C${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(p3.x)} ${f(p3.y)}`, stroke: c.primary, sw: 18 * b * scale, fill: "none" });
      ops.push({ t: "path", d: circle(p3.x, p3.y, 10 * b * scale), fill: c.accent });
      break;
    }
    case "fluffy": {
      const r = (dir > 0 ? -30 : 210) + (dir * sway) / 3;
      ops.push({ t: "path", d: ellipse(70 * scale, 0, 72 * scale, 34 * b * scale), fill: c.hair, tf: { x: root.x, y: root.y + 20 * scale, r } });
      ops.push({ t: "path", d: ellipse(126 * scale, 0, 18 * scale, 22 * b * scale), fill: mix(c.hair, "#ffffff", 0.6), tf: { x: root.x, y: root.y + 20 * scale, r } });
      break;
    }
    case "spiked": {
      const a0 = root;
      const a1 = { x: X(80), y: Y(60) };
      const a2 = { x: X(150) + dir * sway, y: Y(50) };
      const a3 = { x: X(190) + dir * sway, y: Y(0) };
      ops.push({ t: "path", d: `M${f(a0.x)} ${f(a0.y)}C${f(a1.x)} ${f(a1.y)} ${f(a2.x)} ${f(a2.y)} ${f(a3.x)} ${f(a3.y)}`, stroke: c.primary, sw: 22 * b * scale, fill: "none" });
      for (let i = 1; i <= 5; i++) {
        const q = bezier(a0, a1, a2, a3, i / 6);
        ops.push({ t: "path", d: poly([{ x: -8, y: 0 }, { x: 0, y: -24 }, { x: 8, y: 0 }]), fill: c.accent, tf: { x: q.x, y: q.y - 8 * b * scale, s: scale } });
      }
      break;
    }
    case "ribbon": {
      const pts: string[] = [];
      for (let i = 0; i <= 24; i++) {
        const q = i / 24;
        pts.push(`${f(X(q * 220))} ${f(Y(30 + osc(4, -q * 9) * -16 * q - q * 40))}`);
      }
      ops.push({ t: "path", d: `M${pts.join("L")}`, stroke: c.glow, sw: 9 * scale, fill: "none", opacity: 0.85 });
      break;
    }
    case "scorpion": {
      const s0 = root;
      const s1 = { x: X(160), y: Y(40) };
      const s2 = { x: X(175) + (dir * sway) / 2, y: Y(-250) };
      const s3 = { x: X(70), y: Y(-215) };
      for (let i = 0; i < 9; i++) {
        const q = bezier(s0, s1, s2, s3, i / 9);
        ops.push({ t: "path", d: circle(q.x, q.y, (16 - i) * b * scale), fill: i % 2 ? c.primary : c.secondary });
      }
      ops.push({ t: "path", d: poly([{ x: 0, y: -10 }, { x: -34, y: 0 }, { x: 0, y: 10 }]), fill: c.accent, tf: { x: s3.x, y: s3.y, r: dir > 0 ? -20 : 200, s: scale } });
      break;
    }
  }
}

/* ---------- Head ---------- */

function hairPath(style: string, r: number): string | null {
  switch (style) {
    case "sleek":
      return `M${-r - 2} 4C${-r} ${-r * 1.5} ${r} ${-r * 1.5} ${r + 2} 4C${r * 0.4} ${-r * 0.5} ${-r * 0.4} ${-r * 0.5} ${-r - 2} 4Z`;
    case "quantum":
      return `M${-r} 0L${-r * 0.9} ${-r * 1.4}L${-r * 0.4} ${-r * 0.9}L${-r * 0.1} ${-r * 1.7}L${r * 0.3} ${-r * 0.95}L${r * 0.8} ${-r * 1.5}L${r} 0C${r * 0.4} ${-r * 0.55} ${-r * 0.4} ${-r * 0.55} ${-r} 0Z`;
    case "mech":
      return `M${-r - 4} ${-r * 0.1}L${-r - 4} ${-r * 0.9}Q0 ${-r * 1.45} ${r + 4} ${-r * 0.9}L${r + 4} ${-r * 0.1}Z`;
    case "ethereal":
      return `M${-r - 2} 0C${-r * 1.2} ${-r * 1.6} ${r * 1.2} ${-r * 1.6} ${r + 2} 0C${r * 1.6} ${r * 1.4} ${r * 1.1} ${r * 2.2} ${r * 0.7} ${r * 2.6}C${r * 0.8} ${r} ${r * 0.5} ${-r * 0.4} 0 ${-r * 0.55}C${-r * 0.5} ${-r * 0.4} ${-r * 0.8} ${r} ${-r * 0.7} ${r * 2.6}C${-r * 1.1} ${r * 2.2} ${-r * 1.6} ${r * 1.4} ${-r - 2} 0Z`;
    default:
      return null;
  }
}

function manePath(r: number) {
  const pts: P[] = [];
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU;
    const rr = i % 2 === 0 ? r * 1.65 : r * 1.2;
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr + r * 0.1 });
  }
  return poly(pts);
}

/**
 * Head with face, hair and headgear. `neck` (optional) draws the neck from
 * there to the head; `tilt` rotates the head in degrees.
 */
export function drawHead(k: Kit, neck: P | null, head: P, r: number, tilt: number) {
  const { ops, c, b, dark, bone, osc, parts } = k;
  type PathOp = Extract<DrawOp, { t: "path" }>;
  const H = (d: string, fill: string, extra: Partial<PathOp> = {}): DrawOp => ({ t: "path", d, fill, tf: { x: head.x, y: head.y, r: tilt }, ...extra });
  if (neck) ops.push(line(neck, head, 16 * b, c.skin));
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
      ops.push(H(ellipse(0, -r * 1.55 + osc(2) * 3, r * 0.7, r * 0.18), "none", { stroke: c.glow, sw: r * 0.1 }));
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
}
