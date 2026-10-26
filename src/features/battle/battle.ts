/* Stickman Battle Royale: the simulation. 25 stick fighters parachute onto an island, loot
   guns and armour, and fight while the safe zone shrinks. Last one standing wins.
   Pure game logic: battle-render.ts draws it and BattleView.tsx wraps it in a page. */

export const W = 3200;
export const CX = 1600;
export const CY = 1600;
export const ISLE = 1500;
/** Ground y is squashed by K on screen (a tilted camera), like the city view. */
export const K = 0.78;
const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Data ---------- */

export type Ammo = "light" | "med" | "shell" | "snip";
export const AMMO_CAP: Record<Ammo, number> = { light: 120, med: 90, shell: 30, snip: 20 };
export const AMMO_LABEL: Record<Ammo, string> = { light: "light", med: "rifle", shell: "shells", snip: "sniper" };

export interface Gun {
  id: string;
  name: string;
  ammo: Ammo;
  dmg: number;
  rate: number;
  mag: number;
  speed: number;
  range: number;
  spread: number;
  pellets: number;
  reload: number;
  color: string;
  auto: boolean;
}
export const GUNS: Record<string, Gun> = {
  pistol: { id: "pistol", name: "Pistol", ammo: "light", dmg: 18, rate: 0.3, mag: 12, speed: 950, range: 560, spread: 0.035, pellets: 1, reload: 1.1, color: "#c9c6bd", auto: false },
  smg: { id: "smg", name: "SMG", ammo: "light", dmg: 11, rate: 0.085, mag: 30, speed: 1050, range: 460, spread: 0.085, pellets: 1, reload: 1.5, color: "#8bd1ff", auto: true },
  shotgun: { id: "shotgun", name: "Shotgun", ammo: "shell", dmg: 9, rate: 0.8, mag: 5, speed: 850, range: 290, spread: 0.2, pellets: 7, reload: 2.0, color: "#ffb454", auto: false },
  ar: { id: "ar", name: "Assault rifle", ammo: "med", dmg: 19, rate: 0.12, mag: 30, speed: 1250, range: 720, spread: 0.045, pellets: 1, reload: 1.7, color: "#9be36b", auto: true },
  sniper: { id: "sniper", name: "Sniper", ammo: "snip", dmg: 78, rate: 1.25, mag: 4, speed: 2400, range: 1500, spread: 0.004, pellets: 1, reload: 2.3, color: "#d68bff", auto: false },
};
export interface Melee {
  id: string;
  name: string;
  dmg: number;
  rate: number;
  range: number;
  color: string;
}
export const MELEE: Record<string, Melee> = {
  fists: { id: "fists", name: "Fists", dmg: 11, rate: 0.42, range: 36, color: "#f2c9a0" },
  bat: { id: "bat", name: "Bat", dmg: 26, rate: 0.62, range: 48, color: "#d9a066" },
  sword: { id: "sword", name: "Sword", dmg: 33, rate: 0.5, range: 54, color: "#cfe9ff" },
};
const gunScore = (g: Gun) => ((g.dmg * g.pellets) / Math.max(g.rate, 0.1)) * (0.6 + g.range / 1500);

export interface CharDef {
  id: string;
  name: string;
  color: string;
  skill: string;
  skillText: string;
  passive: string;
  passiveText: string;
  cd: number;
  cost: number;
}
export const CHARS: CharDef[] = [
  { id: "kai", name: "Kai", color: "#4aa8ff", skill: "Dash", skillText: "Burst forward, untouchable for an instant.", passive: "Quick feet", passiveText: "Run 10% faster.", cd: 7, cost: 0 },
  { id: "mia", name: "Mia", color: "#ff6fa5", skill: "Mend", skillText: "Heal 50 HP over 3 seconds while you move.", passive: "Second wind", passiveText: "Slowly heals when out of a fight.", cd: 18, cost: 0 },
  { id: "zed", name: "Zed", color: "#9a7bff", skill: "Ghost", skillText: "Turn invisible for 5 seconds. Shooting gives you away.", passive: "Silent step", passiveText: "Enemies spot you from 30% closer.", cd: 22, cost: 300 },
  { id: "rex", name: "Rex", color: "#f4a825", skill: "Bulwark", skillText: "A shield blocks 65% of damage for 6 seconds.", passive: "Thick plating", passiveText: "Start with 40 armor.", cd: 24, cost: 300 },
  { id: "nia", name: "Nia", color: "#3dd9a3", skill: "Radar", skillText: "See every enemy nearby on the map for 9 seconds.", passive: "Quick hands", passiveText: "Reload 25% faster.", cd: 24, cost: 350 },
  { id: "vex", name: "Vex", color: "#ff5a4d", skill: "Shockwave", skillText: "Blast nearby enemies: damage, stun and knock-back.", passive: "Brawler", passiveText: "Melee hits 30% harder.", cd: 15, cost: 400 },
];
export const MAX_LEVEL = 5;
export const upgradeCost = (level: number) => 120 * level;

export type Difficulty = "easy" | "normal" | "hard";
const DIFF = {
  easy: { sigma: 0.16, react: 0.7, turn: 6, sight: 520 },
  normal: { sigma: 0.09, react: 0.42, turn: 9, sight: 620 },
  hard: { sigma: 0.045, react: 0.22, turn: 13, sight: 720 },
};

/* ---------- Profile (kept in the browser) ---------- */

export interface Profile {
  name: string;
  coins: number;
  wins: number;
  matches: number;
  kills: number;
  best: number;
  unlocked: string[];
  levels: Record<string, number>;
  pick: string;
  difficulty: Difficulty;
}
export const newProfile = (): Profile => ({ name: "Stick", coins: 0, wins: 0, matches: 0, kills: 0, best: 25, unlocked: ["kai", "mia"], levels: {}, pick: "kai", difficulty: "normal" });
const KEY = "stickville.battle.v1";
export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    /* private window or blocked storage: start fresh */
  }
  return newProfile();
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/* ---------- World ---------- */

/** One obstacle: a wall/gel wall (rect) or a tree/rock (circle). `shot` = stops bullets and sight. */
export interface Ob {
  k: 0 | 1;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  shot: boolean;
  hp: number;
  dead: boolean;
  s: number;
  kind: "wall" | "gel" | "tree" | "rock";
}
export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  col: string;
  roof: string;
  door: number;
}
export interface Loot {
  id: number;
  x: number;
  y: number;
  kind: "gun" | "melee" | "ammo" | "kit" | "band" | "armor" | "gel" | "nade";
  key: string;
  n: number;
}
export interface GunSlot {
  id: string;
  mag: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  owner: number;
  life: number;
  color: string;
  pellet: boolean;
}
export interface Nade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  owner: number;
}
export interface Fx {
  k: "num" | "spark" | "ring" | "puff" | "text" | "flash";
  x: number;
  y: number;
  t: number;
  max: number;
  v?: number;
  s?: string;
  color?: string;
  dx?: number;
  dy?: number;
}

export interface Actor {
  id: number;
  name: string;
  bot: boolean;
  ch: string;
  level: number;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  armor: number;
  a: number;
  face: number;
  step: number;
  guns: (GunSlot | null)[];
  cur: number;
  melee: string;
  ammo: Record<Ammo, number>;
  nades: number;
  gels: number;
  kits: number;
  bands: number;
  fireT: number;
  reloadT: number;
  rollT: number;
  rollCd: number;
  rx: number;
  ry: number;
  healT: number;
  healAmt: number;
  hot: number;
  stun: number;
  skillCd: number;
  skillT: number;
  dashT: number;
  dx: number;
  dy: number;
  ghost: number;
  shield: number;
  radar: number;
  reveal: number;
  z: number;
  tx: number;
  ty: number;
  fall: number;
  alive: boolean;
  kills: number;
  dealt: number;
  hurtT: number;
  sinceHurt: number;
  swing: number;
  swingDir: number;
  combo: number;
  comboT: number;
  flash: number;
  place: number;
  diedAt: number;
  killer: string;
  // brains
  think: number;
  goalX: number;
  goalY: number;
  target: number;
  seen: number;
  react: number;
  err: number;
  strafe: number;
  strafeT: number;
  stuckT: number;
  lastX: number;
  lastY: number;
  detour: number;
  detourA: number;
  mxPrev?: boolean;
}

export interface Ctrl {
  mx: number;
  my: number;
  aim: number | null;
  fire: boolean;
  edge: Set<string>;
}
export interface BInput {
  mx: number;
  my: number;
  aim: number | null;
  fire: boolean;
  pressed: Set<string>;
}
export const newBInput = (): BInput => ({ mx: 0, my: 0, aim: null, fire: false, pressed: new Set() });

export interface Zone {
  x: number;
  y: number;
  r: number;
  fx: number;
  fy: number;
  fr: number;
  tx: number;
  ty: number;
  tr: number;
  phase: number;
  stage: "wait" | "shrink";
  t: number;
  dps: number;
}
export const PHASES = [
  { wait: 40, shrink: 30, r: 950, dps: 1 },
  { wait: 30, shrink: 25, r: 620, dps: 2 },
  { wait: 25, shrink: 20, r: 380, dps: 4 },
  { wait: 20, shrink: 18, r: 190, dps: 7 },
  { wait: 15, shrink: 15, r: 60, dps: 12 },
];

export interface MatchResult {
  place: number;
  total: number;
  kills: number;
  dealt: number;
  time: number;
  coins: number;
  win: boolean;
  killer: string;
}

const NAMES = ["Zig", "Mo", "Pixel", "Rae", "Dax", "Juno", "Boss", "Nox", "Lux", "Tilly", "Otto", "Jinx", "Bolt", "Fizz", "Gus", "Ivy", "Kip", "Lola", "Max", "Nyx", "Orla", "Pip", "Quin", "Rook", "Sky", "Tank", "Uma", "Vee", "Wren", "Yuri"];
const BUILD_COLS: [string, string][] = [
  ["#c9b79c", "#8f4b3a"],
  ["#b7c4d4", "#4a5f7a"],
  ["#d6c28a", "#6a5a2a"],
  ["#c4d4b7", "#3f6a45"],
  ["#d4b7c4", "#7a4a63"],
];
const CELL = 100;
const GRID = 33;
const WALL_T = 10;
export const WALL_H = 46;
export const PLAYERS = 25;

/* ---------- The match ---------- */

export class Battle {
  profile: Profile;
  diff: Difficulty;
  rng: () => number;
  obs: Ob[] = [];
  grid: Ob[][] = Array.from({ length: GRID * GRID }, () => []);
  stamp = 0;
  buildings: Building[] = [];
  loot: Loot[] = [];
  actors: Actor[] = [];
  bullets: Bullet[] = [];
  nades: Nade[] = [];
  fx: Fx[] = [];
  feed: { text: string; t: number }[] = [];
  banner: { text: string; t: number; color: string } | null = null;
  zone: Zone;
  airdrop: { x: number; y: number; t: number } | null = null;
  input = newBInput();
  /** How far auto-aim may bend a shot toward an enemy (radians). */
  assist = 0.08;
  you: Actor;
  time = 0;
  phase: "drop" | "play" | "over" = "drop";
  landedAt = -1;
  result: MatchResult | null = null;
  overT = 0;
  demo = false;
  hit = 0;
  kill = 0;
  nextId = 1;
  shake = 0;
  planeA: number;
  cam = { x: CX, y: CY };
  onEnd: (r: MatchResult) => void = () => {};

  constructor(profile: Profile, opts: { seed?: number; mapSeed?: number } = {}) {
    this.profile = profile;
    this.diff = profile.difficulty;
    this.rng = mulberry(opts.seed ?? (Math.random() * 1e9) | 0);
    this.buildMap(mulberry(opts.mapSeed ?? 7));
    this.zone = { x: CX, y: CY, r: 1450, fx: CX, fy: CY, fr: 1450, tx: CX, ty: CY, tr: 1450, phase: 0, stage: "wait", t: 0, dps: 1 };
    this.pickNextZone();
    this.scatterLoot();
    this.planeA = this.rng() * TAU;
    // Everyone starts on the plane's path and glides to where they want to land.
    const ids = [...CHARS.map((c) => c.id)];
    for (let i = 0; i < PLAYERS; i++) {
      const isYou = i === 0;
      const ch = isYou ? profile.pick : ids[Math.floor(this.rng() * ids.length)];
      const a = this.makeActor(isYou ? profile.name || "You" : NAMES[(i * 7 + 3) % NAMES.length] + (i > 25 ? i : ""), !isYou, ch, isYou ? profile.levels[ch] ?? 1 : 1 + Math.floor(this.rng() * 3));
      const along = (this.rng() * 2 - 1) * 1100;
      const side = (this.rng() * 2 - 1) * 160;
      const dx = Math.cos(this.planeA);
      const dy = Math.sin(this.planeA);
      a.x = CX + dx * along - dy * side;
      a.y = CY + dy * along + dx * side;
      if (isYou) {
        a.x = CX + dx * -900;
        a.y = CY + dy * -900;
      }
      a.z = 1;
      a.fall = 1 / (8 + this.rng() * 3);
      const t = this.pickLanding(a);
      a.tx = t.x;
      a.ty = t.y;
      this.actors.push(a);
    }
    this.you = this.actors[0];
    this.cam.x = this.you.x;
    this.cam.y = this.you.y;
    this.say("Steer your parachute. Land near a building!", "#ffd166");
  }

  /* ----- setup ----- */

  makeActor(name: string, bot: boolean, ch: string, level: number): Actor {
    const def = CHARS.find((c) => c.id === ch) ?? CHARS[0];
    const a: Actor = {
      id: this.nextId++, name, bot, ch, level, x: CX, y: CY, kx: 0, ky: 0, hp: 100, armor: ch === "rex" ? 40 : 0, a: this.rng() * TAU, face: 1, step: 0,
      guns: [null, null], cur: 2, melee: "fists", ammo: { light: 0, med: 0, shell: 0, snip: 0 }, nades: 0, gels: 1, kits: 0, bands: 1,
      fireT: 0, reloadT: 0, rollT: 0, rollCd: 0, rx: 0, ry: 0, healT: 0, healAmt: 0, hot: 0, stun: 0, skillCd: 0, skillT: 0, dashT: 0, dx: 0, dy: 0,
      ghost: 0, shield: 0, radar: 0, reveal: 0, z: 0, tx: CX, ty: CY, fall: 0.1, alive: true, kills: 0, dealt: 0, hurtT: 0, sinceHurt: 99, swing: 0, swingDir: 1, combo: 0, comboT: 0, flash: 0,
      place: 0, diedAt: 0, killer: "", think: this.rng() * 0.3, goalX: CX, goalY: CY, target: 0, seen: 0, react: 0, err: 0, strafe: 1, strafeT: 0, stuckT: 0, lastX: 0, lastY: 0, detour: 0, detourA: 0,
    };
    void def;
    return a;
  }

  addOb(o: Partial<Ob> & Pick<Ob, "k" | "x" | "y" | "kind">) {
    const ob: Ob = { w: 0, h: 0, r: 0, shot: true, hp: Infinity, dead: false, s: 0, ...o };
    this.obs.push(ob);
    const x0 = ob.k ? ob.x - ob.r : ob.x;
    const y0 = ob.k ? ob.y - ob.r : ob.y;
    const x1 = ob.k ? ob.x + ob.r : ob.x + ob.w;
    const y1 = ob.k ? ob.y + ob.r : ob.y + ob.h;
    for (let cy = clamp(Math.floor(y0 / CELL), 0, GRID - 1); cy <= clamp(Math.floor(y1 / CELL), 0, GRID - 1); cy++)
      for (let cx = clamp(Math.floor(x0 / CELL), 0, GRID - 1); cx <= clamp(Math.floor(x1 / CELL), 0, GRID - 1); cx++) this.grid[cy * GRID + cx].push(ob);
    return ob;
  }

  buildMap(r: () => number) {
    const spots: { x: number; y: number }[] = [{ x: CX - 80, y: CY - 60 }];
    for (let tries = 0; tries < 900 && spots.length < 27; tries++) {
      const ang = r() * TAU;
      const d = Math.sqrt(r()) * 1230;
      const p = { x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d };
      if (spots.every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 270)) spots.push(p);
    }
    for (const s of spots) {
      const w = 120 + Math.floor(r() * 70);
      const h = 96 + Math.floor(r() * 44);
      const [col, roof] = BUILD_COLS[Math.floor(r() * BUILD_COLS.length)];
      const b: Building = { x: Math.round(s.x - w / 2), y: Math.round(s.y - h / 2), w, h, col, roof, door: Math.round(b0(r, w)) };
      this.buildings.push(b);
      const gx = b.x + b.door;
      const wall = (x: number, y: number, ww: number, hh: number) => ww > 0 && hh > 0 && this.addOb({ k: 0, x, y, w: ww, h: hh, kind: "wall" });
      wall(b.x, b.y, w, WALL_T);
      wall(b.x, b.y, WALL_T, h);
      wall(b.x + w - WALL_T, b.y, WALL_T, h);
      wall(b.x, b.y + h - WALL_T, gx - b.x, WALL_T);
      wall(gx + 46, b.y + h - WALL_T, b.x + w - (gx + 46), WALL_T);
    }
    const inBuilding = (x: number, y: number, m: number) => this.buildings.some((b) => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m);
    for (let i = 0, n = 0; i < 3000 && n < 55; i++) {
      const ang = r() * TAU;
      const d = Math.sqrt(r()) * 1380;
      const x = CX + Math.cos(ang) * d;
      const y = CY + Math.sin(ang) * d;
      if (inBuilding(x, y, 40)) continue;
      this.addOb({ k: 1, x, y, r: 20 + r() * 10, kind: "rock" });
      n++;
    }
    for (let i = 0, n = 0; i < 6000 && n < 280; i++) {
      const ang = r() * TAU;
      const d = Math.sqrt(r()) * 1420;
      const x = CX + Math.cos(ang) * d;
      const y = CY + Math.sin(ang) * d;
      if (inBuilding(x, y, 30) || this.obs.some((o) => o.k === 1 && Math.hypot(o.x - x, o.y - y) < o.r + 26)) continue;
      this.addOb({ k: 1, x, y, r: 11, shot: false, kind: "tree" });
      n++;
    }
  }

  pickNextZone() {
    const z = this.zone;
    const ph = PHASES[Math.min(z.phase, PHASES.length - 1)];
    const off = Math.max(0, z.r - ph.r - 20) * Math.sqrt(this.rng());
    const ang = this.rng() * TAU;
    z.fx = z.x;
    z.fy = z.y;
    z.fr = z.r;
    z.tx = z.x + Math.cos(ang) * off;
    z.ty = z.y + Math.sin(ang) * off;
    z.tr = z.phase >= PHASES.length ? z.r : ph.r;
  }

  drop(kind: Loot["kind"], key: string, n: number, x: number, y: number) {
    this.loot.push({ id: this.nextId++, x, y, kind, key, n });
  }
  randomLoot(x: number, y: number) {
    const r = this.rng();
    if (r < 0.3) {
      const w = ["pistol", "pistol", "smg", "smg", "shotgun", "ar", "ar", "sniper"][Math.floor(this.rng() * 8)];
      this.drop("gun", w, GUNS[w].mag, x, y);
    } else if (r < 0.34) this.drop("melee", this.rng() < 0.65 ? "bat" : "sword", 1, x, y);
    else if (r < 0.62) {
      const t = (["light", "light", "med", "med", "shell", "snip"] as Ammo[])[Math.floor(this.rng() * 6)];
      this.drop("ammo", t, t === "light" ? 30 : t === "med" ? 30 : t === "shell" ? 8 : 6, x, y);
    } else if (r < 0.76) this.drop(this.rng() < 0.4 ? "kit" : "band", "", 1, x, y);
    else if (r < 0.85) this.drop("armor", "", this.rng() < 0.7 ? 50 : 100, x, y);
    else if (r < 0.93) this.drop("gel", "", 1, x, y);
    else this.drop("nade", "", 1, x, y);
  }
  scatterLoot() {
    for (const b of this.buildings) {
      for (let i = 0; i < 3; i++) this.randomLoot(b.x + WALL_T + 14 + this.rng() * (b.w - 2 * WALL_T - 28), b.y + WALL_T + 14 + this.rng() * (b.h - 2 * WALL_T - 28));
      this.randomLoot(b.x + b.door + 23, b.y + b.h + 18);
    }
    for (let i = 0; i < 140; i++) {
      const ang = this.rng() * TAU;
      const d = Math.sqrt(this.rng()) * 1380;
      const x = CX + Math.cos(ang) * d;
      const y = CY + Math.sin(ang) * d;
      if (!this.collide(x, y, 10)) this.randomLoot(x, y);
    }
  }

  pickLanding(a: Actor) {
    if (!a.bot) return { x: a.x, y: a.y };
    if (this.rng() < 0.65) {
      const b = this.buildings[Math.floor(this.rng() * this.buildings.length)];
      return { x: b.x + b.w / 2, y: b.y + b.h + 30 };
    }
    const ang = this.rng() * TAU;
    const d = Math.sqrt(this.rng()) * 1250;
    return { x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d };
  }

  /* ----- geometry ----- */

  near(x0: number, y0: number, x1: number, y1: number): Ob[] {
    const out: Ob[] = [];
    this.stamp++;
    const ax = clamp(Math.floor(Math.min(x0, x1) / CELL), 0, GRID - 1);
    const bx = clamp(Math.floor(Math.max(x0, x1) / CELL), 0, GRID - 1);
    const ay = clamp(Math.floor(Math.min(y0, y1) / CELL), 0, GRID - 1);
    const by = clamp(Math.floor(Math.max(y0, y1) / CELL), 0, GRID - 1);
    for (let cy = ay; cy <= by; cy++)
      for (let cx = ax; cx <= bx; cx++)
        for (const o of this.grid[cy * GRID + cx]) {
          if (o.s === this.stamp || o.dead) continue;
          o.s = this.stamp;
          out.push(o);
        }
    return out;
  }

  /** Does a circle at (x,y) with radius r overlap anything solid, or fall off the island? */
  collide(x: number, y: number, r: number) {
    if (Math.hypot(x - CX, y - CY) > ISLE - r) return true;
    for (const o of this.near(x - r, y - r, x + r, y + r)) {
      if (o.k === 1) {
        if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true;
      } else {
        const nx = clamp(x, o.x, o.x + o.w);
        const ny = clamp(y, o.y, o.y + o.h);
        if (Math.hypot(x - nx, y - ny) < r) return true;
      }
    }
    return false;
  }

  /** Where along the segment (0..1) does it first touch this obstacle? -1 if it doesn't. */
  segHit(o: Ob, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (o.k === 1) {
      const fx = x1 - o.x;
      const fy = y1 - o.y;
      const a = dx * dx + dy * dy;
      if (a === 0) return -1;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - o.r * o.r;
      if (c <= 0) return 0;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return -1;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      return t >= 0 && t <= 1 ? t : -1;
    }
    let t0 = 0;
    let t1 = 1;
    for (const [p, q, lo, hi] of [[dx, x1, o.x, o.x + o.w], [dy, y1, o.y, o.y + o.h]] as const) {
      if (Math.abs(p) < 1e-9) {
        if (q < lo || q > hi) return -1;
      } else {
        let ta = (lo - q) / p;
        let tb = (hi - q) / p;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return -1;
      }
    }
    return t0;
  }

  /** The first thing a straight shot would hit before reaching (x2,y2): obstacle or null. */
  rayBlock(x1: number, y1: number, x2: number, y2: number) {
    for (const o of this.near(x1, y1, x2, y2)) if (o.shot && this.segHit(o, x1, y1, x2, y2) >= 0) return o;
    return null;
  }

  move(a: Actor, dx: number, dy: number) {
    const r = 11;
    if (!this.collide(a.x + dx, a.y, r)) a.x += dx;
    if (!this.collide(a.x, a.y + dy, r)) a.y += dy;
  }

  /* ----- feedback ----- */

  say(text: string, color = "#fff") {
    this.banner = { text, t: 3, color };
  }
  feedAdd(text: string) {
    this.feed.unshift({ text, t: 6 });
    this.feed.length = Math.min(this.feed.length, 5);
  }
  num(x: number, y: number, v: number, color: string) {
    this.fx.push({ k: "num", x, y, t: 0, max: 0.8, v, color });
  }
  sparks(x: number, y: number, color = "#ffe08a", n = 4) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU;
      this.fx.push({ k: "spark", x, y, t: 0, max: 0.25 + this.rng() * 0.2, dx: Math.cos(a) * 120, dy: Math.sin(a) * 120, color });
    }
  }
  ring(x: number, y: number, r: number, color: string, max = 0.5) {
    this.fx.push({ k: "ring", x, y, t: 0, max, v: r, color });
  }

  /* ----- actions ----- */

  charLevel(a: Actor) {
    return a.level;
  }
  gun(a: Actor): Gun | null {
    const s = a.cur < 2 ? a.guns[a.cur] : null;
    return s ? GUNS[s.id] : null;
  }
  cdMul(a: Actor) {
    return 1 - 0.05 * (this.charLevel(a) - 1);
  }
  eff(a: Actor) {
    return 1 + 0.1 * (this.charLevel(a) - 1);
  }

  useSkill(a: Actor) {
    if (a.skillCd > 0 || a.stun > 0 || a.z > 0 || !a.alive) return;
    const def = CHARS.find((c) => c.id === a.ch) ?? CHARS[0];
    const f = this.eff(a);
    a.skillCd = def.cd * this.cdMul(a);
    this.ring(a.x, a.y, 40, def.color, 0.4);
    switch (a.ch) {
      case "kai": {
        const c = a.dx || a.dy ? Math.hypot(a.dx, a.dy) : 0;
        const dx = c ? a.dx / c : Math.cos(a.a);
        const dy = c ? a.dy / c : Math.sin(a.a);
        a.dashT = 0.18;
        a.dx = dx * (220 * f) / 0.18;
        a.dy = dy * (220 * f) / 0.18;
        a.rollT = 0.18;
        break;
      }
      case "mia":
        a.skillT = 3; // healed a little every frame in step()
        break;
      case "zed":
        a.ghost = 5 * f;
        break;
      case "rex":
        a.shield = 6 * f;
        break;
      case "nia":
        a.radar = 9 * f;
        break;
      case "vex": {
        const R = 140 * f;
        this.ring(a.x, a.y, R, def.color, 0.45);
        this.shake = 0.3;
        for (const t of this.actors) {
          if (t === a || !t.alive || t.z > 0) continue;
          const d = Math.hypot(t.x - a.x, t.y - a.y);
          if (d > R) continue;
          const ang = Math.atan2(t.y - a.y, t.x - a.x);
          t.kx += Math.cos(ang) * 420;
          t.ky += Math.sin(ang) * 420;
          t.stun = Math.max(t.stun, 1.8);
          this.damage(t, 22 * f, a, "Shockwave");
        }
        break;
      }
    }
    if (a === this.you) this.say(def.skill + "!", def.color);
  }

  /** Rolling and dashing can't be hit. */
  invuln(t: Actor) {
    return t.rollT > 0.1 || t.dashT > 0;
  }

  damage(t: Actor, amount: number, src: Actor | null, weapon: string, dirx = 0, diry = 0) {
    if (!t.alive || t.z > 0) return;
    if (this.invuln(t)) return;
    if (t.shield > 0) amount *= 0.35;
    const plating = t.ch === "rex" ? 0.6 : 0.5;
    const absorb = Math.min(t.armor, amount * plating);
    t.armor -= absorb;
    amount -= absorb;
    t.hp -= amount;
    t.hurtT = 0.15;
    t.sinceHurt = 0;
    if (amount >= 1) {
      t.healT = 0;
      t.healAmt = 0;
    }
    if (src && src !== t) src.dealt += amount + absorb;
    this.num(t.x, t.y - 50, Math.round(amount + absorb), t === this.you ? "#ff6b6b" : "#fff");
    if (src === this.you && t !== this.you) this.hit = 0.15;
    if (t === this.you) this.shake = Math.max(this.shake, 0.12);
    if (dirx || diry) {
      t.kx += dirx * 40;
      t.ky += diry * 40;
    }
    if (t.hp <= 0) this.die(t, src, weapon);
  }

  die(t: Actor, src: Actor | null, weapon: string) {
    t.alive = false;
    t.hp = 0;
    t.diedAt = this.time;
    t.killer = src && src !== t ? src.name : "the zone";
    const left = this.actors.filter((a) => a.alive).length;
    t.place = left + 1;
    if (src && src !== t) {
      src.kills++;
      if (src === this.you) {
        this.kill = 1.6;
        this.say(`You eliminated ${t.name}`, "#ffd166");
      }
    }
    this.feedAdd(src && src !== t ? `${src.name} › ${t.name}  (${weapon})` : `${t.name} was caught by the zone`);
    // Drop their kit where they fell
    t.guns.forEach((g) => g && this.drop("gun", g.id, g.mag, t.x + (this.rng() - 0.5) * 30, t.y + (this.rng() - 0.5) * 20));
    (Object.keys(t.ammo) as Ammo[]).forEach((k) => t.ammo[k] > 4 && this.drop("ammo", k, Math.floor(t.ammo[k] / 2), t.x + (this.rng() - 0.5) * 40, t.y + (this.rng() - 0.5) * 24));
    if (t.kits) this.drop("kit", "", t.kits, t.x, t.y + 10);
    if (t.armor > 20) this.drop("armor", "", t.armor > 60 ? 100 : 50, t.x + 14, t.y + 6);
    this.sparks(t.x, t.y - 30, "#ff8a8a", 10);
    if (t === this.you) {
      this.phase = "over";
      this.overT = 0;
      this.finish(false);
    } else if (this.you.alive && left === 1) {
      this.phase = "over";
      this.overT = 0;
      this.finish(true);
    }
  }

  finish(win: boolean) {
    const you = this.you;
    const place = win ? 1 : you.place;
    const bonus = place === 1 ? 250 : place <= 3 ? 120 : place <= 5 ? 80 : place <= 10 ? 40 : 10;
    const coins = you.kills * 25 + bonus + Math.floor(this.time / 15);
    this.result = { place, total: PLAYERS, kills: you.kills, dealt: Math.round(you.dealt), time: Math.round(this.time), coins, win, killer: you.killer };
    const p = this.profile;
    p.coins += coins;
    p.matches++;
    p.kills += you.kills;
    p.wins += win ? 1 : 0;
    p.best = Math.min(p.best, place);
    saveProfile(p);
    this.onEnd(this.result);
  }

  reload(a: Actor) {
    const g = this.gun(a);
    const s = a.cur < 2 ? a.guns[a.cur] : null;
    if (!g || !s || a.reloadT > 0 || s.mag >= g.mag || a.ammo[g.ammo] <= 0) return;
    a.reloadT = g.reload * (a.ch === "nia" ? 0.75 : 1);
  }

  tryHeal(a: Actor) {
    if (a.healT > 0 || a.hp >= 100 || a.stun > 0) return;
    if (a.kits > 0 && (a.hp <= 50 || a.bands === 0)) {
      a.kits--;
      a.healT = 2.4;
      a.healAmt = 60;
    } else if (a.bands > 0) {
      a.bands--;
      a.healT = 1;
      a.healAmt = 18;
    }
  }

  throwNade(a: Actor, ang: number) {
    if (a.nades <= 0 || a.stun > 0) return;
    a.nades--;
    this.nades.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, t: 1.5, owner: a.id });
  }

  placeGel(a: Actor) {
    if (a.gels <= 0 || a.stun > 0) return;
    const horiz = Math.abs(Math.sin(a.a)) > Math.abs(Math.cos(a.a));
    const cx = a.x + Math.cos(a.a) * 34;
    const cy = a.y + Math.sin(a.a) * 34;
    const w = horiz ? 64 : 14;
    const h = horiz ? 14 : 64;
    const x = cx - w / 2;
    const y = cy - h / 2;
    if (this.actors.some((o) => o.alive && o.z === 0 && o.x > x - 12 && o.x < x + w + 12 && o.y > y - 12 && o.y < y + h + 12)) return;
    if (Math.hypot(cx - CX, cy - CY) > ISLE - 40) return;
    a.gels--;
    this.addOb({ k: 0, x, y, w, h, kind: "gel", hp: 240 });
    this.sparks(cx, cy, "#7fe3ff", 8);
  }

  melee(a: Actor) {
    const m = MELEE[a.melee];
    if (a.fireT > 0 || a.stun > 0) return;
    a.fireT = m.rate;
    a.swing = 0.22;
    a.swingDir *= -1;
    a.comboT = 0.8;
    let hit = false;
    for (const t of this.actors) {
      if (t === a || !t.alive || t.z > 0) continue;
      const d = Math.hypot(t.x - a.x, t.y - a.y);
      if (d > m.range + 12) continue;
      if (Math.cos(wrap(Math.atan2(t.y - a.y, t.x - a.x) - a.a)) < 0.2 && d > 20) continue;
      if (this.rayBlock(a.x, a.y, t.x, t.y)) continue;
      a.combo++;
      const finisher = a.combo % 3 === 0;
      let dmg = m.dmg * (a.ch === "vex" ? 1.3 : 1) * (finisher ? 1.6 : 1);
      dmg *= 1 + 0.02 * (a.level - 1);
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      t.kx += Math.cos(ang) * (finisher ? 360 : 150);
      t.ky += Math.sin(ang) * (finisher ? 360 : 150);
      if (finisher) t.stun = Math.max(t.stun, 0.5);
      this.damage(t, dmg, a, m.name);
      this.sparks(t.x, t.y - 30, finisher ? "#ffd166" : "#fff", finisher ? 8 : 4);
      hit = true;
    }
    if (!hit) a.combo = 0;
  }

  shoot(a: Actor, ang: number) {
    const g = this.gun(a);
    const s = a.cur < 2 ? a.guns[a.cur] : null;
    if (!g || !s || a.fireT > 0 || a.reloadT > 0 || a.stun > 0 || a.rollT > 0) return;
    if (s.mag <= 0) {
      this.reload(a);
      return;
    }
    s.mag--;
    a.fireT = g.rate;
    a.flash = 0.06;
    a.reveal = 1.2;
    a.healT = 0;
    const kick = g.id === "sniper" ? 90 : g.id === "shotgun" ? 60 : 12;
    a.kx -= Math.cos(ang) * kick;
    a.ky -= Math.sin(ang) * kick;
    for (let i = 0; i < g.pellets; i++) {
      const sp = (this.rng() - 0.5) * 2 * g.spread;
      const aa = ang + sp;
      this.bullets.push({ x: a.x + Math.cos(aa) * 16, y: a.y + Math.sin(aa) * 16, vx: Math.cos(aa) * g.speed, vy: Math.sin(aa) * g.speed, dmg: g.dmg, owner: a.id, life: g.range * (0.92 + this.rng() * 0.16), color: g.color, pellet: g.pellets > 1 });
    }
    if (a === this.you) this.shake = Math.max(this.shake, g.id === "sniper" ? 0.25 : 0.06);
    if (s.mag === 0) this.reload(a);
  }

  pickup(a: Actor, l: Loot, manual: boolean): boolean {
    switch (l.kind) {
      case "ammo": {
        const k = l.key as Ammo;
        if (a.ammo[k] >= AMMO_CAP[k]) return false;
        a.ammo[k] = Math.min(AMMO_CAP[k], a.ammo[k] + l.n);
        return true;
      }
      case "kit":
        if (a.kits >= 4) return false;
        a.kits = Math.min(4, a.kits + l.n);
        return true;
      case "band":
        if (a.bands >= 8) return false;
        a.bands = Math.min(8, a.bands + l.n);
        return true;
      case "armor":
        if (a.armor >= l.n) return false;
        a.armor = l.n;
        return true;
      case "gel":
        if (a.gels >= 6) return false;
        a.gels += l.n;
        return true;
      case "nade":
        if (a.nades >= 5) return false;
        a.nades += l.n;
        return true;
      case "melee": {
        const rank = (id: string) => MELEE[id].dmg / MELEE[id].rate;
        if (rank(l.key) <= rank(a.melee)) return false;
        if (a.melee !== "fists") this.drop("melee", a.melee, 1, a.x + 18, a.y + 12);
        a.melee = l.key;
        return true;
      }
      case "gun": {
        const free = a.guns.findIndex((s) => !s);
        if (free >= 0 && (manual || a.bot || true)) {
          a.guns[free] = { id: l.key, mag: l.n };
          if (a.cur === 2 || !a.guns[a.cur]) a.cur = free;
          return true;
        }
        if (!manual && !a.bot) return false;
        const slot = a.cur < 2 ? a.cur : 0;
        const old = a.guns[slot];
        if (a.bot && old && gunScore(GUNS[l.key]) <= gunScore(GUNS[old.id])) return false;
        if (old) this.drop("gun", old.id, old.mag, a.x + 16, a.y + 14);
        a.guns[slot] = { id: l.key, mag: l.n };
        a.cur = slot;
        return true;
      }
    }
    return false;
  }

  /** The gun on the ground close enough to swap for, for the "E: take" prompt. */
  nearGun(a: Actor): Loot | null {
    let best: Loot | null = null;
    let bd = 34;
    for (const l of this.loot) {
      if (l.kind !== "gun" && l.kind !== "melee") continue;
      const d = Math.hypot(l.x - a.x, l.y - a.y);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }

  /* ----- the frame ----- */

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
    this.hit = Math.max(0, this.hit - dt);
    this.kill = Math.max(0, this.kill - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === "over") {
      this.overT += dt;
    } else {
      this.updateZone(dt);
    }

    for (const a of this.actors) {
      if (!a.alive) continue;
      const bot = a.bot || (this.demo && a === this.you);
      const c = bot ? this.think(a, dt) : this.playerCtrl(a);
      this.step(a, c, dt);
    }
    this.updateBullets(dt);
    this.updateNades(dt);
    this.updateLoot();
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.max);
    if (this.phase === "drop" && this.you.z <= 0 && this.landedAt < 0) {
      this.landedAt = this.time;
      this.phase = "play";
      this.say("Find a gun. Stay inside the circle.", "#ffd166");
    }
    // Camera
    const focus = this.you.alive ? this.you : this.actors.find((a) => a.alive && a.name === this.you.killer) ?? this.actors.find((a) => a.alive) ?? this.you;
    this.cam.x += (focus.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (focus.y - this.cam.y) * Math.min(1, dt * 8);
  }

  updateZone(dt: number) {
    const z = this.zone;
    if (z.phase >= PHASES.length) return;
    const ph = PHASES[z.phase];
    z.t += dt;
    if (z.stage === "wait") {
      if (z.t >= ph.wait) {
        z.stage = "shrink";
        z.t = 0;
        z.dps = ph.dps;
        this.say("The zone is closing!", "#ff6b6b");
      }
    } else {
      const k = clamp(z.t / ph.shrink, 0, 1);
      z.x = z.fx + (z.tx - z.fx) * k;
      z.y = z.fy + (z.ty - z.fy) * k;
      z.r = z.fr + (z.tr - z.fr) * k;
      if (k >= 1) {
        z.phase++;
        z.stage = "wait";
        z.t = 0;
        if (z.phase < PHASES.length) {
          this.pickNextZone();
          this.say(`Next zone marked. Closing in ${PHASES[z.phase].wait}s`, "#7fe3ff");
          if (z.phase === 2) this.spawnAirdrop();
        }
      }
    }
    if (this.airdrop) this.airdrop.t += dt;
  }

  spawnAirdrop() {
    const z = this.zone;
    const ang = this.rng() * TAU;
    const d = Math.sqrt(this.rng()) * Math.max(10, z.tr - 40);
    const x = z.tx + Math.cos(ang) * d;
    const y = z.ty + Math.sin(ang) * d;
    if (this.collide(x, y, 30)) return this.spawnAirdrop();
    this.airdrop = { x, y, t: 0 };
    this.drop("gun", "sniper", 4, x - 20, y);
    this.drop("gun", "ar", 30, x + 20, y);
    this.drop("armor", "", 100, x, y + 18);
    this.drop("kit", "", 2, x, y - 18);
    this.drop("ammo", "snip", 12, x + 24, y + 22);
    this.drop("ammo", "med", 60, x - 24, y + 22);
    this.say("Airdrop! Rare loot is falling inside the zone.", "#d68bff");
    return undefined;
  }

  playerCtrl(a: Actor): Ctrl {
    const i = this.input;
    const edge = new Set(i.pressed);
    i.pressed.clear();
    let mx = i.mx;
    let my = i.my;
    const n = Math.hypot(mx, my);
    if (n > 1) {
      mx /= n;
      my /= n;
    }
    let aim = i.aim;
    if (aim === null && n > 0.2 && !i.fire) aim = Math.atan2(my, mx);
    return { mx, my, aim, fire: i.fire, edge };
  }

  step(a: Actor, c: Ctrl, dt: number) {
    const def = CHARS.find((x) => x.id === a.ch) ?? CHARS[0];
    a.sinceHurt += dt;
    for (const k of ["fireT", "rollCd", "stun", "skillCd", "ghost", "shield", "radar", "reveal", "hurtT", "swing", "comboT", "flash"] as const) if (a[k] > 0) a[k] = Math.max(0, a[k] - dt);
    if (a.comboT <= 0) a.combo = 0;

    // Parachute
    if (a.z > 0) {
      const dx = a.bot ? a.tx - a.x : c.mx * 240;
      const dy = a.bot ? a.ty - a.y : c.my * 240;
      const d = Math.hypot(dx, dy);
      const sp = 240;
      if (a.bot) {
        if (d > 6) {
          a.x += (dx / d) * Math.min(sp * dt, d);
          a.y += (dy / d) * Math.min(sp * dt, d);
        }
      } else {
        a.x += dx * dt;
        a.y += dy * dt;
      }
      a.x = clamp(a.x, CX - ISLE + 30, CX + ISLE - 30);
      const fall = a.fall * (c.edge.has("dive") ? 2.6 : 1) * (a.bot && d < 120 ? 2 : 1);
      a.z = Math.max(0, a.z - dt * fall);
      if (c.edge.has("roll") || c.edge.has("skill")) a.z = Math.max(0, a.z - 0.15);
      if (a.z <= 0) {
        // Land out of the water or a wall
        for (let k = 0; k < 30 && this.collide(a.x, a.y, 11); k++) {
          const ang = k * 1.1;
          a.x += Math.cos(ang) * (4 + k * 3);
          a.y += Math.sin(ang) * (4 + k * 3);
          if (Math.hypot(a.x - CX, a.y - CY) > ISLE - 20) {
            a.x += (CX - a.x) * 0.1;
            a.y += (CY - a.y) * 0.1;
          }
        }
      }
      if (c.mx) a.face = c.mx > 0 ? 1 : -1;
      return;
    }

    // Knock-back slides
    if (Math.abs(a.kx) + Math.abs(a.ky) > 4) {
      this.move(a, a.kx * dt, a.ky * dt);
      const f = Math.exp(-9 * dt);
      a.kx *= f;
      a.ky *= f;
    }

    if (a.stun > 0) return;

    // Skills that last
    if (a.ch === "mia" && a.skillT > 0) {
      a.skillT = Math.max(0, a.skillT - dt);
      a.hp = Math.min(100, a.hp + ((50 * this.eff(a)) / 3) * dt);
    }
    if (a.ch === "mia" && a.sinceHurt > 5 && a.hp < 100) a.hp = Math.min(100, a.hp + 1.5 * dt);
    if (a.healT > 0) {
      const part = Math.min(dt, a.healT);
      const give = a.healAmt * (part / a.healT);
      a.hp = Math.min(100, a.hp + give);
      a.healAmt -= give;
      a.healT -= part;
    }

    // Zone damage
    const zone = this.zone;
    if (Math.hypot(a.x - zone.x, a.y - zone.y) > zone.r) {
      a.hp -= zone.dps * dt;
      a.sinceHurt = 0;
      if (a === this.you && Math.floor(this.time * 2) % 2 === 0 && Math.random() < dt * 6) this.shake = Math.max(this.shake, 0.04);
      if (a.hp <= 0) return this.die(a, null, "zone");
    }

    // Aim
    if (c.aim !== null) {
      const diff = wrap(c.aim - a.a);
      const turn = a.bot ? DIFF[this.diff].turn : 22;
      a.a += clamp(diff, -turn * dt, turn * dt);
      if (!a.bot) a.a = c.aim;
    }
    a.face = Math.cos(a.a) >= 0 ? 1 : -1;

    // Actions
    if (c.edge.has("skill")) this.useSkill(a);
    if (c.edge.has("reload")) this.reload(a);
    if (c.edge.has("heal")) this.tryHeal(a);
    if (c.edge.has("nade")) this.throwNade(a, a.a);
    if (c.edge.has("gel")) this.placeGel(a);
    if (c.edge.has("swap")) a.cur = a.cur === 0 ? (a.guns[1] ? 1 : 0) : a.guns[0] ? 0 : a.guns[1] ? 1 : 2;
    if (c.edge.has("slot0") && a.guns[0]) a.cur = 0;
    if (c.edge.has("slot1") && a.guns[1]) a.cur = 1;
    if (c.edge.has("pickup")) {
      const l = this.nearGun(a);
      if (l && this.pickup(a, l, true)) {
        this.loot = this.loot.filter((x) => x !== l);
        this.sparks(a.x, a.y - 20, "#fff", 5);
      }
    }
    if (c.edge.has("roll") && a.rollCd <= 0 && a.rollT <= 0) {
      const n = Math.hypot(c.mx, c.my);
      a.rx = n > 0.1 ? c.mx / n : Math.cos(a.a);
      a.ry = n > 0.1 ? c.my / n : Math.sin(a.a);
      a.rollT = 0.4;
      a.rollCd = 1.6;
      a.healT = 0;
    }
    if (c.edge.has("melee")) this.melee(a);

    // Firing
    if (c.fire && a.rollT <= 0) {
      if (a.cur < 2 && this.gun(a)) {
        const g = this.gun(a)!;
        if (g.auto || a.fireT <= 0) this.shoot(a, this.assistAim(a, g));
      } else this.melee(a);
    }
    // Reload completes
    if (a.reloadT > 0) {
      a.reloadT -= dt;
      if (a.reloadT <= 0) {
        const g = this.gun(a);
        const s = a.cur < 2 ? a.guns[a.cur] : null;
        if (g && s) {
          const need = g.mag - s.mag;
          const take = Math.min(need, a.ammo[g.ammo]);
          s.mag += take;
          a.ammo[g.ammo] -= take;
        }
      }
    }

    // Movement
    let speed = 165 * (a.ch === "kai" ? 1.1 : 1);
    if (a.healT > 0) speed *= 0.6;
    if (a.reloadT > 0) speed *= 0.9;
    if (a.rollT > 0) {
      a.rollT -= dt;
      if (a.dashT > 0) {
        a.dashT -= dt;
        this.move(a, a.dx * dt, a.dy * dt);
        if (a.dashT <= 0) {
          a.dx = 0;
          a.dy = 0;
        }
      } else this.move(a, a.rx * 430 * dt, a.ry * 430 * dt);
      a.step += dt * 24;
      return;
    }
    const mx = c.mx;
    const my = c.my;
    const n = Math.hypot(mx, my);
    if (n > 0.05) {
      a.dx = mx;
      a.dy = my;
      this.move(a, mx * speed * dt, my * speed * dt);
      a.step += dt * 11 * Math.min(1, n);
    } else {
      a.dx = 0;
      a.dy = 0;
    }
    void def;
  }

  assistAim(a: Actor, g: Gun) {
    if (a.bot) return a.a;
    let best = a.a;
    let bd = this.assist;
    for (const t of this.actors) {
      if (t === a || !t.alive || t.z > 0) continue;
      const d = Math.hypot(t.x - a.x, t.y - a.y);
      if (d > g.range || d < 12) continue;
      if (t.ghost > 0 && d > 90 && t.reveal <= 0) continue;
      const ang = Math.atan2(t.y - a.y, t.x - a.x);
      const diff = Math.abs(wrap(ang - a.a));
      if (diff < bd && !this.rayBlock(a.x, a.y, t.x, t.y)) {
        bd = diff;
        best = ang;
      }
    }
    return best;
  }

  updateBullets(dt: number) {
    const keep: Bullet[] = [];
    for (const b of this.bullets) {
      const x2 = b.x + b.vx * dt;
      const y2 = b.y + b.vy * dt;
      const len = Math.hypot(b.vx * dt, b.vy * dt);
      let bestT = 2;
      let hitOb: Ob | null = null;
      let hitActor: Actor | null = null;
      for (const o of this.near(b.x, b.y, x2, y2)) {
        if (!o.shot) continue;
        const t = this.segHit(o, b.x, b.y, x2, y2);
        if (t >= 0 && t < bestT) {
          bestT = t;
          hitOb = o;
        }
      }
      for (const t of this.actors) {
        if (!t.alive || t.id === b.owner || t.z > 0) continue;
        if (Math.abs(t.x - b.x) > 60 + len || Math.abs(t.y - b.y) > 60 + len) continue;
        const dx = x2 - b.x;
        const dy = y2 - b.y;
        const fx = b.x - t.x;
        const fy = b.y - t.y;
        const aa = dx * dx + dy * dy;
        const bb = 2 * (fx * dx + fy * dy);
        const cc = fx * fx + fy * fy - 13 * 13;
        let tt = -1;
        if (cc <= 0) tt = 0;
        else if (aa > 0) {
          const disc = bb * bb - 4 * aa * cc;
          if (disc >= 0) {
            const r = (-bb - Math.sqrt(disc)) / (2 * aa);
            if (r >= 0 && r <= 1) tt = r;
          }
        }
        if (tt >= 0 && tt < bestT) {
          bestT = tt;
          hitActor = t;
          hitOb = null;
        }
      }
      if (bestT <= 1) {
        const hx = b.x + (x2 - b.x) * bestT;
        const hy = b.y + (y2 - b.y) * bestT;
        const src = this.actors.find((a) => a.id === b.owner) ?? null;
        if (hitActor) {
          if (!this.invuln(hitActor)) {
            const dmg = b.dmg * (src ? 1 + 0.02 * (src.level - 1) : 1);
            const gname = src ? (src.cur < 2 && src.guns[src.cur] ? GUNS[src.guns[src.cur]!.id].name : "gun") : "gun";
            this.damage(hitActor, dmg, src, gname, b.vx / Math.hypot(b.vx, b.vy), b.vy / Math.hypot(b.vx, b.vy));
            this.sparks(hx, hy, "#ff8a8a", 3);
            if (hitActor.bot && src) {
              hitActor.target = src.id;
              hitActor.seen = 3;
            }
            continue;
          }
          keep.push({ ...b, x: x2, y: y2, life: b.life - len });
          continue;
        }
        if (hitOb) {
          if (Number.isFinite(hitOb.hp)) {
            hitOb.hp -= b.dmg;
            if (hitOb.hp <= 0) hitOb.dead = true;
          }
          this.sparks(hx, hy, hitOb.kind === "gel" ? "#7fe3ff" : "#ffe08a", 3);
          continue;
        }
      }
      b.x = x2;
      b.y = y2;
      b.life -= len;
      if (b.life > 0 && Math.hypot(b.x - CX, b.y - CY) < ISLE + 80) keep.push(b);
    }
    this.bullets = keep;
  }

  updateNades(dt: number) {
    for (const n of this.nades) {
      n.t -= dt;
      const nx = n.x + n.vx * dt;
      const ny = n.y + n.vy * dt;
      if (this.collide(nx, n.y, 5)) n.vx *= -0.4;
      else n.x = nx;
      if (this.collide(n.x, ny, 5)) n.vy *= -0.4;
      else n.y = ny;
      const f = Math.exp(-2.6 * dt);
      n.vx *= f;
      n.vy *= f;
      if (n.t <= 0) {
        const src = this.actors.find((a) => a.id === n.owner) ?? null;
        this.ring(n.x, n.y, 120, "#ffb454", 0.5);
        this.sparks(n.x, n.y, "#ffb454", 14);
        this.shake = Math.max(this.shake, 0.25);
        for (const t of this.actors) {
          if (!t.alive || t.z > 0) continue;
          const d = Math.hypot(t.x - n.x, t.y - n.y);
          if (d > 120 || this.rayBlock(n.x, n.y, t.x, t.y)) continue;
          const ang = Math.atan2(t.y - n.y, t.x - n.x);
          t.kx += Math.cos(ang) * 260;
          t.ky += Math.sin(ang) * 260;
          this.damage(t, 75 * (1 - d / 160), src, "Grenade");
        }
      }
    }
    this.nades = this.nades.filter((n) => n.t > 0);
    // gel walls time out
    for (const o of this.obs) if (o.kind === "gel" && !o.dead) {
      o.hp -= dt * 14;
      if (o.hp <= 0) o.dead = true;
    }
  }

  updateLoot() {
    for (const a of this.actors) {
      if (!a.alive || a.z > 0) continue;
      for (let i = this.loot.length - 1; i >= 0; i--) {
        const l = this.loot[i];
        if (Math.abs(l.x - a.x) > 22 || Math.abs(l.y - a.y) > 22) continue;
        if (Math.hypot(l.x - a.x, l.y - a.y) > 20) continue;
        if ((l.kind === "gun" || l.kind === "melee") && !a.bot && !(l.kind === "gun" && a.guns.some((s) => !s))) continue;
        if (this.pickup(a, l, false)) {
          this.loot.splice(i, 1);
          if (a === this.you) this.sparks(a.x, a.y - 20, "#7fe3ff", 4);
        }
      }
    }
  }

  /* ----- bot brains ----- */

  visible(a: Actor, t: Actor) {
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    const sight = DIFF[this.diff].sight * (t.ch === "zed" ? 0.7 : 1);
    if (d > sight) return false;
    if (t.ghost > 0 && t.reveal <= 0 && d > 80) return false;
    return !this.rayBlock(a.x, a.y - 0, t.x, t.y);
  }

  think(a: Actor, dt: number): Ctrl {
    const c: Ctrl = { mx: 0, my: 0, aim: null, fire: false, edge: new Set() };
    if (a.z > 0) return c;
    const D = DIFF[this.diff];
    a.think -= dt;
    a.strafeT -= dt;
    a.seen -= dt;
    a.react -= dt;
    a.detour -= dt;
    const gun = this.gun(a);
    const slot = a.cur < 2 ? a.guns[a.cur] : null;

    if (a.think <= 0) {
      a.think = 0.18 + this.rng() * 0.1;
      // 1. The enemy: nearest one we can see
      let best: Actor | null = null;
      let bd = 1e9;
      const armed = a.guns[0] || a.guns[1];
      for (const t of this.actors) {
        if (t === a || !t.alive || t.z > 0) continue;
        const d = Math.hypot(t.x - a.x, t.y - a.y);
        // Nobody picks a fight with bare fists from across the map: loot first
        if (!armed && d > 90) continue;
        if (d < bd && this.visible(a, t)) {
          bd = d;
          best = t;
        }
      }
      if (best) {
        if (a.target !== best.id) a.react = D.react;
        a.target = best.id;
        a.seen = 3;
      }
      // 2. Where to go
      const z = this.zone;
      const toZone = Math.hypot(a.x - z.x, a.y - z.y);
      const zr = z.stage === "shrink" ? z.tr : z.r;
      const nextZone = Math.hypot(a.x - z.tx, a.y - z.ty) > z.tr * 0.85 && (z.stage === "shrink" || z.t > PHASES[Math.min(z.phase, 4)].wait - 12);
      const fighting = a.seen > 0;
      if (toZone > z.r * 0.92 || nextZone) {
        a.goalX = z.stage === "shrink" ? z.tx : z.x;
        a.goalY = z.stage === "shrink" ? z.ty : z.y;
        if (nextZone) {
          a.goalX = z.tx;
          a.goalY = z.ty;
        }
      } else if (!fighting) {
        if (a.hp < 55 && (a.kits || a.bands)) c.edge.add("heal");
        let want: Loot | null = null;
        let wd = a.guns.some((s) => s) ? 520 : 1000;
        const needAmmo = gun && a.ammo[gun.ammo] < gun.mag;
        for (const l of this.loot) {
          const d = Math.hypot(l.x - a.x, l.y - a.y);
          if (d > wd) continue;
          const useful =
            (l.kind === "gun" && (!a.guns[0] || !a.guns[1] || gunScore(GUNS[l.key]) > gunScore(gun ?? GUNS.pistol) * 1.25)) ||
            (l.kind === "ammo" && (needAmmo || a.ammo[l.key as Ammo] < 30)) ||
            (l.kind === "armor" && a.armor < l.n) ||
            ((l.kind === "kit" || l.kind === "band") && a.kits + a.bands < 3) ||
            (l.kind === "melee" && MELEE[l.key].dmg > MELEE[a.melee].dmg) ||
            l.kind === "nade" ||
            l.kind === "gel";
          if (useful) {
            wd = d;
            want = l;
          }
        }
        if (this.airdrop && a.hp > 50 && gun && Math.hypot(this.airdrop.x - a.x, this.airdrop.y - a.y) < 700 && a.id % 3 === 0) {
          a.goalX = this.airdrop.x;
          a.goalY = this.airdrop.y;
        } else if (want) {
          a.goalX = want.x;
          a.goalY = want.y;
        } else if (Math.hypot(a.goalX - a.x, a.goalY - a.y) < 40 || this.rng() < 0.05 || Math.hypot(a.goalX - z.x, a.goalY - z.y) > zr) {
          const b = this.buildings[Math.floor(this.rng() * this.buildings.length)];
          const bx = b.x + b.w / 2;
          const by = b.y + b.h + 24;
          if (Math.hypot(bx - z.x, by - z.y) < zr * 0.9) {
            a.goalX = bx;
            a.goalY = by;
          } else {
            const ang = this.rng() * TAU;
            a.goalX = z.x + Math.cos(ang) * zr * 0.5 * this.rng();
            a.goalY = z.y + Math.sin(ang) * zr * 0.5 * this.rng();
          }
        }
        if (!a.guns[0] && !a.guns[1]) a.cur = 2;
      }
      // Reload / skills
      if (gun && slot && !fighting && slot.mag < gun.mag * 0.5) c.edge.add("reload");
      if (a.skillCd <= 0) {
        if (a.ch === "mia" && a.hp < 65) c.edge.add("skill");
        else if (a.ch === "rex" && a.sinceHurt < 0.6) c.edge.add("skill");
        else if (a.ch === "nia" && fighting) c.edge.add("skill");
        else if (a.ch === "zed" && fighting && bd > 160) c.edge.add("skill");
        else if (a.ch === "vex" && fighting && bd < 120) c.edge.add("skill");
        else if (a.ch === "kai" && fighting && (a.hp < 45 || (bd > 200 && bd < 400))) c.edge.add("skill");
      }
      if (a.rollCd <= 0 && a.sinceHurt < 0.3 && fighting && this.rng() < 0.4) c.edge.add("roll");
      if (fighting && a.nades > 0 && bd > 90 && bd < 260 && this.rng() < 0.2) {
        c.edge.add("nade");
      }
      if (fighting && a.gels > 0 && a.hp < 50 && this.rng() < 0.2) c.edge.add("gel");
      // Pick the gun for the range
      if (fighting && best) {
        const want = a.guns.findIndex((s) => s && (bd < 150 ? GUNS[s.id].range < 400 : GUNS[s.id].range >= 400) && (s.mag > 0 || a.ammo[GUNS[s.id].ammo] > 0));
        if (want >= 0 && want !== a.cur) a.cur = want;
        else if (!gun || (slot && slot.mag === 0 && a.ammo[gun.ammo] === 0)) {
          const other = a.cur === 0 ? 1 : 0;
          if (a.guns[other] && (a.guns[other]!.mag > 0 || a.ammo[GUNS[a.guns[other]!.id].ammo] > 0)) a.cur = other;
          else a.cur = 2;
        }
      }
      a.err = (this.rng() * 2 - 1) * D.sigma * 2;
      // stuck?
      if (Math.hypot(a.x - a.lastX, a.y - a.lastY) < 6 && (a.mxPrev ?? false)) a.stuckT += 0.2;
      else a.stuckT = 0;
      a.lastX = a.x;
      a.lastY = a.y;
      if (a.stuckT > 0.7) {
        a.detour = 0.8;
        a.detourA = (this.rng() < 0.5 ? 1 : -1) * (1.2 + this.rng());
        a.stuckT = 0;
      }
    }

    // Act on the decision
    const target = a.seen > 0 ? this.actors.find((t) => t.id === a.target && t.alive && t.z <= 0) : undefined;
    let gx = a.goalX;
    let gy = a.goalY;
    let hold = false;
    if (target) {
      const d = Math.hypot(target.x - a.x, target.y - a.y);
      const lead = gun ? d / gun.speed : 0;
      const tx = target.x + (target.dx || 0) * 150 * lead * 0.6;
      const ty = target.y + (target.dy || 0) * 150 * lead * 0.6;
      c.aim = Math.atan2(ty - a.y, tx - a.x) + a.err;
      const ready = a.react <= 0;
      const inRange = gun ? d < gun.range * 0.95 : d < MELEE[a.melee].range + 8;
      if (gun && slot && slot.mag > 0 && inRange && ready) {
        if (Math.abs(wrap(c.aim - a.a)) < 0.16 && !this.rayBlock(a.x, a.y, target.x, target.y)) c.fire = true;
      } else if (!gun || (slot && slot.mag === 0 && a.ammo[gun.ammo] === 0)) {
        if (d < MELEE[a.melee].range + 14 && ready) c.edge.add("melee");
      } else if (slot && slot.mag === 0) c.edge.add("reload");
      // positioning
      const prefer = gun ? Math.min(gun.range * 0.55, 380) : 28;
      if (d > prefer + 40) {
        gx = target.x;
        gy = target.y;
      } else if (d < prefer - 60 && gun && gun.range > 400) {
        gx = a.x - (target.x - a.x);
        gy = a.y - (target.y - a.y);
      } else {
        if (a.strafeT <= 0) {
          a.strafe = this.rng() < 0.5 ? 1 : -1;
          a.strafeT = 0.5 + this.rng() * 0.9;
        }
        const ang = Math.atan2(target.y - a.y, target.x - a.x) + (Math.PI / 2) * a.strafe;
        gx = a.x + Math.cos(ang) * 100;
        gy = a.y + Math.sin(ang) * 100;
      }
      if (this.zone.stage === "shrink" && Math.hypot(a.x - this.zone.x, a.y - this.zone.y) > this.zone.r * 0.95) {
        gx = this.zone.x;
        gy = this.zone.y;
      }
    } else {
      const ga = Math.atan2(gy - a.y, gx - a.x);
      c.aim = ga;
    }
    const d = Math.hypot(gx - a.x, gy - a.y);
    if (!hold && d > 14) {
      let ang = Math.atan2(gy - a.y, gx - a.x);
      if (a.detour > 0) ang += a.detourA;
      const slow = a.healT > 0 ? 0.7 : 1;
      c.mx = Math.cos(ang) * slow;
      c.my = Math.sin(ang) * slow;
    }
    a.mxPrev = Math.abs(c.mx) + Math.abs(c.my) > 0.1;
    return c;
  }
}

function b0(r: () => number, w: number) {
  return 16 + r() * (w - 16 - 46 - 16);
}

/** "Zone closes in 0:23" / "Zone closing" for the HUD. */
export function zoneLabel(g: Battle) {
  const z = g.zone;
  if (z.phase >= PHASES.length) return { text: "FINAL ZONE", hot: true };
  const ph = PHASES[z.phase];
  if (z.stage === "shrink") return { text: `ZONE CLOSING  ${Math.ceil(ph.shrink - z.t)}s`, hot: true };
  const s = Math.max(0, Math.ceil(ph.wait - z.t));
  return { text: `ZONE CLOSES IN ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, hot: s <= 10 };
}
