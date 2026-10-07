// Procedural Web Audio API Synthesizer & Sequencer for ZH-art

class SynthEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying = false;
  private isMuted = false;
  private timerId: any = null;
  
  // Audio nodes for volume mixing
  private masterGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private arpGain: GainNode | null = null;
  private drumGain: GainNode | null = null;

  // Music parameters
  private bpm = 100;
  private scale: number[] = [0, 2, 4, 7, 9]; // Pentatonic major root offsets by default
  private rootNote = 48; // C3
  private currentStep = 0;
  private nextStepTime = 0.0;
  private scheduleAheadTime = 0.1; // seconds ahead to schedule
  private lookahead = 25.0; // milliseconds between scheduling checks
  
  // Mood / vibe presets
  private currentVibe = "ambient";
  private beatCallback: ((step: number) => void) | null = null;

  // Chord progression (root note offset from C3)
  // Standard cinematic chord loops (e.g., I - VI - IV - V or Cyberpunk Phrygian progression)
  private progressions: Record<string, number[][]> = {
    synthwave: [[0, 0, 0, 0], [-2, -2, -2, -2], [3, 3, 3, 3], [5, 5, 5, 5]], // Cm, Bb, Eb, F
    ambient: [[0], [7], [5], [3]], // Airy atmospheric drifts
    cinematic: [[0, 0], [-4, -4], [-2, -2], [5, 5]], // Epic cinematic progression
    lofi: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 6, 9, 13]], // M7 chords
    chiptune: [[0], [3], [5], [7]], // Energetic gaming loops
  };

  private scalesMap: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9], // Ultra harmonious
    phrygian: [0, 1, 3, 5, 7, 8, 10], // Seductive / Dark Cyberpunk
  };

  constructor() {
    // Audio Context is initialized lazily on user gesture
  }

  public init() {
    if (this.ctx) return;
    
    // Create audio context supporting standards
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create master analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    
    // Master gain node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
    
    // Submix gain nodes for instruments
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.4;
    
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0.55;
    
    this.arpGain = this.ctx.createGain();
    this.arpGain.gain.value = 0.35;
    
    this.drumGain = this.ctx.createGain();
    this.drumGain.gain.value = 0.5;

    // Connect mixing network
    this.bassGain.connect(this.masterGain);
    this.padGain.connect(this.masterGain);
    this.arpGain.connect(this.masterGain);
    this.drumGain.connect(this.masterGain);
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  public start(vibe: string, scaleName: string, bpm: number, onBeat?: (step: number) => void) {
    this.init();
    if (this.isPlaying) this.stop();
    
    this.isPlaying = true;
    this.currentVibe = vibe;
    this.updateBpm(bpm);
    this.setScale(scaleName);
    this.beatCallback = onBeat || null;
    this.currentStep = 0;

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    
    if (this.ctx) {
      this.nextStepTime = this.ctx.currentTime;
      this.scheduler();
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.45, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public updateBpm(bpm: number) {
    this.bpm = Math.max(40, Math.min(220, bpm));
  }

  public setScale(scaleName: string) {
    this.scale = this.scalesMap[scaleName] || this.scalesMap.pentatonic;
  }

  // Converts MIDI notes to frequencies
  private noteToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Main sequencer scheduler loop
  private scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  private advanceStep() {
    if (!this.ctx) return;
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    this.nextStepTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (!this.ctx) return;

    // Trigger frame animations in sync with the beats (every quarter note / step 0, 4, 8, 12)
    if (step % 4 === 0 && this.beatCallback) {
      // Run callback async to prevent Web Audio thread lag
      setTimeout(() => {
        if (this.isPlaying && this.beatCallback) {
          this.beatCallback(step);
        }
      }, 0);
    }

    // Determine chord progression based on the current vibe
    const activeProg = this.progressions[this.currentVibe] || this.progressions.ambient;
    const progressionIndex = Math.floor(step / 4) % activeProg.length;
    const chordNotes = activeProg[progressionIndex];
    const rootOffset = chordNotes[0]; // simple root note

    // 1. TRIGGER BASS (On beats 0, 4, 8, 12, or rolling 8th notes depending on mood)
    if (this.currentVibe === "synthwave") {
      // Synthwave driving eighth notes
      if (step % 2 === 0) {
        const octaveShift = step % 4 === 0 ? 0 : 12; // Octave jumping bass
        this.playBassNote(this.rootNote + rootOffset - 24 + octaveShift, time, 0.15);
      }
    } else if (this.currentVibe === "ambient") {
      // Long warm pads, trigger slow bass notes
      if (step === 0) {
        this.playBassNote(this.rootNote + rootOffset - 24, time, 3.5);
      }
    } else {
      // Cinematic/lofi classic bass beat
      if (step === 0 || step === 8 || step === 10) {
        this.playBassNote(this.rootNote + rootOffset - 24, time, 0.4);
      }
    }

    // 2. TRIGGER PAD CHORDS (On beat 0 of progression loop to create deep space atmosphere)
    if (step === 0) {
      const padNotes = chordNotes.map(n => this.rootNote + n - 12);
      this.playPadChord(padNotes, time, 3.8);
    }

    // 3. TRIGGER ARPEGGIATOR MELODY
    if (this.currentVibe === "chiptune") {
      // Rapid arcade chiptune arps (every step)
      const scaleDegree = this.scale[step % this.scale.length];
      const arpNote = this.rootNote + rootOffset + scaleDegree + 12;
      this.playArpNote(arpNote, time, 0.08, "square");
    } else if (this.currentVibe === "synthwave") {
      // Cyberpunk arpeggios
      if (step % 2 !== 0) {
        const scaleDegree = this.scale[step % this.scale.length];
        this.playArpNote(this.rootNote + rootOffset + scaleDegree + 12, time, 0.1, "sawtooth");
      }
    } else if (this.currentVibe === "lofi") {
      // Lazy, beautiful lounge notes
      if (step % 4 === 2) {
        const randIndex = Math.floor(Math.random() * this.scale.length);
        const scaleDegree = this.scale[randIndex];
        this.playArpNote(this.rootNote + rootOffset + scaleDegree + 12, time, 0.25, "sine");
      }
    } else if (this.currentVibe === "cinematic") {
      // Grand orchestral bells
      if (step === 4 || step === 10 || step === 14) {
        const scaleDegree = this.scale[Math.floor(time * 5) % this.scale.length];
        this.playArpNote(this.rootNote + rootOffset + scaleDegree + 24, time, 0.6, "triangle");
      }
    } else {
      // Ambient twinkling stars
      if (Math.random() > 0.6 && (step % 4 === 0 || step % 4 === 3)) {
        const scaleDegree = this.scale[Math.floor(Math.random() * this.scale.length)];
        this.playArpNote(this.rootNote + rootOffset + scaleDegree + 24, time, 0.8, "sine");
      }
    }

    // 4. TRIGGER PROCEDURAL DRUMS (Skip for ambient)
    if (this.currentVibe !== "ambient") {
      // KICK DRUM (Beat 1 & 3: step 0 and 8)
      if (step === 0 || step === 8) {
        this.playKick(time);
      }
      // Add a double-kick for synthwave/chiptune
      if ((this.currentVibe === "synthwave" || this.currentVibe === "chiptune") && step === 14) {
        this.playKick(time);
      }

      // SNARE / CLAP (Beat 2 & 4: step 4 and 12)
      if (step === 4 || step === 12) {
        this.playSnare(time);
      }

      // HI-HAT (Offbeats)
      if (this.currentVibe === "synthwave" || this.currentVibe === "chiptune") {
        if (step % 2 === 1) {
          this.playHihat(time, 0.03); // rapid ticks
        }
      } else if (this.currentVibe === "lofi") {
        if (step % 4 === 2 || step % 8 === 6) {
          this.playHihat(time, 0.08); // warm lazy hi-hats
        }
      }
    }
  }

  // --- INSTRUMENT GENERATORS USING NATIVE OSCILLATORS ---

  private playBassNote(note: number, time: number, duration: number) {
    if (!this.ctx || !this.bassGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = this.currentVibe === "synthwave" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(this.noteToFreq(note), time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(this.currentVibe === "synthwave" ? 280 : 150, time);
    filter.frequency.exponentialRampToValueAtTime(70, time + duration);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private playPadChord(notes: number[], time: number, duration: number) {
    if (!this.ctx || !this.padGain) return;

    const chordOscs: OscillatorNode[] = [];
    const chordGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Create a slow attack / release filter
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, time);
    filter.frequency.linearRampToValueAtTime(this.currentVibe === "synthwave" ? 1200 : 700, time + duration * 0.4);
    filter.frequency.linearRampToValueAtTime(300, time + duration);

    chordGain.gain.setValueAtTime(0, time);
    chordGain.gain.linearRampToValueAtTime(0.25, time + duration * 0.3); // Slow warm build
    chordGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    notes.forEach(note => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      // Use warm sine or detuned triangles for lush pads
      osc.type = "triangle";
      osc.frequency.setValueAtTime(this.noteToFreq(note) + (Math.random() - 0.5) * 1.5, time); // detune
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.1);
      chordOscs.push(osc);
    });

    filter.connect(chordGain);
    chordGain.connect(this.padGain);
  }

  private playArpNote(note: number, time: number, duration: number, type: OscillatorType) {
    if (!this.ctx || !this.arpGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(this.noteToFreq(note), time);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(this.currentVibe === "synthwave" ? 2200 : 1200, time);
    filter.Q.setValueAtTime(1.5, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.arpGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // Pitch-sliding sine wave for standard synth kick drum
  private playKick(time: number) {
    if (!this.ctx || !this.drumGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.8, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.drumGain);

    osc.start(time);
    osc.stop(time + 0.25);
  }

  // Filtered white noise for snare drums
  private playSnare(time: number) {
    if (!this.ctx || !this.drumGain) return;

    // Create noise buffer
    const bufferSize = this.ctx.sampleRate * 0.25; // 0.25 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(this.currentVibe === "lofi" ? 800 : 1100, time);
    filter.Q.setValueAtTime(1.2, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  // Short hi-pass filtered noise for ticks
  private playHihat(time: number, duration: number) {
    if (!this.ctx || !this.drumGain) return;

    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(8000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(time);
    noise.stop(time + duration + 0.01);
  }
}

export const synth = new SynthEngine();
export default synth;
