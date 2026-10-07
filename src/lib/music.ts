import { synth } from "./synth";

/*
 * Songs on the music track: decode, find the beats, draw a waveform
 * overview, and play through the studio mixer so the song is heard with the
 * picture, drives the audio-reactive visuals, and lands in exported videos.
 * Everything runs on this device.
 */

export const MAX_SONG_MB = 40;

export interface SongAnalysis {
  duration: number;
  bpm: number;
  beats: number[];
  peaks: number[];
}

const buffers = new Map<string, Promise<AudioBuffer>>();

function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  const Offline = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const ctx: BaseAudioContext = Offline ? new Offline(1, 1, 44100) : synth.getContext()!;
  return ctx.decodeAudioData(data);
}

/** Decoded audio for a stored song (decoded once, then cached). */
export function loadSong(assetId: string, dataUrl: string): Promise<AudioBuffer> {
  let p = buffers.get(assetId);
  if (!p) {
    p = fetch(dataUrl)
      .then((r) => r.arrayBuffer())
      .then(decode);
    p.catch(() => buffers.delete(assetId));
    buffers.set(assetId, p);
  }
  return p;
}

/** Read and decode a song file the user picked. */
export async function readSong(file: File): Promise<{ dataUrl: string; buffer: AudioBuffer }> {
  if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i.test(file.name)) throw new Error("That file isn't audio. Try an MP3, WAV or M4A.");
  if (file.size > MAX_SONG_MB * 1024 * 1024) throw new Error(`That song is over ${MAX_SONG_MB} MB. Try a shorter or more compressed file.`);
  const data = await file.arrayBuffer();
  let buffer: AudioBuffer;
  try {
    buffer = await decode(data.slice(0));
  } catch {
    throw new Error("This browser can't play that audio format. Try an MP3 or WAV.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  return { dataUrl, buffer };
}

/* ---------- Analysis ---------- */

const FRAME_RATE = 100; // onset envelope frames per second
const PEAKS_PER_SECOND = 20;

/**
 * Tempo and beat grid from an onset-strength envelope: autocorrelation picks
 * the beat period (biased towards ~120 bpm), then the phase with the most
 * onset energy on it, then each beat settles onto its nearest onset.
 */
export function analyseSong(buffer: AudioBuffer): SongAnalysis {
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const hop = Math.round(sr / FRAME_RATE);
  const frames = Math.floor(n / hop);

  // RMS per frame (mono mix)
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = start; i < start + hop; i += 2) {
      let v = 0;
      for (const ch of channels) v += ch[i];
      v /= channels.length;
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / (hop / 2));
  }

  // Onset strength: rising energy, minus its local average
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, rms[f] - rms[f - 1]);
  const win = 25;
  const flux = new Float32Array(frames);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += onset[f];
    if (f >= win) acc -= onset[f - win];
    const mean = acc / Math.min(f + 1, win);
    flux[f] = Math.max(0, onset[f] - mean);
  }

  // Tempo by autocorrelation over 70-180 bpm, on up to the first 90 s
  const span = Math.min(frames, FRAME_RATE * 90);
  const minLag = Math.round((60 / 180) * FRAME_RATE);
  const maxLag = Math.round((60 / 70) * FRAME_RATE);
  const scores: number[] = [];
  let bestLag = Math.round((60 / 120) * FRAME_RATE);
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < span; f++) s += flux[f] * flux[f - lag];
    const weight = Math.exp(-0.5 * Math.pow(Math.log2(lag / 50) / 0.9, 2));
    scores[lag] = s;
    if (s * weight > best) {
      best = s * weight;
      bestLag = lag;
    }
  }
  // Sub-frame period by parabolic interpolation
  let period = bestLag;
  const a = scores[bestLag - 1];
  const b = scores[bestLag];
  const c = scores[bestLag + 1];
  if (a !== undefined && c !== undefined) {
    const denom = a - 2 * b + c;
    if (denom !== 0) period = bestLag + Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom));
  }

  // Phase: the offset whose grid collects the most onset energy
  let phase = 0;
  let phaseScore = -Infinity;
  for (let p = 0; p < period; p++) {
    let s = 0;
    for (let k = p; k < frames; k += period) s += flux[Math.round(k)] ?? 0;
    if (s > phaseScore) {
      phaseScore = s;
      phase = p;
    }
  }

  const beats: number[] = [];
  const nudge = 3;
  for (let k = phase; k < frames; k += period) {
    const centre = Math.round(k);
    let at = centre;
    for (let f = Math.max(0, centre - nudge); f <= Math.min(frames - 1, centre + nudge); f++) if (flux[f] > flux[at]) at = f;
    beats.push(Math.round((at / FRAME_RATE) * 1000) / 1000);
  }

  // Waveform overview
  const buckets = Math.min(6000, Math.max(1, Math.round(buffer.duration * PEAKS_PER_SECOND)));
  const per = Math.max(1, Math.floor(n / buckets));
  const raw: number[] = [];
  let max = 0;
  for (let k = 0; k < buckets; k++) {
    let peak = 0;
    const start = k * per;
    for (let i = start; i < Math.min(n, start + per); i += 16) {
      for (const ch of channels) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
    }
    raw.push(peak);
    if (peak > max) max = peak;
  }
  const peaks = raw.map((v) => Math.round((max ? v / max : 0) * 100) / 100);

  return { duration: buffer.duration, bpm: Math.round((60 * FRAME_RATE) / period), beats, peaks };
}

/** Waveform buckets per second of song, for drawing. */
export const peaksPerSecond = (duration: number, peaks: number[]) => peaks.length / Math.max(0.001, duration);

/* ---------- Playback ---------- */

let current: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

/** Change the playing song's level without restarting it. */
export function setSongVolume(volume: number) {
  const ctx = synth.getContext();
  if (!current || !ctx) return;
  current.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) / 0.45, ctx.currentTime, 0.03);
}

/**
 * Play `buffer` from `at` seconds into the song. With `record`, the song is
 * also fed to the export recording. `endIn` fades it out over the last
 * second before that many seconds from now.
 */
export function playSong(buffer: AudioBuffer, at: number, volume: number, opts: { record?: boolean; endIn?: number } = {}) {
  stopSong();
  const ctx = synth.getContext();
  const out = synth.getOutput();
  if (!ctx || !out || at >= buffer.duration) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  // The master bus is at 0.45; songs arrive mastered, so lift them back to full level
  const level = Math.max(0, Math.min(1, volume)) / 0.45;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(level, now + 0.03);
  if (opts.endIn !== undefined && opts.endIn > 0) {
    const fade = Math.min(1, opts.endIn / 2);
    gain.gain.setValueAtTime(level, now + opts.endIn - fade);
    gain.gain.linearRampToValueAtTime(0, now + opts.endIn);
  }
  source.connect(gain);
  gain.connect(out);
  if (opts.record) {
    const rec = synth.getRecordInput();
    if (rec) {
      // The record tap applies 0.45 like the master bus, so match the monitor level
      const recGain = ctx.createGain();
      recGain.gain.value = 0.45;
      gain.connect(recGain);
      recGain.connect(rec);
    }
  }
  source.start(now, Math.max(0, at));
  current = { source, gain };
}

export function stopSong() {
  if (!current) return;
  const { source, gain } = current;
  current = null;
  try {
    const ctx = synth.getContext();
    if (ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);
      source.stop(ctx.currentTime + 0.05);
    } else {
      source.stop();
    }
  } catch {
    /* already stopped */
  }
}
