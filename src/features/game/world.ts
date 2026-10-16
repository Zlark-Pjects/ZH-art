/* Stickville's world: one long side-on strip. Town (flat, build plots) → hills (race track,
   a mountain) → desert (the military zone). y grows downward, like the canvas. */

export const WORLD_W = 10000;
export const TOWN_END = 2800;
export const HILLS_END = 5600;
export const PLOT_COUNT = 9;
export const PLOT_W = 220;
export const plotLeft = (i: number) => 300 + i * 270;
export const plotCenter = (i: number) => plotLeft(i) + PLOT_W / 2;

export const SPAWN_X = 150;
export const DEPOT_X = 2745;
export const RACE_START = 2950;
export const RACE_END = 5550;
export const WATCHTOWER_X = 7600;
export const OUTPOST_X = 9300;
/** Pixels per metre, for the speedometer: a stick figure is about 1.7 m tall. */
export const PX_PER_M = 38;

export interface Ramp {
  /** The lip: where the ramp launches you. */
  x: number;
  w: number;
  h: number;
  /** 1 launches rightward, -1 leftward. */
  dir: 1 | -1;
}

export const FIXED_RAMPS: Ramp[] = [
  { x: 3420, w: 170, h: 75, dir: 1 },
  { x: 5100, w: 150, h: 62, dir: 1 },
  { x: 6690, w: 190, h: 90, dir: 1 },
  { x: 8360, w: 160, h: 70, dir: 1 },
];

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

function baseGround(x: number) {
  if (x < TOWN_END) return 0;
  if (x < HILLS_END) {
    const t = x - TOWN_END;
    const env = smooth(t / 300) * smooth((HILLS_END - x) / 300);
    const mountain = -250 * Math.exp(-(((x - 4400) / 380) ** 2));
    return env * (-55 * (1 - Math.cos(t / 170)) - 30 * Math.sin(t / 83)) + mountain;
  }
  const t = x - HILLS_END;
  return smooth(t / 300) * (-26 * (1 - Math.cos(t / 260)) - 10 * Math.sin(t / 97));
}

export function rampHeight(ramps: Ramp[], x: number) {
  let h = 0;
  for (const r of ramps) {
    const d = (x - r.x) * r.dir;
    if (d >= -r.w && d <= 0) h = Math.max(h, r.h * (1 + d / r.w));
    else if (d > 0 && d <= r.w * 0.3) h = Math.max(h, r.h * (1 - d / (r.w * 0.3)));
  }
  return h;
}

export class Terrain {
  ramps: Ramp[];
  constructor(userRamps: Ramp[]) {
    this.ramps = [...FIXED_RAMPS, ...userRamps];
  }
  base(x: number) {
    return baseGround(x);
  }
  y(x: number) {
    return baseGround(x) - rampHeight(this.ramps, x);
  }
  slope(x: number) {
    return (this.y(x + 3) - this.y(x - 3)) / 6;
  }
}

export type Zone = "town" | "hills" | "desert";
export const zoneAt = (x: number): Zone => (x < TOWN_END ? "town" : x < HILLS_END ? "hills" : "desert");
