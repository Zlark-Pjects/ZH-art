import { useEffect, useState } from "react";
import { synth } from "../../lib/synth";

export interface AudioLevels {
  bars: number[]; // 16 bands, 0..1
  peaks: number[]; // 16 bands, 0..1, with gravity decay
  bass: number;
  mid: number;
  treble: number;
}

const BAND_COUNT = 16;
const SILENT: AudioLevels = {
  bars: new Array(BAND_COUNT).fill(0),
  peaks: new Array(BAND_COUNT).fill(0),
  bass: 0,
  mid: 0,
  treble: 0,
};

// Log-ish mapping of FFT bins to 16 bands, with gain to compensate treble roll-off
function bandRange(i: number, binCount: number): [number, number, number] {
  if (i < 4) return [i + 1, i + 2, 1.25];
  if (i < 9) return [5 + (i - 4) * 2, 7 + (i - 4) * 2, 1.0];
  if (i < 13) return [15 + (i - 9) * 6, 21 + (i - 9) * 6, 1.45];
  const start = 39 + (i - 13) * 23;
  return [start, Math.min(binCount - 1, start + 23), 1.95];
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Samples the synth's analyser at ~30 fps while `active`. Each consumer runs
 * its own loop so only the components that react to audio re-render.
 */
export function useAudioLevels(active: boolean): AudioLevels {
  const [levels, setLevels] = useState<AudioLevels>(SILENT);

  useEffect(() => {
    if (!active) {
      setLevels(SILENT);
      return;
    }
    const analyser = synth.getAnalyser();
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let last = 0;
    let peaks = new Array(BAND_COUNT).fill(0);

    const loop = (t: number) => {
      frame = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      analyser.getByteFrequencyData(data);
      const bars: number[] = [];
      for (let i = 0; i < BAND_COUNT; i++) {
        const [start, end, gain] = bandRange(i, data.length);
        let sum = 0;
        let count = 0;
        for (let bin = start; bin < end; bin++) {
          sum += data[bin] ?? 0;
          count++;
        }
        bars.push(Math.min(1, ((count ? sum / count : 0) * gain) / 255));
      }
      peaks = peaks.map((p, i) => (bars[i] >= p ? bars[i] : Math.max(0, p - 0.018)));
      setLevels({
        bars,
        peaks,
        bass: Math.min(1, (average(bars.slice(0, 5)) * 255) / 220),
        mid: Math.min(1, (average(bars.slice(5, 11)) * 255) / 180),
        treble: Math.min(1, (average(bars.slice(11)) * 255) / 140),
      });
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return levels;
}
