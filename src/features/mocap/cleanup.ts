import { STANDING_POSE, type Pose } from "../../project/rig";

/*
 * Clean-up for motion-capture takes, from the webcam or a video file:
 * trim, smoothing, foot lock, and resampling to evenly spaced keys.
 * The raw take is kept, so every setting can be changed after capture.
 */

export interface RawTake {
  frames: Pose[];
  /** Seconds from the start of the take, one per frame */
  times: number[];
  source: "webcam" | "video";
}

export interface CleanupOptions {
  /** Trim, seconds into the take */
  start: number;
  end: number;
  /** 0 = raw, 1 = very smooth */
  smoothing: number;
  /** Keep feet on the floor and still while they're planted */
  footLock: boolean;
  /** Keys per second in the result */
  fps: number;
}

export const DEFAULT_CLEANUP: Omit<CleanupOptions, "start" | "end"> = { smoothing: 0.35, footLock: true, fps: 12 };

const FLOOR_Y = STANDING_POSE.l_ankle.y;
const ANKLES = ["l_ankle", "r_ankle"] as const;

export const takeDuration = (take: RawTake) => (take.times.length ? take.times[take.times.length - 1] : 0);

const lerpPose = (a: Pose, b: Pose, k: number): Pose =>
  Object.fromEntries(Object.keys(a).map((id) => [id, { x: a[id].x + ((b[id] ?? a[id]).x - a[id].x) * k, y: a[id].y + ((b[id] ?? a[id]).y - a[id].y) * k }]));

function trim(take: RawTake, start: number, end: number) {
  const frames: Pose[] = [];
  const times: number[] = [];
  take.times.forEach((t, i) => {
    if (t >= start - 1e-6 && t <= end + 1e-6) {
      frames.push(take.frames[i]);
      times.push(t - start);
    }
  });
  return { frames, times };
}

/** Gaussian smoothing over time (handles uneven frame spacing). */
function smooth(frames: Pose[], times: number[], amount: number): Pose[] {
  const sigma = amount * 0.16;
  if (sigma < 0.01 || frames.length < 3) return frames;
  return frames.map((_, i) => {
    const out: Pose = {};
    let total = 0;
    const acc: Record<string, { x: number; y: number }> = {};
    for (let j = 0; j < frames.length; j++) {
      const d = times[j] - times[i];
      if (Math.abs(d) > sigma * 3) continue;
      const w = Math.exp(-(d * d) / (2 * sigma * sigma));
      total += w;
      for (const [id, p] of Object.entries(frames[j])) {
        const a = (acc[id] ??= { x: 0, y: 0 });
        a.x += p.x * w;
        a.y += p.y * w;
      }
    }
    for (const [id, a] of Object.entries(acc)) out[id] = { x: a.x / total, y: a.y / total };
    return out;
  });
}

/**
 * Foot lock. Captures are anchored at the hips, so a crouch would lift the
 * feet: each frame is lowered until the lower foot touches the floor. Then a
 * foot that's barely moving near the floor is pinned in place, which removes
 * jitter and skating.
 */
function lockFeet(frames: Pose[], times: number[]): Pose[] {
  const grounded = frames.map((f) => {
    const low = Math.max(f.l_ankle?.y ?? FLOOR_Y, f.r_ankle?.y ?? FLOOR_Y);
    const dy = FLOOR_Y - low;
    return Object.fromEntries(Object.entries(f).map(([id, p]) => [id, { x: p.x, y: p.y + dy }])) as Pose;
  });
  for (const ankle of ANKLES) {
    let segStart = -1;
    const close = (from: number, to: number) => {
      if (to - from < 1 || times[to] - times[from] < 0.12) return;
      let mx = 0;
      for (let k = from; k <= to; k++) mx += grounded[k][ankle].x;
      mx /= to - from + 1;
      for (let k = from; k <= to; k++) grounded[k][ankle] = { x: mx, y: FLOOR_Y };
    };
    for (let i = 0; i < grounded.length; i++) {
      const p = grounded[i][ankle];
      const prev = grounded[Math.max(0, i - 1)][ankle];
      const dt = Math.max(1 / 60, times[i] - times[Math.max(0, i - 1)]);
      const planted = p.y > FLOOR_Y - 14 && Math.hypot(p.x - prev.x, p.y - prev.y) / dt < 70;
      if (planted && segStart < 0) segStart = i;
      if (!planted && segStart >= 0) {
        close(segStart, i - 1);
        segStart = -1;
      }
    }
    if (segStart >= 0) close(segStart, grounded.length - 1);
  }
  return grounded;
}

/** Evenly spaced keys from uneven frames. */
function resample(frames: Pose[], times: number[], fps: number) {
  const duration = times[times.length - 1];
  const count = Math.max(2, Math.round(duration * fps) + 1);
  const keys: Pose[] = [];
  const keyTimes: number[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const t = Math.min(duration, k / fps);
    while (j < times.length - 2 && times[j + 1] < t) j++;
    const span = times[j + 1] - times[j] || 1;
    keys.push(lerpPose(frames[j], frames[j + 1] ?? frames[j], Math.max(0, Math.min(1, (t - times[j]) / span))));
    keyTimes.push(Math.round(t * 1000) / 1000);
  }
  return { keys, keyTimes };
}

/** The cleaned-up take as keys, ready for the rig. */
export function processTake(take: RawTake, opts: CleanupOptions) {
  const cut = trim(take, opts.start, opts.end);
  if (cut.frames.length < 2) return null;
  let frames = smooth(cut.frames, cut.times, opts.smoothing);
  if (opts.footLock) frames = lockFeet(frames, cut.times);
  const { keys, keyTimes } = resample(frames, cut.times, opts.fps);
  return { keys, keyTimes, length: keyTimes[keyTimes.length - 1] + 1 / opts.fps };
}
