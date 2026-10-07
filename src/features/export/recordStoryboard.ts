import { synth } from "../../lib/synth";
import { playSong, stopSong } from "../../lib/music";
import type { CharacterLook, Grade, RigClip, Scene, Storyboard, TextClip } from "../../types";
import { TEXT_SIZES, TEXT_Y, locate, sceneStarts, textsAt, transitionAt, transitionLook } from "../timeline/timeline";
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
  texts?: TextClip[];
  titleCards?: boolean;
  /** Play the generated score */
  score: boolean;
  /** The music track's song, decoded */
  song: { buffer: AudioBuffer; offset: number; volume: number } | null;
}

export interface DrawExtras {
  characters: CharacterLook[];
  clips: RigClip[];
  grade: Grade;
  texts?: TextClip[];
  titleCards?: boolean;
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

// One scratch picture per output canvas, for grading a whole frame in a single pass
const pictureBuffers = new WeakMap<HTMLCanvasElement | OffscreenCanvas, HTMLCanvasElement>();

/** Draw one frame of `scene` at `t` seconds onto a canvas of any size. */
export function drawScene(
  outCtx: CanvasRenderingContext2D,
  scene: Scene,
  t: number,
  backdrop: HTMLImageElement | null,
  fadeIn: number,
  extras: DrawExtras,
) {
  const { width: w, height: h } = outCtx.canvas;
  const frame = computeFrame(scene, t, { bass: 0, mid: 0, treble: 0 });
  const figures = castFigures(scene, t, extras.characters, extras.clips);
  // Colour grade: a canvas filter on every shape is very slow, so the picture is drawn
  // unfiltered and graded once as a whole (and not at all when the grade is neutral)
  const graded = extras.grade.contrast !== 100 || extras.grade.saturation !== 100;
  let ctx = outCtx;
  if (graded) {
    let buf = pictureBuffers.get(outCtx.canvas);
    if (!buf) {
      buf = document.createElement("canvas");
      pictureBuffers.set(outCtx.canvas, buf);
    }
    if (buf.width !== w || buf.height !== h) {
      buf.width = w;
      buf.height = h;
    }
    ctx = buf.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
  }

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
  if (graded) {
    outCtx.filter = gradeFilter(extras.grade);
    outCtx.drawImage(ctx.canvas, 0, 0);
    outCtx.filter = "none";
  }

  if (extras.titleCards !== false) drawTitleCard(outCtx, scene);

  if (fadeIn < 1) {
    outCtx.fillStyle = `rgba(0,0,0,${1 - fadeIn})`;
    outCtx.fillRect(0, 0, w, h);
  }
}

/** The scene's title and narration, lower left, sized to the output frame. */
function drawTitleCard(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { width: w, height: h } = ctx.canvas;
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
}

const TEXT_FONTS: Record<TextClip["font"], { font: (px: number) => string; lineHeight: number; upper: boolean }> = {
  display: { font: (px) => `${px}px Anton, Impact, sans-serif`, lineHeight: 0.92, upper: true },
  serif: { font: (px) => `italic ${px}px "Instrument Serif", Georgia, serif`, lineHeight: 1.05, upper: false },
  sans: { font: (px) => `600 ${px}px Geist, system-ui, sans-serif`, lineHeight: 1.1, upper: false },
};

/** Text-track clips at film time `t`, matching the live TextLayer. */
export function drawTexts(ctx: CanvasRenderingContext2D, texts: TextClip[] | undefined, t: number) {
  const visible = textsAt(texts, t);
  if (!visible.length) return;
  const { width: w, height: h } = ctx.canvas;
  // Sizes are fractions of a 16:9 frame's height; tall and square frames use their width
  const frameH = Math.min(w, h * (16 / 9)) * (9 / 16);
  for (const { clip, state } of visible) {
    const spec = TEXT_FONTS[clip.font];
    const px = TEXT_SIZES[clip.font][clip.size] * frameH;
    ctx.save();
    ctx.font = spec.font(px);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const full = spec.upper ? clip.text.toUpperCase() : clip.text;
    const lines = full.split("\n").flatMap((para) => wrapLines(ctx, para, w * 0.86, 6));
    const lh = px * spec.lineHeight;
    const yc = (TEXT_Y[clip.position] + state.dy) * h;
    ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity));
    ctx.translate(w / 2, yc);
    ctx.scale(state.scale, state.scale);
    const top = -((lines.length - 1) * lh) / 2;
    if (clip.box) {
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const bw = widest + px;
      const bh = lines.length * lh + px * 0.4;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(-bw / 2, top - lh / 2 - px * 0.2, bw, bh, px * 0.12);
      ctx.fill();
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = px * 0.25;
      ctx.shadowOffsetY = px * 0.04;
    }
    ctx.fillStyle = "#edeae3";
    let remaining = state.chars;
    lines.forEach((line, k) => {
      if (remaining <= 0) return;
      const shown = line.slice(0, remaining);
      remaining -= line.length + 1;
      // Typewriter text grows from the left of its final, centred position
      const x = shown.length < line.length ? -ctx.measureText(line).width / 2 + ctx.measureText(shown).width / 2 : 0;
      ctx.fillText(shown, x, top + k * lh);
    });
    ctx.restore();
  }
}

/** One finished frame of the film at time `t`: scene, transition, text. */
export function drawFilm(
  ctx: CanvasRenderingContext2D,
  scenes: Scene[],
  t: number,
  images: Record<number, HTMLImageElement | null>,
  extras: DrawExtras,
  scratch: HTMLCanvasElement,
) {
  const { index, local } = locate(scenes, t);
  const { width: w, height: h } = ctx.canvas;
  drawScene(ctx, scenes[index], local, images[index] ?? null, index === 0 ? Math.min(1, local / 0.4) : 1, extras);
  const tr = transitionAt(scenes, index, local);
  if (tr) {
    const look = transitionLook(tr.kind, tr.progress);
    if (look.prevOpacity > 0) {
      if (scratch.width !== w || scratch.height !== h) {
        scratch.width = w;
        scratch.height = h;
      }
      const sctx = scratch.getContext("2d")!;
      sctx.clearRect(0, 0, w, h);
      // The outgoing scene leaves without its title card, so two titles never overlap
      drawScene(sctx, scenes[tr.prevIndex], tr.prevLocal, images[tr.prevIndex] ?? null, 1, { ...extras, titleCards: false });
      ctx.save();
      ctx.globalAlpha = look.prevOpacity;
      if (look.revealLeft > 0) {
        ctx.beginPath();
        ctx.rect(look.revealLeft * w, 0, w, h);
        ctx.clip();
      }
      if (look.prevScale !== 1) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(look.prevScale, look.prevScale);
        ctx.translate(-w / 2, -h / 2);
      }
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    }
    if (look.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${look.flash})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  drawTexts(ctx, extras.texts, t);
}

/** Load the fonts the film draws with, and its backdrop images. */
export async function prepareAssets(backdrops: Record<number, string>) {
  await Promise.all([
    document.fonts?.load(`64px Anton`),
    document.fonts?.load(`italic 24px "Instrument Serif"`),
    document.fonts?.load(`12px "Geist Mono"`),
    document.fonts?.load(`600 24px Geist`),
  ]).catch(() => undefined);
  const images: Record<number, HTMLImageElement | null> = {};
  await Promise.all(
    Object.entries(backdrops).map(async ([i, src]) => {
      images[Number(i)] = await loadImage(src);
    }),
  );
  return images;
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

  const images = await prepareAssets(opts.backdrops);

  const { total } = sceneStarts(board.scenes);
  const scratch = document.createElement("canvas");

  drawFilm(ctx, board.scenes, 0, images, opts, scratch);
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

  recorder.start(1000);
  if (opts.withAudio && opts.score) synth.start(board.musicVibe, opts.scale, opts.bpm);
  if (opts.withAudio && opts.song) playSong(opts.song.buffer, opts.song.offset, opts.song.volume, { record: true, endIn: total });
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
      drawFilm(ctx, board.scenes, t, images, opts, scratch);
      onProgress(t / total);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }).finally(() => {
    if (opts.withAudio) {
      synth.stop();
      stopSong();
    }
    if (recorder.state !== "inactive") recorder.stop();
    stream.getVideoTracks().forEach((track) => track.stop());
  });

  await stopped;
  onProgress(1);
  return { blob: new Blob(chunks, { type: format.mimeType.split(";")[0] }), mimeType: format.mimeType, extension: format.extension };
}
