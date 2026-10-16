/* Tiny synthesised sound effects: no files, created on the first sound after a user gesture. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: { osc: OscillatorNode; gain: GainNode } | null = null;
let muted = false;

function audio() {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (m) engineHum(0, 0);
  if (master) master.gain.value = m ? 0 : 0.35;
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.2, slideTo?: number, delay = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, freq = 1200) {
  const a = audio();
  if (!a || !master) return;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  coin: () => {
    tone(988, 0.07, "square", 0.12);
    tone(1319, 0.12, "square", 0.12, undefined, 0.06);
  },
  jump: () => tone(320, 0.14, "triangle", 0.2, 640),
  shoot: () => tone(720, 0.09, "square", 0.08, 240),
  pop: () => {
    noise(0.18, 0.35, 2400);
    tone(500, 0.12, "triangle", 0.15, 120);
  },
  hurt: () => tone(220, 0.18, "sawtooth", 0.15, 110),
  crash: () => noise(0.45, 0.5, 700),
  build: () => [0, 0.12, 0.24].forEach((d) => tone(180, 0.08, "square", 0.15, 120, d)),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.12, undefined, i * 0.09)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.15, undefined, i * 0.14)),
  page: () => tone(660, 0.2, "sine", 0.18, 990),
  right: () => [660, 880].forEach((f, i) => tone(f, 0.12, "square", 0.1, undefined, i * 0.08)),
  wrong: () => tone(200, 0.3, "sawtooth", 0.12, 140),
  flip: () => tone(600, 0.25, "triangle", 0.15, 1400),
  honk: () => {
    tone(392, 0.18, "square", 0.05);
    tone(494, 0.18, "square", 0.04);
  },
};

/** A low engine drone that follows speed; 0 volume silences it. */
export function engineHum(speed01: number, vol: number) {
  const a = vol > 0 ? audio() : ctx;
  if (!a || !master) return;
  if (!engine) {
    if (vol <= 0) return;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "sawtooth";
    gain.gain.value = 0;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    osc.connect(f).connect(gain).connect(master);
    osc.start();
    engine = { osc, gain };
  }
  engine.osc.frequency.setTargetAtTime(55 + speed01 * 110, a.currentTime, 0.08);
  engine.gain.gain.setTargetAtTime(muted ? 0 : vol, a.currentTime, 0.1);
}
