import type { MusicTrack, Scene, TextClip, TransitionKind } from "../../types";

/*
 * Timeline maths shared by the live stage, the timeline editor and the
 * video exporter, so what you see while editing is what gets recorded.
 */

export const TRANSITION_SECONDS = 0.6;
export const MIN_SCENE_SECONDS = 1;

export const TRANSITIONS: { id: TransitionKind; label: string; hint: string }[] = [
  { id: "cut", label: "Cut", hint: "Straight cut" },
  { id: "fade", label: "Fade", hint: "Cross-dissolve" },
  { id: "wipe", label: "Wipe", hint: "New scene sweeps in from the left" },
  { id: "zoom", label: "Zoom", hint: "Push through the old scene" },
  { id: "flash", label: "Flash", hint: "White flash on the cut" },
];

export function sceneStarts(scenes: Scene[]) {
  const starts: number[] = [];
  let t = 0;
  for (const s of scenes) {
    starts.push(t);
    t += s.duration;
  }
  return { starts, total: t };
}

/** Scene index and local time at film time `t`. */
export function locate(scenes: Scene[], t: number) {
  const { starts, total } = sceneStarts(scenes);
  const clamped = Math.max(0, Math.min(total - 1e-6, t));
  let i = scenes.length - 1;
  while (i > 0 && starts[i] > clamped) i--;
  return { index: i, local: clamped - starts[i] };
}

export function transitionSeconds(scene: Scene) {
  return Math.min(TRANSITION_SECONDS, scene.duration / 2);
}

/** The transition playing into scene `index` at its local time, or null. */
export function transitionAt(scenes: Scene[], index: number, local: number) {
  const scene = scenes[index];
  const kind = scene?.transition ?? "cut";
  if (index === 0 || kind === "cut") return null;
  const span = transitionSeconds(scene);
  if (local >= span) return null;
  const prev = scenes[index - 1];
  return { kind, progress: Math.max(0, local / span), prevIndex: index - 1, prevLocal: prev.duration + local };
}

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** How the outgoing scene is drawn over the incoming one. */
export function transitionLook(kind: TransitionKind, p: number) {
  const e = easeInOut(p);
  switch (kind) {
    case "fade":
      return { prevOpacity: 1 - e, revealLeft: 0, prevScale: 1, flash: 0 };
    case "wipe":
      return { prevOpacity: 1, revealLeft: e, prevScale: 1, flash: 0 };
    case "zoom":
      return { prevOpacity: 1 - e, revealLeft: 0, prevScale: 1 + e * 0.7, flash: 0 };
    case "flash":
      return { prevOpacity: p < 0.5 ? 1 : 0, revealLeft: 0, prevScale: 1, flash: p < 0.5 ? p * 2 : (1 - p) * 2 };
    default:
      return { prevOpacity: 0, revealLeft: 0, prevScale: 1, flash: 0 };
  }
}

/* ---------- Text ---------- */

export const TEXT_IN = 0.4;
export const TEXT_OUT = 0.3;

/** Frame-height fractions for each font and size. */
export const TEXT_SIZES: Record<TextClip["font"], Record<TextClip["size"], number>> = {
  display: { s: 0.06, m: 0.095, l: 0.14 },
  serif: { s: 0.045, m: 0.065, l: 0.095 },
  sans: { s: 0.035, m: 0.05, l: 0.075 },
};

export const TEXT_Y: Record<TextClip["position"], number> = { top: 0.14, middle: 0.5, bottom: 0.84 };

const backOut = (p: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

/** Animation state of a text clip at film time `t`, or null when it's off screen. */
export function textState(clip: TextClip, t: number) {
  const a = t - clip.start;
  const r = clip.start + clip.duration - t;
  if (a < 0 || r <= 0) return null;
  const pin = Math.min(1, a / TEXT_IN);
  const out = Math.min(1, r / TEXT_OUT);
  let opacity = out;
  let scale = 1;
  let dy = 0;
  let chars = clip.text.length;
  if (clip.animation === "fade") opacity *= pin;
  if (clip.animation === "pop") {
    opacity *= Math.min(1, pin * 3);
    scale = 0.55 + 0.45 * backOut(pin);
  }
  if (clip.animation === "slide") {
    const p = Math.min(1, a / 0.55);
    opacity *= Math.min(1, p * 2);
    dy = (1 - (1 - Math.pow(1 - p, 3))) * 0.06;
  }
  if (clip.animation === "typewriter") chars = Math.min(clip.text.length, Math.floor(a * 26));
  return { opacity, scale, dy, chars };
}

export function textsAt(texts: TextClip[] | undefined, t: number) {
  if (!texts?.length) return [];
  return texts.map((clip) => ({ clip, state: textState(clip, t) })).filter((x): x is { clip: TextClip; state: NonNullable<ReturnType<typeof textState>> } => Boolean(x.state));
}

/* ---------- Beats ---------- */

/** Beat times on the film's clock: the song's beats, or the score's tempo grid. */
export function beatGrid(music: MusicTrack | null | undefined, bpm: number, total: number): number[] {
  if (music?.beats.length) return music.beats.map((b) => b - music.offset).filter((b) => b >= 0 && b <= total + 2);
  const step = 60 / Math.max(40, bpm);
  const out: number[] = [];
  for (let b = 0; b <= total + 2; b += step) out.push(Math.round(b * 1000) / 1000);
  return out;
}

/** Nearest beat to `t` within `tolerance` seconds, else `t`. */
export function snapToBeat(t: number, beats: number[], tolerance: number) {
  let best = t;
  let dist = tolerance;
  for (const b of beats) {
    const d = Math.abs(b - t);
    if (d < dist) {
      dist = d;
      best = b;
    }
    if (b > t + tolerance) break;
  }
  return best;
}

/** Durations with every cut moved onto its nearest beat (each scene stays at least 1 s). */
export function cutsOnBeats(scenes: Scene[], beats: number[]): number[] {
  const { starts } = sceneStarts(scenes);
  const ends = scenes.map((s, i) => starts[i] + s.duration);
  const out: number[] = [];
  let prevEnd = 0;
  const shift = { by: 0 };
  ends.forEach((rawEnd) => {
    // Earlier cuts moving carries later scenes along, so each keeps its length
    const end = rawEnd + shift.by;
    const candidates = beats.filter((b) => b >= prevEnd + MIN_SCENE_SECONDS && Math.abs(b - end) <= 1);
    let snapped = end;
    // Past the end of the song there are no beats nearby: leave that cut alone
    if (candidates.length) snapped = candidates.reduce((x, y) => (Math.abs(y - end) < Math.abs(x - end) ? y : x));
    shift.by += snapped - end;
    const dur = Math.max(MIN_SCENE_SECONDS, Math.round((snapped - prevEnd) * 1000) / 1000);
    out.push(dur);
    prevEnd += dur;
  });
  return out;
}

export function newTextClip(start: number, total: number): TextClip {
  const duration = Math.min(3, Math.max(1, total - start));
  return {
    id: `txt_${Math.random().toString(36).slice(2, 9)}`,
    text: "Your words here",
    start: Math.max(0, Math.min(start, total - duration)),
    duration,
    animation: "pop",
    font: "display",
    position: "middle",
    size: "m",
    box: false,
  };
}
