import type { Storyboard } from "../../types";
import { renderSoundtrack } from "../../lib/soundtrack";
import { sceneStarts } from "../timeline/timeline";
import { drawFilm, prepareAssets, type ExportOptions, type ExportResult } from "./recordStoryboard";

/*
 * Frame-perfect export with WebCodecs: every frame is drawn and encoded in
 * turn, as fast as the device allows (usually several times faster than
 * real time), so nothing is dropped and the tab doesn't need to stay in
 * front. The soundtrack is rendered offline and muxed alongside. Browsers
 * without WebCodecs fall back to the real-time MediaRecorder export.
 */

export interface FastFormat {
  video: "avc" | "vp9" | "vp8";
  audio: "aac" | "opus" | null;
  extension: "mp4" | "webm";
  label: string;
}

/** The best format this browser can encode frame by frame, or null. */
export async function fastExportFormat(width: number, height: number, fps: number, bitrate: number): Promise<FastFormat | null> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return null;
  try {
    const mb = await import("mediabunny");
    // H.264 first (plays everywhere, usually hardware); then VP8, whose software encoder is
    // tens of times faster than VP9's, which can be slower than real time
    const video = (await mb.getFirstEncodableVideoCodec(["avc", "vp8", "vp9"], { width, height, bitrate, frameRate: fps })) as FastFormat["video"] | null;
    if (!video) return null;
    const mp4 = video === "avc";
    const audio = (await mb.getFirstEncodableAudioCodec(mp4 ? ["aac", "opus"] : ["opus"], { numberOfChannels: 2, sampleRate: 48000, bitrate: 192_000 })) as FastFormat["audio"];
    return { video, audio, extension: mp4 ? "mp4" : "webm", label: `${mp4 ? "MP4 · H.264" : `WebM · ${video.toUpperCase()}`} · frame by frame` };
  } catch {
    return null;
  }
}

export async function encodeFilm(
  board: Storyboard,
  canvas: HTMLCanvasElement,
  opts: ExportOptions,
  format: FastFormat,
  onProgress: (fraction: number, stage: "sound" | "frames" | "saving") => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const mb = await import("mediabunny");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a drawing surface.");
  const images = await prepareAssets(opts.backdrops);
  const { total } = sceneStarts(board.scenes);
  const scratch = document.createElement("canvas");

  const output = new mb.Output({ format: format.extension === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(), target: new mb.BufferTarget() });
  // "realtime" picks the encoders' fast presets: software VP9 is many times slower in "quality" mode
  const video = new mb.CanvasSource(canvas, { codec: format.video, bitrate: Math.round(opts.bitrateMbps * 1_000_000), keyFrameInterval: 2, latencyMode: "realtime" });
  output.addVideoTrack(video, { frameRate: opts.fps });
  const withSound = opts.withAudio && format.audio && (opts.score || opts.song);
  const audio = withSound ? new mb.AudioBufferSource({ codec: format.audio!, bitrate: 192_000 }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  const abort = async () => {
    await output.cancel().catch(() => undefined);
    throw new DOMException("Export cancelled", "AbortError");
  };

  try {
    if (audio) {
      onProgress(0, "sound");
      const sound = await renderSoundtrack({
        seconds: total,
        score: opts.score ? { vibe: board.musicVibe, scale: opts.scale, bpm: opts.bpm } : null,
        song: opts.song,
      });
      if (signal.aborted) await abort();
      await audio.add(sound);
      audio.close();
    }

    const frames = Math.max(1, Math.round(total * opts.fps));
    let lastYield = performance.now();
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) await abort();
      const t = i / opts.fps;
      drawFilm(ctx, board.scenes, t, images, opts, scratch);
      await video.add(t, 1 / opts.fps);
      // Let the page breathe so progress paints and Cancel stays clickable
      if (performance.now() - lastYield > 50) {
        onProgress(i / frames, "frames");
        await new Promise((r) => setTimeout(r, 0));
        lastYield = performance.now();
      }
    }
    video.close();
    onProgress(1, "saving");
    await output.finalize();
  } catch (err) {
    if ((err as any)?.name !== "AbortError") await output.cancel().catch(() => undefined);
    throw err;
  }

  const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
  if (!buffer) throw new Error("The video came out empty.");
  const mimeType = format.extension === "mp4" ? "video/mp4" : "video/webm";
  return { blob: new Blob([buffer], { type: mimeType }), mimeType, extension: format.extension };
}
