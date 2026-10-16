/* Stickville simulation: the hero, vehicles, missions, drones, coins and the town economy.
   Pure game state — drawing lives in render.ts, menus in GameView.tsx. */

import { BUILDINGS, FACTS, MISSIONS, VEHICLES, rankOf, type BuildingKind, type Hero, type MissionDef, type VehicleKind } from "./data";
import { engineHum, sfx } from "./audio";
import { PROP_DEFS, propBounds, propDef, type Pack, type Prop } from "./creator";
import type { Question } from "./data";
import {
  DEPOT_X,
  OUTPOST_X,
  PLOT_COUNT,
  PX_PER_M,
  RACE_END,
  RACE_START,
  SPAWN_X,
  TOWN_END,
  Terrain,
  WATCHTOWER_X,
  WORLD_W,
  PLOT_W,
  plotCenter,
  plotLeft,
  type Ramp,
} from "./world";

export const G = 1800;
const WALK = 270;
const JUMP = 660;
export const RAMP_COST = 25;
export const MAX_USER_RAMPS = 8;
export const MAX_HP = 100;

export interface SaveData {
  v: 1;
  hero: Hero | null;
  coins: number;
  xp: number;
  plots: (BuildingKind | null)[];
  ramps: Ramp[];
  /** Mission id → times completed. */
  done: Record<string, number>;
  facts: number[];
  bestRace: number | null;
  quizRight: number;
  flips: number;
  /** Creator mode: everything the player placed in the world. */
  props: Prop[];
  /** Sprites the player imported (Blender add-on packs or PNGs). */
  packs: Pack[];
  /** Quiz questions the player wrote; they join the school's pool. */
  myQuestions: Question[];
  nextPropId: number;
}

export const newSave = (): SaveData => ({
  v: 1,
  hero: null,
  coins: 100,
  xp: 0,
  plots: Array(PLOT_COUNT).fill(null),
  ramps: [],
  done: {},
  facts: [],
  bestRace: null,
  quizRight: 0,
  flips: 0,
  props: [],
  packs: [],
  myQuestions: [],
  nextPropId: 1,
});

export const MAX_PROPS = 500;

interface Surface {
  x0: number;
  x1: number;
  top: number;
  kind: "solid" | "trampoline";
}

export interface Vehicle {
  kind: VehicleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  dir: 1 | -1;
  grounded: boolean;
  homeX: number;
  airRot: number;
  crashT: number;
  wheel: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  phase: number;
  hp: number;
  vehicle: Vehicle | null;
  hurtT: number;
  fireT: number;
  downT: number;
}

export interface Drone {
  x: number;
  y: number;
  baseY: number;
  t: number;
  vx: number;
  shoots: boolean;
  fireT: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  enemy: boolean;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
}

export interface Point {
  x: number;
  y: number;
  label: string;
  done: boolean;
  kind: "flag" | "crate" | "outpost" | "terminal" | "hiker" | "ring" | "home";
}

export interface MissionRun {
  def: MissionDef;
  time: number;
  stage: number;
  points: Point[];
  kills: number;
  need: number;
  aboard: number;
  carrying: boolean;
  objective: string;
}

export interface Toast {
  text: string;
  t: number;
  color: string;
}

export type GameEvent =
  | { type: "build"; plot: number }
  | { type: "building"; plot: number }
  | { type: "missions" }
  | { type: "school" }
  | { type: "intel"; terminal: number }
  | { type: "fact"; index: number }
  | { type: "mission-end"; ok: boolean; title: string; text: string }
  | { type: "save" };

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  pressed: Set<"jump" | "action" | "ramp" | "home" | "fire">;
}

export const newInput = (): Input => ({ left: false, right: false, up: false, down: false, fire: false, pressed: new Set() });

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (a: number) => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
};
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

const BOOKS: [number, number][] = [
  [820, -40], [2120, -40], [3420, -230], [3760, -60], [4400, -60], [5110, -220],
  [5950, -50], [6700, -260], [7300, -50], [WATCHTOWER_X, -190], [8800, -50], [9750, -50],
];

const RINGS: [number, number][] = [
  [3600, -420], [4050, -560], [4400, -700], [4800, -560], [5250, -420],
];

const DAY_LENGTH = 240;

export class Game {
  save: SaveData;
  terrain: Terrain;
  input = newInput();
  player: Player;
  vehicles: Vehicle[] = [];
  drones: Drone[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  coins: { x: number; y: number; wait: number }[] = [];
  books: { x: number; y: number; index: number }[] = [];
  toasts: Toast[] = [];
  mission: MissionRun | null = null;
  race: { t: number } | null = null;
  lastRace: { t: number; reward: number; at: number } | null = null;
  built = new Map<number, number>(); // plot → construction progress 0..1
  time = 0;
  incomeT = 60;
  paused = false;
  cam = { x: SPAWN_X, y: -150 };
  prompt: { text: string; act: () => void } | null = null;
  shake = 0;
  /* Creator mode */
  creator = false;
  selected: number | null = null;
  ghost: { x: number; y: number; kind: string } | null = null;
  camOffset = { x: 0, y: 0 };
  /** Where the last frame's camera was, so the page can map pointer positions into the world. */
  view = { camX: 0, camY: 0, scale: 1, w: 1, h: 1 };
  surfaces: Surface[] = [];
  propCoinWait = new Map<number, number>();
  course: { t: number; from: number } | null = null;
  boostT = 0;
  /** The sign or person currently talking, by prop id. */
  talking: number | null = null;
  private emit: (e: GameEvent) => void;

  constructor(save: SaveData, emit: (e: GameEvent) => void) {
    this.save = save;
    this.emit = emit;
    this.terrain = new Terrain(this.allRamps());
    this.refreshSurfaces();
    this.player = { x: SPAWN_X, y: 0, vx: 0, vy: 0, grounded: true, facing: 1, phase: 0, hp: MAX_HP, vehicle: null, hurtT: 0, fireT: 0, downT: 0 };
    save.plots.forEach((k, i) => k && this.built.set(i, 1));
    this.syncVehicles();
    for (let x = 520; x < WORLD_W - 150; x += 135) {
      if (Math.abs(x - DEPOT_X) < 60) continue;
      this.coins.push({ x, y: this.terrain.y(x) - 34, wait: 0 });
    }
    // Arcs of coins over the fixed ramps reward a clean jump
    for (const r of this.terrain.ramps.slice(0, 4)) {
      for (let i = 1; i <= 5; i++) {
        const x = r.x + r.dir * i * 70;
        this.coins.push({ x, y: this.terrain.y(r.x) - 90 - Math.sin((i / 6) * Math.PI) * 120, wait: 0 });
      }
    }
    BOOKS.forEach(([x, dy], index) => {
      if (!save.facts.includes(index)) this.books.push({ x, y: this.terrain.base(x) + dy, index });
    });
  }

  /* ---------- Save / economy ---------- */

  rank() {
    return rankOf(this.save.xp);
  }

  reward(coins: number, xp: number, label?: string) {
    const before = this.rank().index;
    this.save.coins += coins;
    this.save.xp += xp;
    if (label) this.toast(label, "#ffb224");
    const after = this.rank();
    if (after.index > before) {
      this.toast(`Promoted to ${after.name}!`, "#8bd99b");
      sfx.success();
      this.confetti(this.player.x, this.player.y - 80);
    }
    this.emit({ type: "save" });
  }

  spend(n: number) {
    if (this.save.coins < n) return false;
    this.save.coins -= n;
    this.emit({ type: "save" });
    return true;
  }

  has(kind: BuildingKind) {
    return this.save.plots.includes(kind);
  }

  build(plot: number, kind: BuildingKind) {
    const def = BUILDINGS[kind];
    if (this.save.plots[plot] || (def.needs && !this.has(def.needs)) || !this.spend(def.cost)) return false;
    this.save.plots[plot] = kind;
    this.built.set(plot, 0);
    sfx.build();
    this.toast(`Building a ${def.label.toLowerCase()}…`, "#edeae3");
    this.emit({ type: "save" });
    return true;
  }

  demolish(plot: number) {
    const kind = this.save.plots[plot];
    if (!kind) return;
    this.save.plots[plot] = null;
    this.built.delete(plot);
    this.save.coins += Math.floor(BUILDINGS[kind].cost / 2);
    for (let i = 0; i < 30; i++) this.particles.push(this.dust(plotCenter(plot) + rand(-90, 90), rand(-120, 0), "#8e8b84"));
    sfx.crash();
    this.syncVehicles();
    this.emit({ type: "save" });
  }

  income() {
    return this.save.plots.reduce((n, k) => n + (k ? BUILDINGS[k].income : 0), 0);
  }

  /** Make the parked vehicles match what's unlocked. */
  syncVehicles() {
    const want: { kind: VehicleKind; x: number }[] = [{ kind: "bike", x: 210 }];
    this.save.plots.forEach((k, i) => {
      if (!k || (this.built.get(i) ?? 0) < 1) return;
      if (k === "garage") want.push({ kind: "car", x: plotLeft(i) + 20 });
      if (k === "barracks") want.push({ kind: "jeep", x: plotLeft(i) + PLOT_W - 10 });
      if (k === "helipad") want.push({ kind: "heli", x: plotCenter(i) });
    });
    const keep = this.vehicles.filter((v) => want.some((w) => w.kind === v.kind));
    for (const w of want) {
      if (keep.some((v) => v.kind === w.kind)) continue;
      keep.push({ kind: w.kind, x: w.x, y: this.terrain.y(w.x), vx: 0, vy: 0, angle: 0, dir: 1, grounded: true, homeX: w.x, airRot: 0, crashT: 0, wheel: 0 });
    }
    if (this.player.vehicle && !keep.includes(this.player.vehicle)) this.player.vehicle = null;
    this.vehicles = keep;
  }

  placeRamp() {
    const p = this.player;
    if (!this.has("workshop")) return this.toast("Build a workshop to place ramps", "#ff5a4e");
    if (p.vehicle) return this.toast("Get off to place a ramp", "#ff5a4e");
    if (p.x < TOWN_END + 100) return this.toast("Ramps go in the hills or the desert", "#ff5a4e");
    if (this.save.ramps.length >= MAX_USER_RAMPS) return this.toast(`You can place ${MAX_USER_RAMPS} ramps — the oldest was removed`, "#8e8b84"), this.save.ramps.shift(), this.placeRamp();
    if (!this.spend(RAMP_COST)) return this.toast(`A ramp costs ${RAMP_COST} coins`, "#ff5a4e");
    const ramp: Ramp = { x: Math.min(WORLD_W - 200, p.x + p.facing * 180), w: 150, h: 60, dir: p.facing };
    this.save.ramps.push(ramp);
    this.refreshProps();
    sfx.build();
    this.toast("Ramp built! Hit it fast.", "#ffb224");
    this.emit({ type: "save" });
  }

  /* ---------- Creator ---------- */

  private allRamps(): Ramp[] {
    const placed = (this.save.props ?? []).filter((p) => p.kind === "ramp").map((p) => ({ x: p.x, w: 150, h: 60, dir: p.dir ?? 1 }) as Ramp);
    return [...this.save.ramps, ...placed];
  }

  private refreshSurfaces() {
    const ground = (x: number) => this.terrain.y(x);
    this.surfaces = [];
    for (const p of this.save.props) {
      const def = propDef(p.kind, this.save.packs);
      if (!def?.solid) continue;
      const b = propBounds(p, this.save.packs, ground);
      this.surfaces.push({ x0: b.x0 + 4, x1: b.x1 - 4, top: b.top, kind: p.kind === "trampoline" ? "trampoline" : "solid" });
    }
  }

  /** Rebuild terrain and platforms after props change, and save. */
  refreshProps() {
    this.terrain = new Terrain(this.allRamps());
    this.refreshSurfaces();
    this.emit({ type: "save" });
  }

  /** The ground under (x, y): terrain, or the top of a platform at most a step above y. */
  floorAt(x: number, y: number, rising = false) {
    let gy = this.terrain.y(x);
    let slope: number | null = null;
    let trampoline = false;
    if (!rising) {
      for (const s of this.surfaces) {
        if (x >= s.x0 && x <= s.x1 && s.top >= y - 18 && s.top < gy) {
          gy = s.top;
          slope = 0;
          trampoline = s.kind === "trampoline";
        }
      }
    }
    return { y: gy, slope: slope ?? this.terrain.slope(x), trampoline };
  }

  /** Where a prop of this kind would sit if placed at (x, y). */
  placement(kind: string, x: number, y: number) {
    const def = propDef(kind, this.save.packs);
    const gx = Math.round(Math.max(40, Math.min(WORLD_W - 40, x)) / 10) * 10;
    if (!def) return { x: gx, y };
    if (!def.grounded) return { x: gx, y: Math.round((kind === "block" ? y + (def.h ?? 40) / 2 : y) / 10) * 10 };
    return { x: gx, y: this.floorAt(gx, y - 10).y };
  }

  addProp(kind: string, x: number, y: number) {
    const def = propDef(kind, this.save.packs);
    if (!def) return null;
    if (this.save.props.length >= MAX_PROPS) {
      this.toast(`That's the limit of ${MAX_PROPS} items — delete some first`, "#ff5a4e");
      return null;
    }
    const at = this.placement(kind, x, y);
    const p: Prop = { id: this.save.nextPropId++, kind, x: at.x, y: at.y };
    if (def.w && kind === "block") p.w = def.w;
    if (def.h && kind === "block") p.h = def.h;
    if (def.color) p.color = def.color;
    if (def.text) p.text = def.text;
    this.save.props.push(p);
    this.selected = p.id;
    sfx.build();
    this.burst(p.x, p.y - 10, "#ffb224", 8, 120);
    this.refreshProps();
    return p;
  }

  propAt(x: number, y: number) {
    const ground = (gx: number) => this.terrain.y(gx);
    for (let i = this.save.props.length - 1; i >= 0; i--) {
      const p = this.save.props[i];
      const b = propBounds(p, this.save.packs, ground);
      if (x >= b.x0 - 6 && x <= b.x1 + 6 && y >= b.y0 - 6 && y <= b.y1 + 6) return p;
    }
    return null;
  }

  moveProp(id: number, x: number, y: number) {
    const p = this.save.props.find((q) => q.id === id);
    if (!p) return;
    const at = this.placement(p.kind, x, y);
    p.x = at.x;
    p.y = at.y;
    this.refreshSurfaces();
    if (p.kind === "ramp") this.terrain = new Terrain(this.allRamps());
  }

  updateProp(id: number, patch: Partial<Prop>) {
    const p = this.save.props.find((q) => q.id === id);
    if (!p) return;
    Object.assign(p, patch);
    this.refreshProps();
  }

  removeProp(id: number) {
    this.save.props = this.save.props.filter((p) => p.id !== id);
    if (this.selected === id) this.selected = null;
    this.refreshProps();
  }

  duplicateProp(id: number) {
    const p = this.save.props.find((q) => q.id === id);
    if (!p || this.save.props.length >= MAX_PROPS) return;
    const b = propBounds(p, this.save.packs, (x) => this.terrain.y(x));
    const copy: Prop = { ...p, id: this.save.nextPropId++, x: Math.min(WORLD_W - 40, p.x + (b.x1 - b.x0) + 10), best: undefined };
    if (!PROP_DEFS[p.kind]?.grounded || p.kind === "block") copy.y = p.y;
    else copy.y = this.floorAt(copy.x, p.y - 10).y;
    this.save.props.push(copy);
    this.selected = copy.id;
    this.refreshProps();
  }

  private updateProps(dt: number) {
    const f = this.focus();
    const p = this.player;
    const v = p.vehicle;
    const ground = (x: number) => this.terrain.y(x);
    this.boostT = Math.max(0, this.boostT - dt);
    for (const [id, w] of this.propCoinWait) {
      if (w - dt <= 0) this.propCoinWait.delete(id);
      else this.propCoinWait.set(id, w - dt);
    }
    let talking: number | null = null;
    let talkD = 150;
    const prevX = f.x - f.vx * dt;
    for (const q of this.save.props) {
      if (Math.abs(q.x - f.x) > 220) continue;
      switch (q.kind) {
        case "coin":
          if (!this.propCoinWait.has(q.id) && Math.abs(q.x - f.x) < 34 && Math.abs(q.y - (f.y - 40)) < 52) {
            this.propCoinWait.set(q.id, 60);
            this.save.coins += 2;
            sfx.coin();
          }
          break;
        case "boost": {
          const b = propBounds(q, this.save.packs, ground);
          if (f.x >= b.x0 && f.x <= b.x1 && Math.abs(f.y - b.top) < 22 && this.boostT < 0.8) {
            this.boostT = 1.2;
            sfx.flip();
            if (v) v.vx = v.dir * VEHICLES[v.kind].max * 1.45;
            else p.vx = p.facing * WALK * 2.6;
            this.burst(f.x, f.y - 10, "#ffb224", 12, 200);
          }
          break;
        }
        case "start":
          if (prevX < q.x + 40 && f.x >= q.x + 40 && Math.abs(f.y - q.y) < 200) {
            this.course = { t: 0, from: q.id };
            this.toast("Course started! Reach a finish line", "#ffb224");
            sfx.right();
          }
          break;
        case "finish":
          if (this.course && prevX < q.x + 40 && f.x >= q.x + 40 && Math.abs(f.y - q.y) < 200) {
            const t = this.course.t;
            this.course = null;
            const record = !q.best || t < q.best;
            if (record) q.best = t;
            this.reward(5, 5, `${record ? "New best! " : ""}Course: ${t.toFixed(2)} s`);
            sfx.success();
            this.confetti(f.x, f.y - 80);
          }
          break;
        case "sign":
        case "person": {
          const d = Math.abs(q.x - f.x);
          if (d < talkD && Math.abs(q.y - f.y) < 160) {
            talkD = d;
            talking = q.id;
          }
          break;
        }
      }
    }
    if (talking !== null && talking !== this.talking) sfx.page();
    this.talking = talking;
    if (this.course) {
      this.course.t += dt;
      const start = this.save.props.find((q) => q.id === this.course!.from);
      if (!start || f.x < start.x - 200) {
        this.course = null;
        this.toast("Course cancelled", "#8e8b84");
      }
    }
    // The pan offset fades once the hero moves, so you never lose them
    if (this.input.left || this.input.right) {
      const k = Math.exp(-dt * 3);
      this.camOffset.x *= k;
      this.camOffset.y *= k;
    }
  }

  /* ---------- Missions ---------- */

  missionAvailable(def: MissionDef) {
    return this.has("barracks") && (!def.needs || this.has(def.needs));
  }

  startMission(def: MissionDef) {
    const t = this.terrain;
    const m: MissionRun = { def, time: def.time, stage: 0, points: [], kills: 0, need: 0, aboard: 0, carrying: false, objective: "" };
    this.drones = [];
    this.shots = this.shots.filter((s) => !s.enemy);
    const pt = (x: number, kind: Point["kind"], label: string, dy = 0): Point => ({ x, y: t.y(x) + dy, label, done: false, kind });
    switch (def.kind) {
      case "recon":
        m.points = [pt(WATCHTOWER_X, "flag", "Watchtower"), pt(1200, "home", "Town")];
        break;
      case "supply":
        m.points = [pt(DEPOT_X, "crate", "Depot"), pt(OUTPOST_X, "outpost", "Outpost")];
        break;
      case "drill":
        m.need = 8;
        for (let i = 0; i < 8; i++) this.spawnDrone(rand(6000, 9700), false);
        break;
      case "intel":
        m.points = [pt(3680, "terminal", "Terminal A"), pt(6950, "terminal", "Terminal B"), pt(8850, "terminal", "Terminal C")];
        break;
      case "rescue":
        m.points = [pt(4400, "hiker", "Hiker"), pt(6250, "hiker", "Hiker"), pt(8100, "hiker", "Hiker"), pt(1200, "home", "Town")];
        break;
      case "airlift":
        m.points = RINGS.map(([x, y], i) => ({ x, y, label: `Ring ${i + 1}`, done: false, kind: "ring" as const }));
        break;
      case "defend":
        m.need = 15;
        m.points = [pt(OUTPOST_X, "outpost", "Outpost")];
        for (let i = 0; i < 5; i++) this.spawnDrone(rand(8000, 9800), true);
        break;
    }
    this.mission = m;
    this.updateObjective();
    this.toast(`Mission: ${def.title}`, "#ffb224");
    sfx.page();
  }

  abandonMission() {
    if (!this.mission) return;
    this.toast("Mission abandoned", "#8e8b84");
    this.endMission(false, "Mission abandoned", "Head back to the barracks to try again.", true);
  }

  private endMission(ok: boolean, title: string, text: string, quiet = false) {
    const m = this.mission;
    if (!m) return;
    this.mission = null;
    this.drones = [];
    this.shots = [];
    if (ok) {
      const first = !this.save.done[m.def.id];
      this.save.done[m.def.id] = (this.save.done[m.def.id] ?? 0) + 1;
      const coins = first ? m.def.reward : Math.round(m.def.reward / 2);
      const xp = first ? m.def.xp : Math.round(m.def.xp / 2);
      this.reward(coins, xp);
      sfx.success();
      this.confetti(this.player.x, this.player.y - 60);
      this.emit({ type: "mission-end", ok, title, text: `${text} +${coins} coins, +${xp} XP${first ? "" : " (repeat reward)"}.` });
    } else if (!quiet) {
      sfx.fail();
      this.emit({ type: "mission-end", ok, title, text });
    }
  }

  private updateObjective() {
    const m = this.mission;
    if (!m) return;
    switch (m.def.kind) {
      case "recon":
        m.objective = m.stage === 0 ? "Reach the watchtower flag in the desert" : "Return to town";
        break;
      case "supply":
        m.objective = m.carrying ? "Deliver the crate to the outpost" : "Pick up the crate at the depot (end of town)";
        break;
      case "drill":
      case "defend":
        m.objective = `Pop drones: ${m.kills}/${m.need}  ·  F to fire`;
        break;
      case "intel":
        m.objective = `Unlock terminals: ${m.points.filter((p) => p.done).length}/3 — reach one and press E`;
        break;
      case "rescue":
        m.objective = m.aboard < 3 ? `Find stranded hikers: ${m.aboard}/3` : "Bring everyone back to town";
        break;
      case "airlift":
        m.objective = this.player.vehicle?.kind === "heli" ? `Fly through the rings: ${m.points.filter((p) => p.done).length}/5` : "Get in the helicopter (helipad)";
        break;
    }
  }

  /** The intel quiz was answered: true unlocks the terminal, false costs time. */
  answerIntel(terminal: number, right: boolean) {
    const m = this.mission;
    if (!m || m.def.kind !== "intel") return;
    if (right) {
      m.points[terminal].done = true;
      this.reward(10, 8, "Files downloaded +10");
      if (m.points.every((p) => p.done)) this.endMission(true, "Codes cracked!", "All three terminals unlocked.");
    } else {
      m.time = Math.max(1, m.time - 10);
      this.toast("Wrong code: −10 seconds", "#ff5a4e");
    }
    this.updateObjective();
  }

  answerQuiz(right: boolean) {
    if (right) {
      this.save.quizRight++;
      this.reward(8, 6);
    }
  }

  private spawnDrone(x: number, shoots: boolean) {
    const baseY = this.terrain.y(x) - rand(130, 260);
    this.drones.push({ x, y: baseY, baseY, t: rand(0, 10), vx: rand(-60, 60), shoots, fireT: rand(1.5, 3.5) });
  }

  /* ---------- Feedback ---------- */

  toast(text: string, color = "#edeae3") {
    this.toasts.push({ text, t: 3.2, color });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  private dust(x: number, y: number, color: string): Particle {
    return { x, y, vx: rand(-80, 80), vy: rand(-160, -20), life: rand(0.4, 0.9), max: 0.9, color, size: rand(3, 7), grav: 300 };
  }

  confetti(x: number, y: number) {
    const colors = ["#ffb224", "#ff6b8a", "#3fa7ff", "#8bd99b", "#9b6bff"];
    for (let i = 0; i < 50; i++) {
      this.particles.push({ x, y, vx: rand(-320, 320), vy: rand(-520, -120), life: rand(0.8, 1.6), max: 1.6, color: colors[i % colors.length], size: rand(3, 6), grav: 700 });
    }
  }

  private burst(x: number, y: number, color: string, n = 18, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 5), grav: 400 });
    }
  }

  /* ---------- Frame ---------- */

  get dayPhase() {
    return ((this.time / DAY_LENGTH + 0.3) % 1 + 1) % 1;
  }

  /** 1 at noon, 0 at midnight. */
  get daylight() {
    return 0.5 + 0.5 * Math.cos((this.dayPhase - 0.5) * Math.PI * 2);
  }

  focus() {
    const p = this.player;
    return p.vehicle ? { x: p.vehicle.x, y: p.vehicle.y, vx: p.vehicle.vx } : { x: p.x, y: p.y, vx: p.vx };
  }

  update(dt: number) {
    if (this.paused) {
      engineHum(0, 0);
      this.input.pressed.clear();
      return;
    }
    this.time += dt;
    const p = this.player;
    const pressed = this.input.pressed;

    for (const [plot, prog] of this.built) {
      if (prog < 1) {
        const next = Math.min(1, prog + dt / 2.2);
        this.built.set(plot, next);
        if (next >= 1) {
          const k = this.save.plots[plot]!;
          this.syncVehicles();
          sfx.success();
          this.confetti(plotCenter(plot), -120);
          this.toast(`${BUILDINGS[k].label} finished!`, "#8bd99b");
          this.emit({ type: "building", plot });
        } else if (Math.random() < dt * 12) {
          this.particles.push(this.dust(plotCenter(plot) + rand(-100, 100), 0, "#c9b28a"));
        }
      }
    }

    this.incomeT -= dt;
    if (this.incomeT <= 0) {
      this.incomeT = 60;
      const n = this.income();
      if (n > 0) this.reward(n, 0, `Town income +${n} coins`);
    }

    // Prompt for whatever is in reach; E acts on it
    this.prompt = this.findPrompt();
    if (pressed.has("action") && this.prompt && p.downT <= 0) this.prompt.act();
    if (pressed.has("ramp") && !this.creator) this.placeRamp();
    if (pressed.has("home")) this.goHome();

    if (p.downT > 0) {
      p.downT -= dt;
      if (p.downT <= 0) this.respawn();
    } else if (p.vehicle) this.driveVehicle(p.vehicle, dt);
    else this.walk(dt);

    for (const v of this.vehicles) if (v !== p.vehicle) this.idleVehicle(v, dt);

    // Shooting: paint pellets, auto-aimed at the nearest drone in front
    p.fireT -= dt;
    if ((this.input.fire || pressed.has("fire")) && p.fireT <= 0 && p.downT <= 0) this.fire();

    this.updateWorldPickups(dt);
    this.updateProps(dt);
    this.updateMission(dt);
    this.updateDrones(dt);
    this.updateShots(dt);
    this.updateRace(dt);

    for (const q of this.particles) {
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (!this.mission && p.hp < MAX_HP) p.hp = Math.min(MAX_HP, p.hp + dt * 4);
    this.shake = Math.max(0, this.shake - dt * 3);

    // Camera: look ahead in the direction of travel
    const f = this.focus();
    const tx = f.x + Math.max(-260, Math.min(260, f.vx * 0.35));
    const ty = f.y - 130;
    const k = 1 - Math.exp(-dt * 5);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;

    const v = p.vehicle;
    engineHum(v ? Math.min(1, Math.abs(v.vx) / VEHICLES[v.kind].max) : 0, v && v.crashT <= 0 ? 0.05 : 0);
    pressed.clear();
  }

  private findPrompt(): Game["prompt"] {
    const p = this.player;
    if (p.downT > 0) return null;
    if (p.vehicle) {
      const v = p.vehicle;
      if (v.kind === "heli" && !v.grounded) return null;
      return { text: `E — Get off the ${VEHICLES[v.kind].label.toLowerCase()}`, act: () => this.exitVehicle() };
    }
    const m = this.mission;
    if (m?.def.kind === "intel") {
      const i = m.points.findIndex((q) => !q.done && Math.abs(q.x - p.x) < 70);
      if (i >= 0) return { text: `E — Hack ${m.points[i].label}`, act: () => this.emit({ type: "intel", terminal: i }) };
    }
    // Whichever is nearer wins: a parked vehicle or the building you're standing at
    let best: Vehicle | null = null;
    for (const v of this.vehicles) {
      if (Math.abs(v.x - p.x) < 70 && Math.abs(v.y - p.y) < 60 && (!best || Math.abs(v.x - p.x) < Math.abs(best.x - p.x))) best = v;
    }
    let plot = -1;
    if (p.x < TOWN_END) {
      for (let i = 0; i < PLOT_COUNT; i++) if (Math.abs(plotCenter(i) - p.x) <= 105) plot = i;
    }
    // Buildings you use (an empty plot, the barracks, the school) win when they're nearer;
    // buildings that only show their note never block a vehicle
    const k = plot >= 0 ? this.save.plots[plot] : null;
    const usable = plot >= 0 && (!k || k === "barracks" || k === "school");
    if (best && (!usable || Math.abs(best.x - p.x) <= Math.abs(plotCenter(plot) - p.x))) {
      const v = best;
      return { text: `E — Ride the ${VEHICLES[v.kind].label.toLowerCase()}`, act: () => this.enterVehicle(v) };
    }
    if (plot >= 0) {
      const i = plot;
      const k = this.save.plots[i];
      if (!k) return { text: `E — Build on plot ${i + 1}`, act: () => this.emit({ type: "build", plot: i }) };
      if ((this.built.get(i) ?? 0) < 1) return null;
      if (k === "barracks") return { text: "E — Mission board", act: () => this.emit({ type: "missions" }) };
      if (k === "school") return { text: "E — Take a quiz", act: () => this.emit({ type: "school" }) };
      return { text: `E — ${BUILDINGS[k].label}`, act: () => this.emit({ type: "building", plot: i }) };
    }
    if (this.has("workshop") && p.x > TOWN_END + 100) return { text: `R — Place a ramp (${RAMP_COST} coins)`, act: () => this.placeRamp() };
    return null;
  }

  enterVehicle(v: Vehicle) {
    const p = this.player;
    p.vehicle = v;
    v.dir = p.facing;
    sfx.jump();
    this.updateObjective();
  }

  exitVehicle() {
    const p = this.player;
    const v = p.vehicle;
    if (!v) return;
    p.vehicle = null;
    p.x = v.x - v.dir * 46;
    p.y = Math.min(v.y - 10, this.terrain.y(p.x));
    p.vx = v.vx * 0.3;
    p.vy = -200;
    p.grounded = false;
    p.facing = v.dir;
    this.updateObjective();
  }

  goHome() {
    const p = this.player;
    if (p.vehicle) this.exitVehicle();
    for (const v of this.vehicles) Object.assign(v, { x: v.homeX, y: this.terrain.y(v.homeX), vx: 0, vy: 0, angle: 0, grounded: true, crashT: 0 });
    Object.assign(p, { x: SPAWN_X, y: 0, vx: 0, vy: 0, grounded: true });
    this.race = null;
    this.cam.x = SPAWN_X;
    this.toast("Back home. Vehicles returned to their spots.", "#8e8b84");
  }

  private respawn() {
    const p = this.player;
    const hospital = this.save.plots.indexOf("hospital");
    const x = hospital >= 0 ? plotCenter(hospital) : SPAWN_X;
    Object.assign(p, { x, y: 0, vx: 0, vy: 0, grounded: true, hp: MAX_HP, vehicle: null });
    this.toast(hospital >= 0 ? "Patched up at the hospital" : "Back on your feet at home", "#8bd99b");
  }

  private knockOut() {
    const p = this.player;
    if (p.downT > 0) return;
    p.downT = 1.6;
    if (p.vehicle) this.exitVehicle();
    sfx.crash();
    this.burst(p.x, p.y - 40, "#ff5a4e", 30);
    if (this.mission) this.endMission(false, "Knocked out!", "You ran out of health. Grab the hospital's help and try again.");
  }

  private walk(dt: number) {
    const p = this.player;
    const inp = this.input;
    const t = this.terrain;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) p.facing = dir as 1 | -1;
    if (this.boostT <= 0 || Math.abs(p.vx) <= WALK) p.vx = approach(p.vx, dir * WALK, (p.grounded ? 2600 : 1400) * dt);
    if (inp.pressed.has("jump") && p.grounded) {
      p.vy = -JUMP;
      p.grounded = false;
      sfx.jump();
    }
    p.vy += G * dt;
    const y0 = p.y;
    p.x = Math.max(20, Math.min(WORLD_W - 20, p.x + p.vx * dt));
    p.y += p.vy * dt;
    const floor = this.floorAt(p.x, y0, p.vy < 0);
    const gy = floor.y;
    if (p.y >= gy || (p.grounded && p.vy >= 0 && gy - p.y < 16)) {
      if (!p.grounded && p.vy > 900) this.burst(p.x, gy, "#c9b28a", 8, 120);
      p.y = gy;
      p.vy = 0;
      p.grounded = true;
      if (floor.trampoline) {
        p.vy = -1180;
        p.grounded = false;
        sfx.jump();
      }
    } else p.grounded = false;
    p.phase += Math.abs(p.vx) * dt * 0.045;
    if (p.grounded && Math.abs(p.vx) > 50 && Math.random() < dt * 6) this.particles.push(this.dust(p.x, gy, "rgba(200,180,140,0.6)"));
  }

  private driveVehicle(v: Vehicle, dt: number) {
    const inp = this.input;
    const def = VEHICLES[v.kind];
    const t = this.terrain;
    const throttle = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const lean = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);

    if (v.crashT > 0) {
      v.crashT -= dt;
      v.vx *= 1 - 3 * dt;
      if (v.crashT <= 0) {
        const fl = this.floorAt(v.x, v.y);
        v.angle = Math.atan(fl.slope);
        v.y = fl.y;
        v.grounded = true;
      }
      return;
    }

    if (v.kind === "heli") {
      v.vx = approach(v.vx, throttle * def.max, (throttle ? def.accel : 350) * dt);
      const climb = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      v.vy = approach(v.vy, climb * 420 + (climb === 0 ? 30 : 0), 800 * dt);
      if (throttle) v.dir = throttle as 1 | -1;
      v.x = Math.max(60, Math.min(WORLD_W - 60, v.x + v.vx * dt));
      const hy0 = v.y;
      v.y = Math.max(-1100, v.y + v.vy * dt);
      const hf = this.floorAt(v.x, hy0, v.vy < 0);
      const gy = hf.y;
      if (v.y >= gy) {
        v.y = gy;
        v.vy = Math.min(0, v.vy);
        v.grounded = true;
        v.vx *= 1 - 4 * dt;
      } else v.grounded = false;
      v.angle += ((v.grounded ? Math.atan(hf.slope) : (v.vx / def.max) * 0.25) - v.angle) * Math.min(1, dt * 6);
      v.wheel += dt * (v.grounded && Math.abs(v.vy) < 1 && !throttle ? 14 : 40);
      return;
    }

    if (v.grounded) {
      const s = this.floorAt(v.x, v.y).slope;
      const th = Math.atan(s);
      if (throttle) {
        const braking = Math.sign(v.vx) !== throttle && Math.abs(v.vx) > 40;
        v.vx += throttle * def.accel * (braking ? 1.8 : 1) * dt;
        if (Math.abs(v.vx) < 120 || !braking) v.dir = throttle as 1 | -1;
      } else v.vx *= 1 - 1.1 * dt;
      v.vx += G * Math.sin(th) * Math.cos(th) * 0.8 * dt;
      const cap = def.max * (this.boostT > 0 ? 1.45 : 1);
      v.vx = Math.max(-cap, Math.min(cap, v.vx));
      v.vy = s * v.vx;
      v.angle += (th - v.angle) * Math.min(1, dt * 14);
      if (Math.abs(v.vx) > 200 && Math.random() < dt * 10) this.particles.push(this.dust(v.x - v.dir * 30, v.y, "rgba(200,180,140,0.6)"));
    } else {
      v.vy += G * dt;
      const spin = lean * def.air * dt * v.dir;
      v.angle += spin;
      v.airRot += spin;
    }

    const vy0 = v.y;
    v.x = Math.max(60, Math.min(WORLD_W - 60, v.x + v.vx * dt));
    if (v.x <= 60 || v.x >= WORLD_W - 60) v.vx = 0;
    v.y += v.vy * dt;
    v.wheel += (v.vx * dt) / 14;
    const vf = this.floorAt(v.x, vy0, v.vy < -60);
    const gy = vf.y;
    if (v.y >= gy || (v.grounded && gy - v.y < 7)) {
      if (!v.grounded) this.land(v, vf.y, vf.slope);
      if (v.crashT <= 0) {
        v.y = gy;
        v.grounded = true;
        if (vf.trampoline) {
          v.vy = -1150;
          v.grounded = false;
          v.airRot = 0;
          sfx.jump();
        }
      }
    } else {
      if (v.grounded) v.airRot = 0;
      v.grounded = false;
    }
  }

  private land(v: Vehicle, floorY: number, slope: number) {
    const target = Math.atan(slope);
    const diff = wrap(v.angle - target);
    const tolerance = v.kind === "bike" ? 1.0 : 1.4;
    const p = this.player;
    v.y = floorY;
    if (Math.abs(diff) > tolerance) {
      v.crashT = 1.1;
      v.vx *= 0.2;
      v.vy = 0;
      this.shake = 1;
      sfx.crash();
      this.burst(v.x, v.y - 20, "#c9b28a", 26, 300);
      this.toast("Wipeout! Land with your wheels down (W/S to lean)", "#ff5a4e");
      p.hp = Math.max(1, p.hp - 6);
      v.airRot = 0;
      return;
    }
    const flips = Math.floor((Math.abs(v.airRot) + 1.2) / (Math.PI * 2));
    if (flips > 0) {
      const coins = flips * 15;
      this.save.flips += flips;
      sfx.flip();
      this.reward(coins, flips * 5, `${flips * 360}° ${flips > 1 ? `${flips}× flip` : "flip"}! +${coins}`);
      this.confetti(v.x, v.y - 60);
    } else if (Math.abs(v.vy) > 700) this.burst(v.x, v.y, "#c9b28a", 10, 180);
    v.vx *= Math.cos(diff);
    v.angle = target;
    v.airRot = 0;
    v.vy = 0;
  }

  private idleVehicle(v: Vehicle, dt: number) {
    v.crashT = 0;
    const fl = this.floorAt(v.x, v.y);
    const gy = fl.y;
    if (v.y < gy - 1) {
      v.vy += G * dt;
      v.y = Math.min(gy, v.y + v.vy * dt);
      v.x += v.vx * dt;
      v.grounded = false;
    } else {
      v.y = gy;
      v.vy = 0;
      v.vx *= 1 - 3 * dt;
      v.x += v.vx * dt;
      v.grounded = true;
      v.angle += (Math.atan(fl.slope) - v.angle) * Math.min(1, dt * 8);
    }
  }

  private fire() {
    const p = this.player;
    const v = p.vehicle;
    const dir = v ? v.dir : p.facing;
    const ox = (v ? v.x : p.x) + dir * (v ? 50 : 22);
    const oy = (v ? v.y - (v.kind === "heli" ? 18 : 42) : p.y - 42);
    let tx = ox + dir * 600;
    let ty = oy;
    let bestD = 760;
    for (const d of this.drones) {
      const dx = d.x - ox;
      if (Math.sign(dx) !== dir && Math.abs(dx) > 30) continue;
      const dist = Math.hypot(dx, d.y - oy);
      if (dist < bestD) {
        bestD = dist;
        tx = d.x;
        ty = d.y;
      }
    }
    const a = Math.atan2(ty - oy, tx - ox);
    const colors = ["#ff6b8a", "#3fa7ff", "#8bd99b", "#ffb224"];
    this.shots.push({ x: ox, y: oy, vx: Math.cos(a) * 980, vy: Math.sin(a) * 980, life: 1, enemy: false, color: colors[Math.floor(this.time * 7) % 4] });
    p.fireT = 0.2;
    sfx.shoot();
  }

  private updateWorldPickups(dt: number) {
    const p = this.player;
    const f = this.focus();
    const cx = f.x;
    const cy = f.y - (p.vehicle?.kind === "heli" ? 10 : 40);
    for (const c of this.coins) {
      if (c.wait > 0) {
        c.wait -= dt;
        continue;
      }
      if (Math.abs(c.x - cx) < 34 && Math.abs(c.y - cy) < 52) {
        c.wait = 75;
        this.save.coins += 2;
        sfx.coin();
        this.particles.push({ x: c.x, y: c.y, vx: 0, vy: -120, life: 0.5, max: 0.5, color: "#ffb224", size: 5, grav: 0 });
      }
    }
    for (const b of this.books) {
      if (Math.abs(b.x - cx) < 40 && Math.abs(b.y - cy) < 60) {
        this.books = this.books.filter((x) => x !== b);
        this.save.facts.push(b.index);
        sfx.page();
        this.reward(15, 10, `Fact found: ${FACTS[b.index].title} (+15)`);
        this.emit({ type: "fact", index: b.index });
        break;
      }
    }
    // The hospital heals you as you pass
    const h = this.save.plots.indexOf("hospital");
    if (h >= 0 && (this.built.get(h) ?? 0) >= 1 && Math.abs(plotCenter(h) - cx) < 110 && p.hp < MAX_HP) p.hp = Math.min(MAX_HP, p.hp + dt * 40);
  }

  private updateMission(dt: number) {
    const m = this.mission;
    if (!m) return;
    m.time -= dt;
    if (m.time <= 0) {
      this.endMission(false, "Out of time!", `${m.def.title} failed. You can try again from the mission board.`);
      return;
    }
    const f = this.focus();
    const p = this.player;
    const near = (q: Point, r = 80) => Math.abs(q.x - f.x) < r && Math.abs(q.y - f.y) < 140;
    switch (m.def.kind) {
      case "recon":
        if (m.stage === 0 && near(m.points[0])) {
          m.points[0].done = true;
          m.stage = 1;
          sfx.right();
          this.toast("Watchtower scouted! Now head home.", "#8bd99b");
        } else if (m.stage === 1 && f.x < TOWN_END) {
          m.points[1].done = true;
          this.endMission(true, "Recon complete", "Area scouted and back safe.");
        }
        break;
      case "supply":
        if (!m.carrying && near(m.points[0])) {
          m.carrying = true;
          m.points[0].done = true;
          sfx.right();
          this.toast("Crate loaded!", "#8bd99b");
        } else if (m.carrying && near(m.points[1], 110)) {
          m.points[1].done = true;
          this.endMission(true, "Supplies delivered", "The outpost is stocked.");
        }
        break;
      case "drill":
        if (this.drones.length < 3 && m.kills + this.drones.length < m.need) this.spawnDrone(rand(6000, 9700), false);
        break;
      case "defend":
        if (this.drones.length < 5) this.spawnDrone(rand(Math.max(6200, f.x - 900), Math.min(9800, f.x + 900)), true);
        break;
      case "rescue": {
        const i = m.points.findIndex((q, k) => k < 3 && !q.done && near(q, 70));
        if (i >= 0) {
          m.points[i].done = true;
          m.aboard++;
          sfx.right();
          this.toast(`Hiker rescued (${m.aboard}/3)`, "#8bd99b");
        }
        if (m.aboard === 3 && f.x < TOWN_END) {
          m.points[3].done = true;
          this.endMission(true, "Everyone's safe", "Three hikers rescued.");
        }
        break;
      }
      case "airlift":
        if (p.vehicle?.kind === "heli") {
          const r = m.points.find((q) => !q.done && Math.hypot(q.x - f.x, q.y - (f.y - 10)) < 75);
          if (r) {
            r.done = true;
            sfx.right();
            this.burst(r.x, r.y, "#ffb224", 22);
            if (m.points.every((q) => q.done)) this.endMission(true, "Airlift complete", "All signal rings cleared.");
          }
        }
        break;
    }
    this.updateObjective();
  }

  private updateDrones(dt: number) {
    const f = this.focus();
    const px = f.x;
    const py = f.y - 35;
    for (const d of this.drones) {
      d.t += dt;
      d.x += d.vx * dt + Math.sin(d.t * 0.7) * 40 * dt;
      if (d.x < 5900 || d.x > 9900) d.vx = -d.vx;
      d.y = d.baseY + Math.sin(d.t * 1.7) * 26;
      if (d.shoots && Math.abs(d.x - px) < 700) {
        d.fireT -= dt;
        if (d.fireT <= 0) {
          d.fireT = rand(2.2, 3.6);
          const a = Math.atan2(py - d.y, px - d.x);
          this.shots.push({ x: d.x, y: d.y + 10, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 3, enemy: true, color: "#ff5a4e" });
        }
      }
    }
  }

  private updateShots(dt: number) {
    const f = this.focus();
    const p = this.player;
    const m = this.mission;
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.y > this.terrain.y(s.x)) {
        s.life = 0;
        this.burst(s.x, s.y, s.color, 5, 100);
        continue;
      }
      if (s.enemy) {
        if (p.downT <= 0 && Math.abs(s.x - f.x) < 26 && Math.abs(s.y - (f.y - 35)) < 40) {
          s.life = 0;
          p.hp -= 9;
          p.hurtT = 0.4;
          this.shake = 0.5;
          sfx.hurt();
          if (p.hp <= 0) this.knockOut();
        }
        continue;
      }
      for (const d of this.drones) {
        if (Math.hypot(d.x - s.x, d.y - s.y) < 28) {
          s.life = 0;
          this.drones = this.drones.filter((x) => x !== d);
          sfx.pop();
          this.burst(d.x, d.y, s.color, 24, 320);
          this.burst(d.x, d.y, "#2a2a30", 10, 200);
          this.save.coins += 3;
          if (m && (m.def.kind === "drill" || m.def.kind === "defend")) {
            m.kills++;
            if (m.kills >= m.need) this.endMission(true, m.def.kind === "drill" ? "Drill passed" : "Outpost held", `${m.need} drones popped.`);
          }
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private updateRace(dt: number) {
    const f = this.focus();
    const inVehicle = !!this.player.vehicle;
    if (this.race) {
      this.race.t += dt;
      if (f.x < RACE_START - 40 || !inVehicle) {
        this.race = null;
        this.toast("Race cancelled", "#8e8b84");
      } else if (f.x >= RACE_END) {
        const t = this.race.t;
        this.race = null;
        const best = this.save.bestRace;
        const record = best === null || t < best;
        if (record) this.save.bestRace = t;
        const reward = Math.max(10, Math.round(140 - t * 3));
        const km = (RACE_END - RACE_START) / PX_PER_M / 1000;
        this.lastRace = { t, reward, at: this.time };
        this.reward(reward, 20, `${record ? "New record! " : ""}${t.toFixed(2)} s · avg ${(km / (t / 3600)).toFixed(0)} km/h · +${reward}`);
        sfx.success();
        this.confetti(f.x, f.y - 80);
      }
    } else if (inVehicle && f.x > RACE_START && f.x < RACE_START + 60 && f.vx > 50) {
      this.race = { t: 0 };
      this.toast("Race on! Reach the finish flag at the end of the hills", "#ffb224");
      sfx.right();
    }
  }

  /** km/h for the speedometer. */
  speedKmh() {
    const v = this.player.vehicle;
    const vx = v ? Math.hypot(v.vx, v.kind === "heli" ? v.vy : 0) : this.player.vx;
    return Math.round((Math.abs(vx) / PX_PER_M) * 3.6);
  }
}
