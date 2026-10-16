/* The car radio: music generated live with Web Audio, no files. Two stations — Lo-fi (soft
   drums, jazzy chords) and Synthwave (driving bass, arpeggios) — plus Off. */

export type Station = "off" | "lofi" | "synth";

interface StationDef {
  bpm: number;
  swing: number;
  chords: number[][];
  bass: "soft" | "pulse";
  arp: boolean;
  pad: OscillatorType;
}

const STATIONS: Record<Exclude<Station, "off">, StationDef> = {
  // Fmaj7 – Em7 – Dm7 – Cmaj7
  lofi: { bpm: 82, swing: 0.18, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: "soft", arp: false, pad: "triangle" },
  // Am – F – C – G
  synth: { bpm: 104, swing: 0, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: "pulse", arp: true, pad: "sawtooth" },
};

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Radio {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer = 0;
  private step = 0;
  private next = 0;
  private noise: AudioBuffer | null = null;
  station: Station = "off";
  volume = 0.5;

  private ensure() {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.out = this.ctx.createGain();
    this.out.gain.value = 0;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 6000;
    this.filter.connect(this.out).connect(this.ctx.destination);
    const n = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  /** Switch station (call from a click so the browser allows sound). */
  play(station: Station) {
    this.station = station;
    if (station === "off") {
      if (this.out && this.ctx) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      window.clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    const ctx = this.ensure();
    if (!ctx || !this.out) return;
    void ctx.resume().catch(() => {});
    this.out.gain.setTargetAtTime(0.16 * this.volume, ctx.currentTime, 0.4);
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 50);
  }

  /** Muffle the music when you're on foot, open it up in a vehicle. */
  setInside(inside: boolean) {
    if (this.filter && this.ctx) this.filter.frequency.setTargetAtTime(inside ? 7000 : 900, this.ctx.currentTime, 0.3);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.out && this.ctx && this.station !== "off") this.out.gain.setTargetAtTime(0.16 * v, this.ctx.currentTime, 0.2);
  }

  stop() {
    this.play("off");
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.station === "off") return;
    const def = STATIONS[this.station];
    const sixteenth = 60 / def.bpm / 4;
    while (this.next < ctx.currentTime + 0.2) {
      const s = this.step % 64;
      const swing = s % 2 ? def.swing * sixteenth : 0;
      this.tick(def, s, this.next + swing, sixteenth);
      this.next += sixteenth;
      this.step++;
    }
  }

  private tick(def: StationDef, s: number, t: number, len: number) {
    const chord = def.chords[Math.floor(s / 16) % def.chords.length];
    const beat = s % 16;
    // Drums
    if (beat === 0 || beat === 8 || (def.bass === "pulse" && beat % 4 === 0) || (def.bass === "soft" && beat === 10)) this.kick(t);
    if (beat === 4 || beat === 12) this.snare(t, def.bass === "pulse" ? 0.32 : 0.18);
    if (beat % 2 === 0 || def.bass === "pulse") this.hat(t, beat % 4 === 2 ? 0.09 : 0.05);
    // Chords: a pad at the start of each bar
    if (beat === 0) for (const n of chord) this.note(freq(n), t, len * 15, def.pad, def.pad === "sawtooth" ? 0.035 : 0.05, 0.3);
    // Bass
    if (def.bass === "pulse" ? beat % 2 === 0 : beat === 0 || beat === 7) this.note(freq(chord[0] - 24), t, def.bass === "pulse" ? len * 1.6 : len * 6, def.bass === "pulse" ? "sawtooth" : "sine", def.bass === "pulse" ? 0.12 : 0.22, 0.01);
    // Arpeggio
    if (def.arp && beat % 2 === 0) this.note(freq(chord[(beat / 2) % chord.length] + 12), t, len * 1.2, "square", 0.03, 0.005);
    if (!def.arp && (beat === 6 || beat === 14) && Math.random() < 0.5) this.note(freq(chord[Math.floor(Math.random() * chord.length)] + 12), t, len * 4, "sine", 0.06, 0.01);
  }

  private note(f: number, t: number, dur: number, type: OscillatorType, vol: number, attack: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + 0.32);
  }

  private burst(t: number, vol: number, dur: number, hp: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.filter!);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  private snare(t: number, vol: number) {
    this.burst(t, vol, 0.18, 1500);
  }

  private hat(t: number, vol: number) {
    this.burst(t, vol, 0.04, 7000);
  }
}
