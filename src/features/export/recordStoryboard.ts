import { synth } from "../../lib/synth";
import type { CharacterLook, Grade, RigClip, Scene, Storyboard } from "../../types";
import { RIG_FLOOR } from "../../project/rig";
import { drawOps } from "../../project/forge/figure";
import { FRAME_H, FRAME_W, castFigures, computeFrame, gradeFilter } from "../storyboard/sceneModel";

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  bitrateMbps: number;
  withAudio: boolean;
  bpm: number;
  scale: string;
  backdrops: Record<number, string>;
  characters: CharacterLook[];
  clips: RigClip[];
  grade: Grade;
}

export interface DrawExtras {
  characters: CharacterLook[];
  clips: RigClip[];
  grade: Grade;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
}

// Prefer H.264 MP4 (plays everywhere), then WebM. A bare "video/mp4" can mean
// VP9-in-MP4 in Chromium builds without H.264, so it's the last resort (Safari).
const CANDIDATE_TYPES: { mimeType: string; extension: "mp4" | "webm"; label: string }[] = [
  { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4", label: "MP4 · H.264" },
  { mimeType: "video/mp4;codecs=avc1.42E01E,opus", extension: "mp4", label: "MP4 · H.264" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm", label: "WebM · VP9" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM · VP8" },
  { mimeType: "video/webm", extension: "webm", label: "WebM" },
  { mimeType: "video/mp4", extension: "mp4", label: "MP4" },
];

/** The container this browser can record, or null if MediaRecorder is unavailable. */
export function supportedRecordingType(): { mimeType: string; extension: "mp4" | "webm"; label: string } | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t.mimeType)) ?? null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Cross-origin images must allow CORS, or they would taint the canvas and break recording
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/** Draw one frame of `scene` at `t` seconds onto a canvas of any size. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  t: number,
  backdrop: HTMLImageElement | null,
  fadeIn: number,
  extras: DrawExtras,
) {
  const { width: w, height: h } = ctx.canvas;
  const frame = computeFrame(scene, t, { bass: 0, mid: 0, treble: 0 });
  const figures = castFigures(scene, t, extras.characters, extras.clips);
  // Colour grade (canvas filters are supported in Chromium and Firefox)
  ctx.filter = gradeFilter(extras.grade);

  // Fit the 1600x900 frame like object-fit: cover
  const s = Math.max(w / FRAME_W, h / FRAME_H);
  const ox = (w - FRAME_W * s) / 2;
  const oy = (h - FRAME_H * s) / 2;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);

  const grad = ctx.createLinearGradient(0, 0, FRAME_W, FRAME_H);
  frame.gradient.forEach((c, i) => grad.addColorStop(frame.gradient.length > 1 ? i / (frame.gradient.length - 1) : 0, c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);

  if (backdrop) {
    const bs = Math.max(FRAME_W / backdrop.width, FRAME_H / backdrop.height);
    ctx.drawImage(backdrop, (FRAME_W - backdrop.width * bs) / 2, (FRAME_H - backdrop.height * bs) / 2, backdrop.width * bs, backdrop.height * bs);
  }

  frame.layers.forEach((layer, li) => {
    ctx.save();
    ctx.translate(FRAME_W / 2 + layer.dx, FRAME_H / 2 + layer.dy);
    ctx.scale(layer.zoom, layer.zoom);
    ctx.translate(-FRAME_W / 2, -FRAME_H / 2);
    for (const item of layer.items) {
      ctx.save();
      ctx.globalAlpha = item.opacity;
      ctx.translate(item.x, item.y);
      ctx.rotate((item.rotate * Math.PI) / 180);
      ctx.scale(item.scale, item.scale);
      ctx.translate(-50, -50);
      const path = new Path2D(item.d);
      if (item.stroked) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.strokeWidth;
        ctx.lineCap = "round";
        ctx.stroke(path);
      } else {
        ctx.fillStyle = item.color;
        ctx.fill(path);
      }
      ctx.restore();
    }
    if (li === 1) {
      for (const f of figures) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.flip ? -f.scale : f.scale, f.scale);
        ctx.translate(-200, -RIG_FLOOR);
        drawOps(ctx, f.ops);
        ctx.restore();
      }
    }
    ctx.restore();
  });

  ctx.fillStyle = frame.particleColor;
  for (const p of frame.particles) {
    ctx.globalAlpha = p.alpha * frame.particleOpacity;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (extras.grade.tintAmount > 0) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = extras.grade.tintAmount / 100;
    ctx.fillStyle = extras.grade.tint;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // Vignette (elliptical, like the SVG radial gradient)
  ctx.save();
  ctx.translate(FRAME_W / 2, FRAME_H * 0.45);
  ctx.scale(FRAME_W, FRAME_H);
  const vig = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.75);
  vig.addColorStop(0.5, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${Math.min(1, (extras.grade.vignette / 100) * 1.6)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.restore();
  ctx.filter = "none";

  // Title card, sized to the output frame
  const pad = w * 0.045;
  const shade = ctx.createLinearGradient(0, h * 0.45, 0, h);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  const base = Math.min(w, h * 1.78);
  const titleSize = Math.max(28, base * 0.07);
  const narrSize = Math.max(16, base * 0.022);
  ctx.textBaseline = "alphabetic";

  ctx.font = `italic ${narrSize}px "Instrument Serif", Georgia, serif`;
  const narr = wrapLines(ctx, scene.narration, w - pad * 2, 2);
  let y = h - pad;
  ctx.fillStyle = "rgba(237,234,227,0.85)";
  for (let i = narr.length - 1; i >= 0; i--) {
    ctx.fillText(narr[i], pad, y);
    y -= narrSize * 1.3;
  }

  ctx.font = `${titleSize}px Anton, Impact, sans-serif`;
  y -= titleSize * 0.2;
  const title = wrapLines(ctx, scene.title.toUpperCase(), w - pad * 2, 2);
  ctx.fillStyle = "#edeae3";
  for (let i = title.length - 1; i >= 0; i--) {
    ctx.fillText(title[i], pad, y);
    y -= titleSize * 0.9;
  }

  ctx.font = `${Math.max(11, base * 0.011)}px "Geist Mono", monospace`;
  ctx.fillStyle = "rgba(237,234,227,0.7)";
  ctx.fillText(`SCENE ${String(scene.sceneNumber).padStart(2, "0")}`, pad, y - titleSize * 0.04);

  if (fadeIn < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - fadeIn})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Plays the storyboard onto a canvas in real time and records it, with the
 * procedural score, using MediaRecorder. Takes as long as the storyboard runs.
 */
export async function recordStoryboard(
  board: Storyboard,
  canvas: HTMLCanvasElement,
  opts: ExportOptions,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const format = supportedRecordingType();
  if (!format) throw new Error("This browser can't record video. Try a recent Chrome, Edge, Firefox or Safari.");

  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a drawing surface.");

  await Promise.all([
    document.fonts?.load(`64px Anton`),
    document.fonts?.load(`italic 24px "Instrument Serif"`),
    document.fonts?.load(`12px "Geist Mono"`),
  ]).catch(() => undefined);

  const images: Record<number, HTMLImageElement | null> = {};
  await Promise.all(
    Object.entries(opts.backdrops).map(async ([i, src]) => {
      images[Number(i)] = await loadImage(src);
    }),
  );

  const starts: number[] = [];
  let total = 0;
  for (const s of board.scenes) {
    starts.push(total);
    total += s.duration;
  }
  const sceneAt = (t: number) => {
    let i = board.scenes.length - 1;
    while (i > 0 && starts[i] > t) i--;
    return i;
  };

  drawScene(ctx, board.scenes[0], 0, images[0] ?? null, 0, opts);
  const stream = canvas.captureStream(opts.fps);
  if (opts.withAudio) {
    const audio = synth.getRecordingStream();
    audio?.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: Math.round(opts.bitrateMbps * 1_000_000),
    audioBitsPerSecond: 192_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  if (opts.withAudio) synth.start(board.musicVibe, opts.scale, opts.bpm);
  recorder.start(1000);
  const startedAt = performance.now();

  await new Promise<void>((resolve, reject) => {
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      resolve();
    };
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(frame);
      reject(new DOMException("Export cancelled", "AbortError"));
    }, { once: true });
    const loop = () => {
      const t = (performance.now() - startedAt) / 1000;
      if (t >= total) return finish();
      const i = sceneAt(t);
      const local = t - starts[i];
      drawScene(ctx, board.scenes[i], local, images[i] ?? null, Math.min(1, local / 0.4), opts);
      onProgress(t / total);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }).finally(() => {
    if (opts.withAudio) synth.stop();
    if (recorder.state !== "inactive") recorder.stop();
    stream.getVideoTracks().forEach((track) => track.stop());
  });

  await stopped;
  onProgress(1);
  return { blob: new Blob(chunks, { type: format.mimeType.split(";")[0] }), mimeType: format.mimeType, extension: format.extension };
}
