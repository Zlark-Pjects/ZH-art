import { synth } from "./synth";

/*
 * A film's whole soundtrack — the generated score and/or the song — rendered
 * offline in one go, for exports that encode frame by frame.
 */

export const SOUNDTRACK_RATE = 48000;

export async function renderSoundtrack(opts: {
  seconds: number;
  score: { vibe: string; scale: string; bpm: number } | null;
  song: { buffer: AudioBuffer; offset: number; volume: number } | null;
}): Promise<AudioBuffer> {
  const Offline = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const length = Math.max(1, Math.ceil(opts.seconds * SOUNDTRACK_RATE));
  const ctx: OfflineAudioContext = new Offline(2, length, SOUNDTRACK_RATE);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  // Fade the last second out, like the real-time export does
  const fade = Math.min(1, opts.seconds / 2);
  master.gain.setValueAtTime(1, Math.max(0, opts.seconds - fade));
  master.gain.linearRampToValueAtTime(0, opts.seconds);

  if (opts.score) {
    // The live mixer's master level, before mute
    const scoreBus = ctx.createGain();
    scoreBus.gain.value = 0.45;
    scoreBus.connect(master);
    synth.scheduleOffline(ctx, scoreBus, opts.score.vibe, opts.score.scale, opts.score.bpm, opts.seconds);
  }
  if (opts.song && opts.song.offset < opts.song.buffer.duration) {
    const src = ctx.createBufferSource();
    src.buffer = opts.song.buffer;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, opts.song.volume));
    src.connect(g);
    g.connect(master);
    src.start(0, opts.song.offset);
  }
  return ctx.startRendering();
}
