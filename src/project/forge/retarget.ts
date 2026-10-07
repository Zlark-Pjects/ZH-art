import { STANDING_POSE, type Pose } from "../rig";

/*
 * Retargeting: read a two-legged rig pose as a handful of body "drives" that
 * any body plan can follow. Arms drive front legs, wings and a serpent's
 * raised head; legs drive back legs; the hips' height and the spine's lean
 * drive the body. Rig poses are front views and the other plans are side
 * views, so a limb's sideways offset reads as forward/back: a run's
 * alternating arm swing becomes an alternating stride.
 */

export interface Limb {
  /** End of the limb relative to its rest position, rig pixels (+x forward, +y down) */
  dx: number;
  dy: number;
}

export interface Drive {
  /** Body height change, rig pixels; positive is up */
  rise: number;
  /** Body moved forward/back, rig pixels */
  shift: number;
  /** Spine lean from upright, degrees; positive leans forward */
  lean: number;
  /** Hands: [near, far] */
  front: [Limb, Limb];
  /** Feet: [near, far] */
  back: [Limb, Limb];
  /** Head offset from the neck, relative to rest */
  head: Limb;
  /** -1 arms hanging low, 0 resting, 1 raised overhead */
  armsUp: number;
  /** 0-1: how far a hand reaches forward or out to the side */
  reach: number;
}

const R = STANDING_POSE;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function limb(pose: Pose, root: string, end: string): Limb {
  const p = pose[end] ?? R[end];
  const r = pose[root] ?? R[root];
  return { dx: p.x - r.x - (R[end].x - R[root].x), dy: p.y - r.y - (R[end].y - R[root].y) };
}

export function driveFromPose(pose: Pose): Drive {
  const pelvis = pose.pelvis ?? R.pelvis;
  const neck = pose.neck ?? R.neck;
  const lean = (Math.atan2(neck.x - pelvis.x, pelvis.y - neck.y) * 180) / Math.PI;
  const hands: [Limb, Limb] = [limb(pose, "r_shoulder", "r_hand"), limb(pose, "l_shoulder", "l_hand")];
  const feet: [Limb, Limb] = [limb(pose, "r_hip", "r_ankle"), limb(pose, "l_hip", "l_ankle")];
  // A resting arm hangs ~128 px below the shoulder; overhead is ~250 px higher
  const raise = (-(hands[0].dy + hands[1].dy) / 2) / 160;
  const reach = Math.max(...hands.map((h) => Math.abs(h.dx))) / 140;
  return {
    rise: clamp(R.pelvis.y - pelvis.y, -80, 200),
    shift: clamp(pelvis.x - R.pelvis.x, -80, 80),
    lean: clamp(lean, -45, 45),
    front: hands,
    back: feet,
    head: limb(pose, "neck", "head"),
    armsUp: clamp(raise, -1, 1),
    reach: clamp(reach, 0, 1),
  };
}
