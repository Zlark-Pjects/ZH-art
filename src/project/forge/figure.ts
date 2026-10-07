import type { CharacterBuild, CharacterLook, CharacterProportions, PartSlot } from "../../types";
import type { Pose } from "../rig";
import { mix } from "../builder";
import { add, angle, circle, drawBack, drawHead, drawTail, ellipse, f, line, makeKit, mid, poly, taper, type DrawOp, type P, type Tf } from "./draw";

export type { DrawOp, Tf } from "./draw";
export { ellipse } from "./draw";

/*
 * Character figure renderer. A character is a set of parts (one per slot),
 * proportions, a palette and a body plan. buildFigure() draws a biped from a
 * rig pose; other body plans live in plans.ts. Everything becomes draw ops in
 * rig space (400 x 500), drawn by the SVG stage and the canvas exporter alike.
 */

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

/* ---------- Biped ---------- */

/**
 * Draw ops for a biped in a pose. `t` (seconds) drives secondary motion
 * (wings beat, tails and capes sway); pass `loop` to make that motion repeat
 * seamlessly every `loop` seconds, as sprite sheets need.
 */
export function buildFigure(rawPose: Pose, look: CharacterLook, t = 0, loop?: number): DrawOp[] {
  const build = buildOf(look);
  const k = makeKit(build, t, loop);
  const { ops, c, parts, p, b, dark, metal, bone, osc } = k;
  const pose = applyProportions(rawPose, p);

  const neck = pose.neck;
  const pelvis = pose.pelvis;
  const ls = pose.l_shoulder;
  const rs = pose.r_shoulder;
  const lh = pose.l_hip;
  const rh = pose.r_hip;

  drawBack(k, mid(ls, rs), { span: 0.8 + 0.2 * p.shoulders, cape: { left: ls, right: rs, bottom: pelvis.y + 200 } });
  drawTail(k, add(pelvis, 0, 12), 1);

  /* --- legs --- */
  const legSides = [
    { hip: lh, knee: pose.l_knee, ankle: pose.l_ankle, dir: -1 },
    { hip: rh, knee: pose.r_knee, ankle: pose.r_ankle, dir: 1 },
  ];
  switch (parts.legs) {
    case "wisp": {
      const tip = { x: pelvis.x + osc(1.5) * 26, y: pelvis.y + 205 * p.legs };
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
          const step = osc(6, i * 2 + (side > 0 ? 1 : 0)) * 10;
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
      for (const s of legSides) drawLeg(k, s.hip, s.knee, s.ankle, s.dir);
  }

  /* --- torso --- */
  const torsoLen = Math.max(40, pelvis.y - neck.y);
  const belt = (): DrawOp => line(add(lh, -4, -10), add(rh, 4, -10), 9 * b, c.accent);
  const trapezoid = (pad: number) => poly([add(ls, -pad, -8), add(rs, pad, -8), add(rh, pad * 0.6, 6), add(lh, -pad * 0.6, 6)]);
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
      ops.push({ t: "path", d: circle(neck.x, neck.y + torsoLen * 0.45, (38 + osc(3) * 3) * b), stroke: c.accent, sw: 3, fill: "none" });
      break;
    default:
      ops.push(line(pelvis, neck, 46 * b, c.primary));
      ops.push(line(ls, rs, 30 * b, c.primary));
      ops.push(belt());
  }

  /* --- arms --- */
  for (const s of [
    { sh: ls, el: pose.l_elbow, ha: pose.l_hand },
    { sh: rs, el: pose.r_elbow, ha: pose.r_hand },
  ]) {
    drawArm(k, s.sh, s.el, s.ha);
  }

  /* --- head --- */
  drawHead(k, neck, pose.head, 38 * p.head, angle(neck, pose.head) + 90);

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
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 162, 16 + osc(3) * 2), fill: c.glow, opacity: 0.9 });
      break;
    case "orb":
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 26, 20), fill: c.glow, opacity: 0.9 });
      ops.push({ t: "path", d: circle(rhand.x, rhand.y - 26, 28 + osc(4) * 3), stroke: c.glow, sw: 2, fill: "none", opacity: 0.5 });
      break;
    case "lantern": {
      const swing = osc(2) * 6;
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
  void bone;
  return ops;
}

/** One leg (hip, knee, ankle) in the build's leg style. Shared by bipeds and four-legged bodies. */
export function drawLeg(k: ReturnType<typeof makeKit>, hip: P, knee: P, ankle: P, dir: number, opacity?: number) {
  const { ops, c, parts, b, dark, bone } = k;
  const push = (op: DrawOp) => ops.push(opacity !== undefined ? { ...op, opacity } : op);
  if (parts.legs === "beast") {
    taper(hip, knee, 36 * b, 24 * b, c.primary, opacity).forEach(push);
    push(line(knee, ankle, 18 * b, c.primary));
    push({ t: "path", d: ellipse(ankle.x + dir * 4, ankle.y + 4, 19 * b, 10 * b), fill: c.skin });
    for (const s of [-1, 0, 1]) push({ t: "path", d: poly([{ x: -3, y: 0 }, { x: 0, y: 9 }, { x: 3, y: 0 }]), fill: bone, tf: { x: ankle.x + dir * 4 + s * 9 * b, y: ankle.y + 10 } });
  } else if (parts.legs === "mech") {
    push(line(hip, knee, 20 * b, c.secondary));
    push(line(knee, ankle, 16 * b, c.secondary));
    for (const j of [hip, knee]) push({ t: "path", d: circle(j.x, j.y, 12 * b), fill: c.accent });
    push({ t: "path", d: `M${f(ankle.x - 20)} ${f(ankle.y - 4)}h40l6 14h-52Z`, fill: dark });
  } else if (parts.legs === "hooves") {
    taper(hip, knee, 32 * b, 20 * b, c.primary, opacity).forEach(push);
    push(line(knee, ankle, 12 * b, c.skin));
    push({ t: "path", d: `M${f(ankle.x - 10)} ${f(ankle.y - 2)}h20l4 16h-28Z`, fill: dark });
  } else if (parts.legs === "wisp") {
    taper(hip, ankle, 26 * b, 4, c.primary, (opacity ?? 1) * 0.7).forEach(push);
  } else {
    push(line(hip, knee, 26 * b, c.primary));
    push(line(knee, ankle, 22 * b, c.primary));
    push({ t: "path", d: ellipse(ankle.x + dir * 3, ankle.y + 4, 17 * b, 9 * b), fill: c.secondary });
  }
}

/** One arm (shoulder, elbow, hand) in the build's arm style. */
export function drawArm(k: ReturnType<typeof makeKit>, sh: P, el: P, ha: P) {
  const { ops, c, parts, b, metal, bone } = k;
  const fore = angle(el, ha);
  switch (parts.arms) {
    case "none":
      return;
    case "tentacle":
      ops.push(...taper(sh, el, 22 * b, 16 * b, c.skin));
      ops.push(...taper(el, ha, 16 * b, 7 * b, c.skin));
      for (let i = 1; i <= 3; i++) {
        const q = { x: el.x + ((ha.x - el.x) * i) / 4, y: el.y + ((ha.y - el.y) * i) / 4 };
        ops.push({ t: "path", d: circle(q.x, q.y, 3.2 * b), fill: c.accent });
      }
      return;
    case "mech":
      ops.push(line(sh, el, 16 * b, c.secondary));
      ops.push(line(el, ha, 13 * b, c.secondary));
      for (const j of [sh, el]) ops.push({ t: "path", d: circle(j.x, j.y, 11 * b), fill: c.accent });
      ops.push({ t: "path", d: "M0 -9L16 -5L16 -1L0 -2ZM0 9L16 5L16 1L0 2Z", fill: metal, tf: { x: ha.x, y: ha.y, r: fore } });
      return;
    default:
      ops.push(line(sh, el, 22 * b, c.primary));
      ops.push(line(el, ha, 18 * b, parts.arms === "blade" ? c.primary : c.skin));
      ops.push({ t: "path", d: circle(ha.x, ha.y, 11 * b), fill: c.skin });
      if (parts.arms === "claws") {
        for (const s of [-7, 0, 7]) ops.push({ t: "path", d: `M2 ${s - 3}L${f(24 * b)} ${s}L2 ${s + 3}Z`, fill: bone, tf: { x: ha.x, y: ha.y, r: fore } });
      }
      if (parts.arms === "blade") {
        ops.push({ t: "path", d: `M0 -7L${f(78 * b)} 0L0 7Z`, fill: metal, tf: { x: ha.x, y: ha.y, r: fore } });
      }
  }
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
