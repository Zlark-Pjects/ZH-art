/* Stickville City: the simulation. The hero on foot and at the wheel, traffic, people, drones and
   guard bots, missions, races, jobs, stunts, the people's story steps and the money that ties
   it together. Drawing is in render.ts; menus and the phone are in CityView.tsx. */

import {
  CONTACTS,
  CONTACT_ORDER,
  CITIZEN_TOPS,
  HARD_QUESTIONS,
  MISSIONS,
  PLOTS,
  QUIPS,
  RACES,
  UPGRADES,
  levelOf,
  type ContactId,
  type Hero,
  type MissionDef,
  type Paint,
  type PlotKind,
  type Question,
  type RaceDef,
  type StepDef,
  type UpgradeId,
} from "./data";
import { sfx, engineHum } from "./audio";
import { ART, CityMap, H, MIL_X, T, Tile, W, type Place } from "./map";
import type { Station } from "./music";

export const PPM = 24;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- Save ---------- */

export interface BuilderProp {
  id: number;
  kind: string;
  x: number;
  y: number;
  heading?: number;
  text?: string;
  color?: string;
}

export interface Pack {
  id: string;
  name: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  solid: boolean;
  src: string;
}

export interface QuestState {
  step: number;
  accepted: boolean;
  carrying?: boolean;
  found?: boolean;
  ready?: boolean;
}

export interface Save {
  v: 2;
  hero: Hero | null;
  money: number;
  xp: number;
  plots: (PlotKind | null)[];
  upgrades: UpgradeId[];
  paint: Paint;
  paints: Paint[];
  style: string[];
  missions: Record<string, { stars: number; best?: number }>;
  races: Record<string, { best?: number; wins: number }>;
  quests: Partial<Record<ContactId, QuestState>>;
  deliveries: number;
  bestStunt: number;
  bestDrift: number;
  triviaBest: number;
  stats: { drones: number; fares: number; jumps: number; metres: number };
  props: BuilderProp[];
  packs: Pack[];
  myQuestions: Question[];
  nextPropId: number;
  station: Station;
}

export const newSave = (): Save => ({
  v: 2,
  hero: null,
  money: 250,
  xp: 0,
  plots: Array(6).fill(null),
  upgrades: [],
  paint: "blue",
  paints: ["blue"],
  style: [],
  missions: {},
  races: {},
  quests: {},
  deliveries: 0,
  bestStunt: 0,
  bestDrift: 0,
  triviaBest: 0,
  stats: { drones: 0, fares: 0, jumps: 0, metres: 0 },
  props: [],
  packs: [],
  myQuestions: [],
  nextPropId: 1,
  station: "lofi",
});

/* ---------- Entities ---------- */

export type VKind = "car" | "taxi" | "bike" | "jeep" | "truck" | "heli";

export const SPECS: Record<VKind, { max: number; accel: number; turn: number; grip: number; r: number; hp: number; label: string }> = {
  car: { max: 540, accel: 440, turn: 2.7, grip: 7, r: 20, hp: 150, label: "car" },
  taxi: { max: 520, accel: 420, turn: 2.6, grip: 7, r: 20, hp: 150, label: "taxi" },
  bike: { max: 620, accel: 560, turn: 3.6, grip: 9, r: 12, hp: 90, label: "dirt bike" },
  jeep: { max: 480, accel: 400, turn: 2.4, grip: 8, r: 22, hp: 260, label: "army jeep" },
  truck: { max: 300, accel: 220, turn: 1.6, grip: 9, r: 30, hp: 320, label: "supply truck" },
  heli: { max: 500, accel: 420, turn: 3, grip: 3, r: 26, hp: 200, label: "helicopter" },
};

export interface Vehicle {
  id: number;
  kind: VKind;
  sprite: string;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  spin: number;
  air: number;
  hp: number;
  role: "parked" | "player" | "traffic" | "racer" | "convoy";
  /** Traffic: lane direction 0 E, 1 S, 2 W, 3 N, and a pending turn. */
  dir: number;
  turn: { dir: number; at: number } | null;
  wait: number;
  /** Racer/convoy: index of the next waypoint. */
  wp: number;
  lap: number;
  finished: number;
  name?: string;
  owned?: boolean;
  homeX?: number;
  homeY?: number;
}

export interface Ped {
  id: number;
  x: number;
  y: number;
  dir: number;
  speed: number;
  look: Hero;
  phase: number;
  dodge: number;
  dvx: number;
  dvy: number;
  quip: string;
  quipT: number;
  hail?: boolean;
  follow?: number;
}

export interface Drone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  hp: number;
  max: number;
  boss: boolean;
  fireT: number;
  orbit: number;
  target: "player" | "truck";
}

export interface Bot {
  x: number;
  y: number;
  a: number;
  path: { x: number; y: number }[];
  pi: number;
  alert: number;
  fireT: number;
  hp: number;
  stun: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  enemy: boolean;
  dmg: number;
  color: string;
  /** Ground-level shots (guard bots) are stopped by walls; airborne ones fly over. */
  ground?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Marker {
  x: number;
  y: number;
  kind: "photo" | "terminal" | "hostage" | "item" | "goal" | "checkpoint" | "door" | "start";
  label: string;
  done?: boolean;
  progress?: number;
  r?: number;
}

export interface MissionRun {
  def: MissionDef;
  t: number;
  wave: number;
  kills: number;
  need: number;
  markers: Marker[];
  truck: Vehicle | null;
  hostages: Ped[];
  wrong: number;
  detect: number;
  objective: string;
  started: boolean;
}

export interface RaceRun {
  def: RaceDef;
  countdown: number;
  t: number;
  wp: number;
  lap: number;
  racers: Vehicle[];
  placed: number;
}

export interface JobRun {
  kind: "pizza" | "taxi";
  target: Place | null;
  t: number;
  count: number;
  combo: number;
  earned: number;
  passenger: Ped | null;
  fare: number;
}

export interface Toast {
  text: string;
  t: number;
  color: string;
  big?: boolean;
}

export type CityEvent =
  | { type: "save" }
  | { type: "talk"; id: ContactId }
  | { type: "plot"; index: number }
  | { type: "shop"; shop: "mods" | "armory" | "style" }
  | { type: "trivia"; hard: boolean }
  | { type: "terminal"; index: number; question: Question }
  | { type: "result"; ok: boolean; title: string; text: string; stars?: number };

export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  boost: boolean;
  fire: boolean;
  /** Ground point the mouse is aiming at, if any. */
  aim: { x: number; y: number } | null;
  /** Touch joystick: a direction to move in, length 0..1. */
  stick: { x: number; y: number } | null;
  pressed: Set<"action" | "fire" | "home">;
}

export const newInput = (): Input => ({ up: false, down: false, left: false, right: false, brake: false, boost: false, fire: false, aim: null, stick: null, pressed: new Set() });

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  phase: number;
  hp: number;
  shield: number;
  hurtT: number;
  calmT: number;
  fireT: number;
  vehicle: Vehicle | null;
  downT: number;
}

const DAY = 360;

export class City {
  map = new CityMap();
  save: Save;
  input = newInput();
  player: Player;
  vehicles: Vehicle[] = [];
  peds: Ped[] = [];
  drones: Drone[] = [];
  bots: Bot[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  toasts: Toast[] = [];
  mission: MissionRun | null = null;
  race: RaceRun | null = null;
  job: JobRun | null = null;
  gps: Place | null = null;
  prompt: { text: string; act: () => void } | null = null;
  time = 0;
  incomeT = 60;
  paused = false;
  cam = { x: 0, y: 0, zoom: 1 };
  shake = 0;
  nitro = 1;
  boostT = 0;
  drift = 0;
  stunt: { score: number; t: number; label: string } | null = null;
  /** The thing a story step sent you to find, while it's still out in the world. */
  questItem: { contact: ContactId; item: Place; label: string } | null = null;
  builder = false;
  selected: number | null = null;
  ghost: { x: number; y: number; kind: string } | null = null;
  camOffset = { x: 0, y: 0 };
  view = { x: 0, y: 0, scale: 1, w: 1, h: 1 };
  dyn: Uint8Array;
  propCoin = new Map<number, number>();
  talking: number | null = null;
  private nextId = 1;
  private emit: (e: CityEvent) => void;

  constructor(save: Save, emit: (e: CityEvent) => void) {
    this.save = save;
    this.emit = emit;
    this.dyn = new Uint8Array(this.map.cw * this.map.ch);
    const home = this.map.places.home;
    this.player = { x: home.x, y: home.y, vx: 0, vy: 0, facing: 1, phase: 0, hp: 100, shield: 0, hurtT: 0, calmT: 0, fireT: 0, vehicle: null, downT: 0 };
    this.cam.x = home.x;
    this.cam.y = home.y;
    this.refreshProps();
    this.syncOwned();
    // A few parked cars around town to borrow
    for (const [c, r, kind] of [[9, 23, "car"], [40, 9, "taxi"], [57, 33, "car"], [26, 45, "car"], [75, 22, "jeep"]] as [number, number, VKind][]) {
      this.vehicles.push(this.makeVehicle(kind, c * T + 32, r * T + 32, 0, "parked", kind === "car" ? (["red", "green", "white", "purple"] as const)[c % 4] : undefined));
    }
    for (let i = 0; i < 40; i++) this.spawnPed(true);
  }

  /* ---------- Helpers ---------- */

  rank() {
    return levelOf(this.save.xp);
  }
  has(u: UpgradeId) {
    return this.save.upgrades.includes(u);
  }
  built(k: PlotKind) {
    return this.save.plots.includes(k);
  }

  focus() {
    const v = this.player.vehicle;
    return v ? { x: v.x, y: v.y, vx: v.vx, vy: v.vy, z: v.z } : { x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy, z: 0 };
  }

  toast(text: string, color = "#edeae3", big = false) {
    this.toasts.push({ text, t: big ? 2.6 : 3.2, color, big });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  reward(money: number, xp: number, label?: string) {
    const before = this.rank().level;
    this.save.money += money;
    this.save.xp += xp;
    if (label) this.toast(label, "#ffb224");
    const after = this.rank().level;
    if (after > before) {
      this.toast(`LEVEL ${after}`, "#8bd99b", true);
      sfx.success();
      this.confetti(this.player.x, this.player.y);
      this.checkUnlocks(after);
    }
    this.emit({ type: "save" });
  }

  private checkUnlocks(level: number) {
    for (const m of MISSIONS) if (m.level === level) this.toast(`New mission unlocked: ${m.title}`, "#ffb224");
    for (const r of RACES) if (r.level === level) this.toast(`New race unlocked: ${r.title}`, "#ffb224");
  }

  spend(n: number) {
    if (this.save.money < n) {
      this.toast(`You need $${n - this.save.money} more`, "#ff5a4e");
      sfx.wrong();
      return false;
    }
    this.save.money -= n;
    sfx.coin();
    this.emit({ type: "save" });
    return true;
  }

  private makeVehicle(kind: VKind, x: number, y: number, a: number, role: Vehicle["role"], paint?: Paint): Vehicle {
    const sprite = kind === "car" ? `car_${paint ?? "blue"}` : kind;
    return { id: this.nextId++, kind, sprite, x, y, a, vx: 0, vy: 0, z: 0, vz: 0, spin: 0, air: 0, hp: SPECS[kind].hp, role, dir: 0, turn: null, wait: 0, wp: 0, lap: 0, finished: 0 };
  }

  /** The vehicles you own sit outside your block: a bike from the start, then the garage car and helicopter. */
  syncOwned() {
    const want: [VKind, number, number][] = [["bike", this.map.places.home.x - 170, this.map.places.home.y + 30]];
    this.save.plots.forEach((k, i) => {
      const p = this.map.plots[i];
      if (k === "garage") want.push(["car", p.x, p.y + 60]);
      if (k === "helipad") want.push(["heli", p.x, p.y - 70]);
    });
    for (const [kind, x, y] of want) {
      let v = this.vehicles.find((q) => q.owned && q.kind === kind);
      if (!v) {
        v = this.makeVehicle(kind, x, y, 0, "parked", kind === "car" ? this.save.paint : undefined);
        v.owned = true;
        this.vehicles.push(v);
      }
      v.homeX = x;
      v.homeY = y;
      if (kind === "car") v.sprite = `car_${this.save.paint}`;
    }
  }

  get dayPhase() {
    return (((this.time + 0.32 * DAY) / DAY) % 1 + 1) % 1;
  }
  get daylight() {
    return clamp(0.5 + 0.7 * Math.cos((this.dayPhase - 0.5) * TAU), 0, 1);
  }

  /* ---------- Collision ---------- */

  blocked(x: number, y: number, r: number, swim = false) {
    if (this.map.blocked(x, y, r, swim)) return true;
    for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const cx = Math.floor((x + dx) / 16);
      const cy = Math.floor((y + dy * 0.6) / 16);
      if (cx >= 0 && cy >= 0 && cx < this.map.cw && cy < this.map.ch && this.dyn[cy * this.map.cw + cx]) return true;
    }
    return false;
  }

  /** Move a body with axis-separated collision; returns which axes hit. */
  private move(o: { x: number; y: number }, dx: number, dy: number, r: number, swim = false) {
    let hitX = false;
    let hitY = false;
    if (!this.blocked(o.x + dx, o.y, r, swim)) o.x += dx;
    else hitX = true;
    if (!this.blocked(o.x, o.y + dy, r, swim)) o.y += dy;
    else hitY = true;
    o.x = clamp(o.x, 20, W - 20);
    o.y = clamp(o.y, 20, H - 20);
    return { hitX, hitY };
  }

  /* ---------- Frame ---------- */

  update(dt: number) {
    if (this.paused) {
      engineHum(0, 0);
      this.input.pressed.clear();
      return;
    }
    this.time += dt;
    const p = this.player;
    const pressed = this.input.pressed;

    this.incomeT -= dt;
    if (this.incomeT <= 0) {
      this.incomeT = 60;
      const n = this.save.plots.reduce((s, k) => s + (k ? PLOTS[k].income : 0), 0);
      if (n) this.reward(n, 0, `Income +$${n}`);
    }

    this.prompt = this.findPrompt();
    if (pressed.has("action") && this.prompt && p.downT <= 0) this.prompt.act();
    if (pressed.has("home")) this.goHome();

    if (p.downT > 0) {
      p.downT -= dt;
      if (p.downT <= 0) this.respawn();
    } else if (p.vehicle) this.drive(p.vehicle, dt);
    else this.walk(dt);

    p.fireT -= dt;
    if ((this.input.fire || pressed.has("fire")) && p.fireT <= 0 && p.downT <= 0 && !this.builder) this.fire();
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.calmT += dt;
    if (p.calmT > 4) {
      if (this.has("shield")) p.shield = Math.min(50, p.shield + dt * 12);
      if (!this.mission) p.hp = Math.min(100, p.hp + dt * 5);
    }
    if (this.map.places.hospital && dist(p, this.map.places.hospital) < 90) p.hp = 100;

    for (const v of this.vehicles) {
      if (v === p.vehicle) continue;
      if (v.role === "traffic") this.traffic(v, dt);
      else if (v.role === "racer") this.racer(v, dt);
      else if (v.role === "convoy") this.convoy(v, dt);
      else this.coast(v, dt);
    }
    this.manageTraffic();
    this.updatePeds(dt);
    this.updateMission(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateRace(dt);
    this.updateJob(dt);
    this.updateQuests();
    this.updateProps(dt);

    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.vz -= 300 * dt;
      if (q.z < 0) q.z = 0;
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.stunt) {
      this.stunt.t -= dt;
      if (this.stunt.t <= 0) this.stunt = null;
    }
    this.shake = Math.max(0, this.shake - dt * 3);

    // Camera: lead the way you're going, pull back at speed
    const f = this.focus();
    const speed = Math.hypot(f.vx, f.vy);
    const k = 1 - Math.exp(-dt * 4);
    this.cam.x += (f.x + f.vx * 0.45 - this.cam.x) * k;
    this.cam.y += (f.y + f.vy * 0.45 - this.cam.y) * k;
    const zoom = p.vehicle ? (p.vehicle.kind === "heli" && p.vehicle.z > 20 ? 0.8 : 1 - Math.min(0.18, speed / 3000)) : 1.1;
    this.cam.zoom += (zoom - this.cam.zoom) * (1 - Math.exp(-dt * 2));
    if (this.input.up || this.input.down || this.input.left || this.input.right || this.input.stick) {
      this.camOffset.x *= Math.exp(-dt * 3);
      this.camOffset.y *= Math.exp(-dt * 3);
    }

    const v = p.vehicle;
    engineHum(v ? Math.min(1, Math.hypot(v.vx, v.vy) / SPECS[v.kind].max) : 0, v ? 0.04 : 0);
    this.save.stats.metres += (speed * dt) / PPM;
    pressed.clear();
  }

  /* ---------- On foot ---------- */

  private moveIntent() {
    const i = this.input;
    if (i.stick) return { x: i.stick.x, y: i.stick.y };
    let x = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    let y = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    const n = Math.hypot(x, y);
    if (n > 1) {
      x /= n;
      y /= n;
    }
    return { x, y };
  }

  private walk(dt: number) {
    const p = this.player;
    const m = this.moveIntent();
    const speed = this.input.boost ? 250 : 160;
    p.vx += (m.x * speed - p.vx) * Math.min(1, dt * 12);
    p.vy += (m.y * speed - p.vy) * Math.min(1, dt * 12);
    if (Math.abs(m.x) > 0.1) p.facing = m.x > 0 ? 1 : -1;
    if (this.input.aim && (this.input.fire || p.fireT > -0.3)) p.facing = this.input.aim.x >= p.x ? 1 : -1;
    const swim = false;
    this.move(p, p.vx * dt, p.vy * dt, 9, swim);
    // No vehicles in the Red Zone: they'd be heard a mile off
    p.phase += Math.hypot(p.vx, p.vy) * dt * 0.06;
  }

  enter(v: Vehicle) {
    const p = this.player;
    if (v.role === "traffic") {
      v.role = "parked";
      const driver = this.spawnPedAt(v.x + 30, v.y + 20);
      if (driver) {
        driver.quip = "My car!";
        driver.quipT = 2;
      }
    }
    if (this.mission && (this.mission.def.kind === "stealth" || this.mission.def.kind === "hack" || this.mission.def.kind === "extract") && this.map.zoneAt(v.x, v.y) === 2) return;
    v.role = "player";
    p.vehicle = v;
    sfx.jump();
  }

  exit() {
    const p = this.player;
    const v = p.vehicle;
    if (!v) return;
    if (v.kind === "heli" && v.z > 4) {
      this.toast("Land first: stop moving and the helicopter comes down", "#ff5a4e");
      return;
    }
    p.vehicle = null;
    v.role = "parked";
    const side = { x: -Math.sin(v.a) * 34, y: Math.cos(v.a) * 34 };
    p.x = v.x + side.x;
    p.y = v.y + side.y;
    if (this.blocked(p.x, p.y, 9)) {
      p.x = v.x - side.x;
      p.y = v.y - side.y;
    }
    p.vx = p.vy = 0;
  }

  /* ---------- Driving ---------- */

  private drive(v: Vehicle, dt: number) {
    const spec = SPECS[v.kind];
    const i = this.input;
    const engine = this.has("engine") ? 1.2 : 1;
    const gripUp = this.has("grip") ? 1.4 : 1;
    let throttle = (i.up ? 1 : 0) - (i.down ? 1 : 0);
    let steer = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    if (i.stick) {
      // The touch stick points where you want to go: steer toward it
      const want = Math.atan2(i.stick.y, i.stick.x);
      const n = Math.hypot(i.stick.x, i.stick.y);
      if (n > 0.2) {
        const d = wrap(want - v.a);
        const backwards = Math.abs(d) > 2.4 && Math.hypot(v.vx, v.vy) < 80;
        throttle = backwards ? -n : n * (Math.abs(d) > 1.6 ? 0.4 : 1);
        steer = backwards ? 0 : clamp(d * 2, -1, 1);
      }
    }

    if (v.kind === "heli") return this.fly(v, dt);

    const fx = Math.cos(v.a);
    const fy = Math.sin(v.a);
    let fwd = v.vx * fx + v.vy * fy;
    let lat = -v.vx * fy + v.vy * fx;
    const grounded = v.z <= 0;
    let max = spec.max * engine;
    let accel = spec.accel;
    const nitroOn = i.boost && this.has("nitro") && this.nitro > 0 && grounded;
    if (nitroOn) {
      max *= 1.4;
      accel *= 1.9;
      this.nitro = Math.max(0, this.nitro - dt * 0.35);
      if (Math.random() < dt * 30) this.puff(v.x - fx * 30, v.y - fy * 30, "#3fa7ff", 6);
    }
    if (this.boostT > 0) {
      this.boostT -= dt;
      max *= 1.5;
    }
    if (grounded) {
      if (throttle > 0) fwd += accel * throttle * dt;
      else if (throttle < 0) fwd += (fwd > 30 ? -accel * 1.6 : -accel * 0.6) * -throttle * dt;
      else fwd *= 1 - 1.2 * dt;
      fwd = clamp(fwd, -max * 0.4, max);
      const speedK = clamp(Math.abs(fwd) / 220, 0, 1);
      const turnRate = spec.turn * (this.has("grip") ? 1.15 : 1) * speedK * Math.sign(fwd || 1) * (i.brake ? 1.35 : 1);
      v.a += steer * turnRate * dt;
      // Grip: kill sideways slide, less so with the handbrake (that's a drift)
      const grip = (i.brake ? 1.4 : spec.grip * gripUp) * dt;
      lat *= Math.max(0, 1 - grip);
      if (i.brake) fwd *= 1 - 0.5 * dt;
      // Drift scoring and tyre smoke
      if (Math.abs(lat) > 110 && Math.abs(fwd) > 150) {
        this.drift += Math.abs(lat) * dt * 0.6;
        this.nitro = Math.min(1, this.nitro + dt * 0.25);
        if (Math.random() < dt * 25) this.puff(v.x - fx * 24, v.y - fy * 24, "#d8d4cc", 5);
      } else if (this.drift > 0) this.bankDrift();
    } else {
      // In the air: A/D spins you
      v.spin += steer * 7 * dt;
      v.vz -= 1100 * dt;
      v.air += dt;
    }
    v.vx = fx * fwd - fy * lat;
    v.vy = fy * fwd + fx * lat;

    const before = Math.hypot(v.vx, v.vy);
    const hit = grounded ? this.move(v, v.vx * dt, v.vy * dt, spec.r) : (v.x = clamp(v.x + v.vx * dt, 20, W - 20), v.y = clamp(v.y + v.vy * dt, 20, H - 20), { hitX: false, hitY: false });
    if (hit.hitX || hit.hitY) {
      if (hit.hitX) v.vx *= -0.3;
      if (hit.hitY) v.vy *= -0.3;
      if (before > 160) {
        this.shake = Math.min(1, before / 600);
        sfx.crash();
        this.sparks(v.x + fx * spec.r, v.y + fy * spec.r);
        this.damageVehicle(v, before / 30);
      }
    }
    if (!grounded) {
      v.z += v.vz * dt;
      if (v.z <= 0) this.land(v);
    }
    this.checkRamps(v);
    this.bumpOthers(v, dt);
  }

  private bankDrift() {
    const pts = Math.round(this.drift);
    this.drift = 0;
    if (pts < 60) return;
    const cash = Math.round(pts / 25);
    this.save.bestDrift = Math.max(this.save.bestDrift, pts);
    this.reward(cash, Math.round(pts / 40));
    this.stunt = { score: pts, t: 1.6, label: `DRIFT ${pts}` };
  }

  private fly(v: Vehicle, dt: number) {
    const m = this.moveIntent();
    const spec = SPECS.heli;
    const max = spec.max * (this.has("engine") ? 1.2 : 1);
    const moving = Math.hypot(m.x, m.y) > 0.1;
    v.vx += (m.x * max - v.vx) * Math.min(1, dt * 2.2);
    v.vy += (m.y * max - v.vy) * Math.min(1, dt * 2.2);
    if (moving) v.a += wrap(Math.atan2(m.y, m.x) - v.a) * Math.min(1, dt * 4);
    const targetZ = moving || this.input.boost ? 130 : this.input.brake ? 0 : v.z > 60 ? 130 : 0;
    v.z += (targetZ - v.z) * Math.min(1, dt * 1.5);
    if (v.z < 30) {
      const hit = this.move(v, v.vx * dt, v.vy * dt, spec.r, true);
      if (hit.hitX) v.vx = 0;
      if (hit.hitY) v.vy = 0;
    } else {
      v.x = clamp(v.x + v.vx * dt, 40, W - 40);
      v.y = clamp(v.y + v.vy * dt, 40, H - 40);
    }
    v.spin += dt * 30;
  }

  private land(v: Vehicle) {
    v.z = 0;
    v.vz = 0;
    const off = Math.abs(wrap(v.spin));
    const turns = Math.round(Math.abs(v.spin) / TAU);
    if (off < 0.65) {
      const score = Math.round((v.air * 320 + turns * 360) * (v.kind === "bike" ? 1.25 : 1));
      if (score > 120) {
        const cash = Math.round(score / 12);
        this.save.stats.jumps++;
        const label = turns > 0 ? `${turns * 360}° SPIN · ${score}` : `BIG AIR · ${score}`;
        this.stunt = { score, t: 2, label };
        if (score > this.save.bestStunt) this.save.bestStunt = score;
        this.reward(cash, Math.round(score / 30));
        sfx.flip();
        if (turns > 0) this.confetti(v.x, v.y);
        this.onStunt(score);
      }
    } else {
      // Landed sideways: spin out
      const fx = Math.cos(v.a);
      const fy = Math.sin(v.a);
      v.vx = fx * 60;
      v.vy = fy * 60;
      this.shake = 0.8;
      sfx.crash();
      this.puff(v.x, v.y, "#c9b28a", 16);
      this.stunt = { score: 0, t: 1.4, label: "WIPEOUT" };
    }
    v.a += v.spin;
    v.spin = 0;
    v.air = 0;
  }

  private checkRamps(v: Vehicle) {
    if (v.z > 0) return;
    const speed = Math.hypot(v.vx, v.vy);
    const ramps = [...this.map.ramps, ...this.save.props.filter((q) => q.kind === "ramp").map((q) => ({ x: q.x, y: q.y, heading: q.heading ?? 0 }))];
    for (const r of ramps) {
      if (Math.abs(r.x - v.x) > 60 || Math.abs(r.y - v.y) > 50) continue;
      const ra = (r.heading * TAU) / 16;
      const dot = (v.vx * Math.cos(ra) + v.vy * Math.sin(ra)) / (speed || 1);
      if (dot > 0.6 && speed > 200) {
        v.vz = 240 + speed * 0.55 * (v.kind === "bike" ? 1.2 : 1);
        v.z = 1;
        v.air = 0;
        sfx.jump();
        return;
      }
    }
    const boosts = [...this.map.boosts, ...this.save.props.filter((q) => q.kind === "boost").map((q) => ({ x: q.x, y: q.y, heading: q.heading ?? 0 }))];
    for (const b of boosts) {
      if (Math.abs(b.x - v.x) < 50 && Math.abs(b.y - v.y) < 40 && this.boostT <= 0.2 && v === this.player.vehicle) {
        this.boostT = 1.2;
        const ba = (b.heading * TAU) / 16;
        v.vx = Math.cos(ba) * SPECS[v.kind].max * 1.5;
        v.vy = Math.sin(ba) * SPECS[v.kind].max * 1.5;
        v.a = ba;
        sfx.flip();
      }
    }
  }

  private bumpOthers(v: Vehicle, dt: number) {
    const r = SPECS[v.kind].r;
    for (const o of this.vehicles) {
      if (o === v || o.z > 10 || v.z > 10) continue;
      const d = dist(v, o);
      const min = r + SPECS[o.kind].r;
      if (d < min && d > 0.01) {
        const nx = (o.x - v.x) / d;
        const ny = (o.y - v.y) / d;
        const push = (min - d) / 2;
        if (!this.blocked(o.x + nx * push, o.y + ny * push, SPECS[o.kind].r)) {
          o.x += nx * push;
          o.y += ny * push;
        }
        v.x -= nx * push;
        v.y -= ny * push;
        const rel = (v.vx - o.vx) * nx + (v.vy - o.vy) * ny;
        if (rel > 0) {
          v.vx -= nx * rel * 0.6;
          v.vy -= ny * rel * 0.6;
          o.vx += nx * rel * 0.5;
          o.vy += ny * rel * 0.5;
          if (rel > 150) {
            sfx.crash();
            this.sparks((v.x + o.x) / 2, (v.y + o.y) / 2);
            this.shake = Math.min(1, rel / 500);
            if (o.role === "traffic") o.wait = 1.5;
            this.damageVehicle(v, rel / 40);
            if (o.role === "convoy") this.damageVehicle(o, rel / 50);
          }
        }
      }
    }
    for (const q of this.peds) {
      if (q.follow !== undefined) continue;
      const d = dist(v, q);
      if (d < r + 34 && q.dodge <= 0 && Math.hypot(v.vx, v.vy) > 60) {
        const s = Math.sign(-Math.sin(v.a) * (q.x - v.x) + Math.cos(v.a) * (q.y - v.y)) || 1;
        q.dodge = 0.5;
        q.dvx = -Math.sin(v.a) * 260 * s;
        q.dvy = Math.cos(v.a) * 260 * s;
        q.quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
        q.quipT = 1.5;
      }
    }
    void dt;
  }

  private damageVehicle(v: Vehicle, n: number) {
    const k = v === this.player.vehicle && this.has("armor") ? 0.6 : 1;
    v.hp -= n * k;
    if (v.hp <= 0 && v === this.player.vehicle) {
      this.puff(v.x, v.y, "#2a2a30", 30);
      sfx.crash();
      this.toast(`Your ${SPECS[v.kind].label} is wrecked! Press H to call a fresh one home`, "#ff5a4e");
      this.exit();
      v.hp = 1;
      v.role = "parked";
    }
  }

  /** Coasting to a stop: parked cars you've left, cars that got bumped. */
  private coast(v: Vehicle, dt: number) {
    if (v.kind === "heli") {
      v.z = Math.max(0, v.z - dt * 80);
      v.vx *= 1 - 2 * dt;
      v.vy *= 1 - 2 * dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      return;
    }
    if (Math.abs(v.vx) + Math.abs(v.vy) < 2) return;
    v.vx *= 1 - 2.5 * dt;
    v.vy *= 1 - 2.5 * dt;
    if (v.z > 0) {
      v.z = Math.max(0, v.z + v.vz * dt);
      v.vz -= 1100 * dt;
    }
    this.move(v, v.vx * dt, v.vy * dt, SPECS[v.kind].r);
  }

  /* ---------- Traffic ---------- */

  private manageTraffic() {
    const f = this.focus();
    const traffic = this.vehicles.filter((v) => v.role === "traffic");
    for (const v of traffic) if (dist(v, f) > 1900) this.vehicles = this.vehicles.filter((q) => q !== v);
    if (traffic.length < 22 && Math.random() < 0.3) this.spawnTraffic(f);
    // Parked cars that drifted far away (not yours) get tidied up too
    this.vehicles = this.vehicles.filter((v) => v.role !== "parked" || v.owned || dist(v, f) < 3200 || v.homeX === undefined);
  }

  private spawnTraffic(f: { x: number; y: number }) {
    const vertical = Math.random() < 0.5;
    const roads = vertical ? [4, 20, 36, 52, 68] : [4, 16, 28, 40, 52];
    const road = roads[Math.floor(Math.random() * roads.length)];
    const sign = Math.random() < 0.5 ? 1 : -1;
    const along = (vertical ? f.y : f.x) + sign * rand(800, 1300);
    let x: number;
    let y: number;
    let dir: number;
    if (vertical) {
      dir = Math.random() < 0.5 ? 1 : 3;
      x = this.map.laneX(road, dir === 1 ? 1 : -1);
      y = clamp(along, 5 * T, 53 * T);
    } else {
      dir = Math.random() < 0.5 ? 0 : 2;
      y = this.map.laneY(road, dir === 0 ? 1 : -1);
      x = clamp(along, 5 * T, 69 * T);
    }
    if (Math.abs(x - f.x) < 700 && Math.abs(y - f.y) < 500) return;
    if (this.vehicles.some((v) => dist(v, { x, y }) < 120)) return;
    const kinds: [VKind, Paint | undefined][] = [["car", "red"], ["car", "white"], ["car", "green"], ["car", "black"], ["car", "purple"], ["taxi", undefined], ["car", "pink"], ["truck", undefined]];
    const [kind, paint] = kinds[Math.floor(Math.random() * kinds.length)];
    const v = this.makeVehicle(kind, x, y, (dir * TAU) / 4, "traffic", paint);
    v.dir = dir;
    this.vehicles.push(v);
  }

  private traffic(v: Vehicle, dt: number) {
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirs[v.dir];
    const target = (v.dir * TAU) / 4;
    v.a += wrap(target - v.a) * Math.min(1, dt * 8);
    // Slow for anything ahead in the lane
    let ahead = 999;
    const things = [...this.vehicles.filter((o) => o !== v && o.z < 10), ...this.peds, this.player.vehicle ? null : this.player].filter(Boolean) as { x: number; y: number }[];
    for (const o of things) {
      const rx = o.x - v.x;
      const ry = o.y - v.y;
      const along = rx * dx + ry * dy;
      const side = Math.abs(-rx * dy + ry * dx);
      if (along > 0 && along < ahead && side < 30) ahead = along;
    }
    const cruise = v.kind === "truck" ? 150 : 200;
    let want = ahead < 70 ? 0 : ahead < 160 ? cruise * ((ahead - 70) / 90) : cruise;
    if (v.wait > 0) {
      v.wait -= dt;
      want = 0;
      if (Math.random() < dt * 0.8 && dist(v, this.focus()) < 500) sfx.honk();
    }
    const speed = Math.hypot(v.vx, v.vy);
    const s = speed + clamp(want - speed, -500 * dt, 260 * dt);
    v.vx = dx * s;
    v.vy = dy * s;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    // Intersections: pick a way to go, then turn when you reach its lane
    const c = Math.floor(v.x / T);
    const r = Math.floor(v.y / T);
    const inX = [4, 20, 36, 52, 68].some((q) => c === q || c === q + 1);
    const inY = [4, 16, 28, 40, 52].some((q) => r === q || r === q + 1);
    if (inX && inY && !v.turn) {
      const vc = [4, 20, 36, 52, 68].find((q) => c === q || c === q + 1)!;
      const hr = [4, 16, 28, 40, 52].find((q) => r === q || r === q + 1)!;
      const options = [0, 1, 2, 3].filter((d) => d !== (v.dir + 2) % 4 && this.roadContinues(vc, hr, d));
      const nd = options[Math.floor(Math.random() * options.length)] ?? (v.dir + 2) % 4;
      const at = nd === v.dir ? -1 : nd === 0 || nd === 2 ? this.map.laneY(hr, nd === 0 ? 1 : -1) : this.map.laneX(vc, nd === 1 ? 1 : -1);
      v.turn = { dir: nd, at };
    }
    if (v.turn) {
      const t = v.turn;
      if (t.at < 0) {
        if (!(inX && inY)) v.turn = null;
      } else {
        const reached = v.dir === 0 ? v.x >= t.at : v.dir === 2 ? v.x <= t.at : v.dir === 1 ? v.y >= t.at : v.y <= t.at;
        if (reached) {
          if (v.dir === 0 || v.dir === 2) v.x = t.at;
          else v.y = t.at;
          v.dir = t.dir;
          v.turn = { dir: t.dir, at: -1 };
        }
      }
    }
    if (v.x < 3 * T || v.x > 71 * T || v.y < 3 * T || v.y > 55 * T) v.dir = (v.dir + 2) % 4;
  }

  private roadContinues(vc: number, hr: number, d: number) {
    void hr;
    if (d === 0) return vc < 68;
    if (d === 2) return vc > 4;
    if (d === 1) return hr < 52;
    return hr > 4;
  }

  /* ---------- People ---------- */

  private randomLook(): Hero {
    const pick = <X,>(a: readonly X[]) => a[Math.floor(Math.random() * a.length)];
    return {
      name: "",
      hair: pick(["short", "long", "ponytail", "bun", "curly", "spiky", "braids", "none"] as const),
      hairColor: pick(["#141010", "#3b2416", "#5a3a1a", "#b5562a", "#e0b860", "#c9c9c9"]),
      headwear: pick(["none", "none", "none", "cap", "headband"] as const),
      skin: pick(["#f6d6bd", "#f1c9a5", "#e0b48a", "#c68b5e", "#9a6440", "#7a4b2c", "#4f2f1c"]),
      top: pick(CITIZEN_TOPS),
      bottom: pick(["pants", "pants", "shorts", "skirt"] as const),
      bottomColor: pick(["#30343c", "#2f3a68", "#4a4a2a", "#5b3d8f", "#8e8b84"]),
    };
  }

  private spawnPedAt(x: number, y: number): Ped | null {
    if (this.blocked(x, y, 8)) return null;
    const q: Ped = { id: this.nextId++, x, y, dir: Math.floor(Math.random() * 4), speed: rand(35, 65), look: this.randomLook(), phase: Math.random() * 10, dodge: 0, dvx: 0, dvy: 0, quip: "", quipT: 0 };
    this.peds.push(q);
    return q;
  }

  private spawnPed(anywhere = false) {
    const f = this.focus();
    const at = anywhere ? this.map.sidewalkNear(f.x, f.y, Math.random, 100, 1400) : this.map.sidewalkNear(f.x, f.y, Math.random, 900, 1300);
    if (at) this.spawnPedAt(at.x + rand(-20, 20), at.y + rand(-20, 20));
  }

  private updatePeds(dt: number) {
    const f = this.focus();
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    this.peds = this.peds.filter((q) => q.follow !== undefined || q === this.job?.passenger || dist(q, f) < 1800);
    if (this.peds.length < 45 && Math.random() < 0.4) this.spawnPed();
    for (const q of this.peds) {
      q.quipT -= dt;
      if (q.follow !== undefined) continue;
      if (q === this.job?.passenger) continue;
      if (q.dodge > 0) {
        q.dodge -= dt;
        this.move(q, q.dvx * dt, q.dvy * dt, 7);
        q.dvx *= 1 - 4 * dt;
        q.dvy *= 1 - 4 * dt;
        continue;
      }
      if (q.hail) continue;
      const [dx, dy] = dirs[q.dir];
      const nx = q.x + dx * q.speed * dt;
      const ny = q.y + dy * q.speed * dt;
      const tile = this.map.tileAt(nx + dx * 20, ny + dy * 20);
      if ((tile !== Tile.Sidewalk && tile !== Tile.Park && tile !== Tile.Sand) || this.blocked(nx, ny, 8) || Math.random() < dt * 0.15) {
        q.dir = Math.floor(Math.random() * 4);
      } else {
        q.x = nx;
        q.y = ny;
      }
      q.phase += q.speed * dt * 0.06;
    }
  }

  /* ---------- Prompts (E) ---------- */

  private findPrompt(): City["prompt"] {
    const p = this.player;
    if (p.downT > 0 || this.builder) return null;
    const v = p.vehicle;
    const here = v ?? p;
    const m = this.mission;
    // Mission things
    if (m && !v) {
      for (let i = 0; i < m.markers.length; i++) {
        const k = m.markers[i];
        if (k.done || dist(k, p) > 60) continue;
        if (k.kind === "terminal") return { text: `E — Hack ${k.label}`, act: () => this.hack(i) };
        if (k.kind === "hostage") return { text: "E — Free the engineer", act: () => this.freeHostage(i) };
      }
    }
    // Taxi fares
    if (this.job?.kind === "taxi" && !this.job.passenger && v && v.kind !== "bike") {
      const fare = this.peds.find((q) => q.hail && dist(q, v) < 90);
      if (fare && Math.hypot(v.vx, v.vy) < 80) return { text: "E — Pick up the fare", act: () => this.pickUp(fare) };
    }
    // Race starts
    for (const r of RACES) {
      const s = this.map.places[`race_${r.id}`];
      if (s && dist(s, here) < 110 && !this.race && !this.mission) {
        const lvl = this.rank().level;
        if (lvl < r.level) return { text: `${r.title}: reach level ${r.level} to race`, act: () => {} };
        if (!v || (r.vehicle === "bike" && v.kind !== "bike")) return { text: `${r.title}: ${r.vehicle === "bike" ? "bring a bike" : "bring a car or bike"} to race`, act: () => {} };
        return { text: `E — Start ${r.title}`, act: () => this.startRace(r) };
      }
    }
    if (v) return { text: `E — Get out of the ${SPECS[v.kind].label}`, act: () => this.exit() };
    // People with something to say
    for (const id of CONTACT_ORDER) {
      const c = this.contactPos(id);
      if (dist(c, p) < 55) return { text: `E — Talk to ${CONTACTS[id].name}`, act: () => this.emit({ type: "talk", id }) };
    }
    // Shops and jobs
    const pl = this.map.places;
    if (dist(pl.pizza, p) < 60 && !this.job) return { text: "E — Start a pizza run", act: () => this.startJob("pizza") };
    if (dist(pl.mods, p) < 60) return { text: "E — Rio's Mods shop", act: () => this.emit({ type: "shop", shop: "mods" }) };
    if (dist(pl.style, p) < 60) return { text: "E — Style shop", act: () => this.emit({ type: "shop", shop: "style" }) };
    if (dist({ x: pl.hq.x + 110, y: pl.hq.y }, p) < 60) return { text: "E — Armory", act: () => this.emit({ type: "shop", shop: "armory" }) };
    if (dist(pl.school, p) < 60) return { text: "E — Brain challenge", act: () => this.emit({ type: "trivia", hard: true }) };
    // Plots
    for (let i = 0; i < this.map.plots.length; i++) {
      const q = this.map.plots[i];
      if (Math.abs(q.x - p.x) < 110 && p.y > q.y - 240 && p.y < q.y + 40) {
        const k = this.save.plots[i];
        return { text: k ? `E — ${PLOTS[k].label}` : `E — Build on plot ${i + 1}`, act: () => this.emit({ type: "plot", index: i }) };
      }
    }
    // Vehicles
    let best: Vehicle | null = null;
    let bd = 60;
    for (const o of this.vehicles) {
      const d = dist(o, p);
      if (d < bd && o.role !== "racer" && o.role !== "convoy" && o.z < 10) {
        bd = d;
        best = o;
      }
    }
    if (best) {
      const o = best;
      return { text: o.role === "traffic" ? `E — Borrow this ${SPECS[o.kind].label}` : `E — Drive the ${SPECS[o.kind].label}`, act: () => this.enter(o) };
    }
    return null;
  }

  contactPos(id: ContactId) {
    const pl = this.map.places;
    const at: Record<ContactId, Place> = { okafor: pl.hq, maya: pl.cafe, rio: pl.mods, dre: pl.stunt, lin: pl.school, bea: pl.home };
    const offs: Record<ContactId, [number, number]> = { okafor: [-60, 10], maya: [70, 6], rio: [-70, 6], dre: [0, 10], lin: [80, 6], bea: [260, 10] };
    return { x: at[id].x + offs[id][0], y: at[id].y + offs[id][1] };
  }

  goHome() {
    const p = this.player;
    if (this.mission) {
      this.toast("Finish or quit the mission first (phone → Missions)", "#ff5a4e");
      return;
    }
    if (p.vehicle) {
      p.vehicle.z = 0;
      this.exit();
    }
    const h = this.map.places.home;
    Object.assign(p, { x: h.x, y: h.y, vx: 0, vy: 0 });
    for (const v of this.vehicles) if (v.owned && v.homeX !== undefined) Object.assign(v, { x: v.homeX, y: v.homeY!, vx: 0, vy: 0, z: 0, a: 0, hp: SPECS[v.kind].hp, role: "parked" });
    this.cam.x = h.x;
    this.cam.y = h.y;
    this.race = null;
    this.toast("Home. Your vehicles are back outside, repaired.", "#8e8b84");
  }

  private respawn() {
    const p = this.player;
    const h = this.built("house") ? this.map.places.home : this.map.places.hospital;
    const bill = Math.min(this.save.money, 50);
    this.save.money -= bill;
    Object.assign(p, { x: h.x, y: h.y + 10, vx: 0, vy: 0, hp: 100, vehicle: null });
    this.toast(bill ? `Patched up. Hospital bill: $${bill}` : "Patched up and ready", "#8bd99b");
  }

  hurt(n: number) {
    const p = this.player;
    if (p.downT > 0) return;
    p.calmT = 0;
    let k = n;
    if (p.vehicle && this.has("armor")) k *= 0.6;
    if (p.shield > 0) {
      const s = Math.min(p.shield, k);
      p.shield -= s;
      k -= s;
    }
    p.hp -= k;
    p.hurtT = 0.3;
    sfx.hurt();
    this.shake = Math.max(this.shake, 0.4);
    if (p.hp <= 0) {
      p.hp = 0;
      p.downT = 2;
      if (p.vehicle) {
        p.vehicle.z = 0;
        this.exit();
      }
      this.toast("KNOCKED OUT", "#ff5a4e", true);
      if (this.mission) this.endMission(false, "Knocked out", "You ran out of health. Upgrade your shield at the Armory and try again.");
    }
  }

  /* ---------- Shooting ---------- */

  private fire() {
    const p = this.player;
    const v = p.vehicle;
    const ox = v ? v.x : p.x;
    const oy = v ? v.y : p.y;
    let a: number;
    const aim = this.input.aim;
    if (aim && Math.hypot(aim.x - ox, aim.y - oy) > 20) a = Math.atan2(aim.y - oy, aim.x - ox);
    else {
      // No mouse (touch, or F key): aim where the nearest enemy is going to be
      const targets: { x: number; y: number; vx?: number; vy?: number }[] = [...this.drones, ...this.bots];
      let best = 700;
      a = v ? v.a : p.facing > 0 ? 0 : Math.PI;
      for (const t of targets) {
        const d = Math.hypot(t.x - ox, t.y - oy);
        if (d < best) {
          best = d;
          const lead = d / 900;
          a = Math.atan2(t.y + (t.vy ?? 0) * lead - oy, t.x + (t.vx ?? 0) * lead - ox);
        }
      }
    }
    if (!v) p.facing = Math.cos(a) >= 0 ? 1 : -1;
    const colors = ["#ff6b8a", "#3fa7ff", "#8bd99b", "#ffb224", "#9b6bff"];
    const spread = this.has("spread") ? [-0.14, 0, 0.14] : [0];
    for (const s of spread) {
      this.shots.push({ x: ox + Math.cos(a) * 20, y: oy + Math.sin(a) * 20, vx: Math.cos(a + s) * 900, vy: Math.sin(a + s) * 900, life: 0.75, enemy: false, dmg: 1, color: colors[Math.floor(this.time * 9) % colors.length] });
    }
    p.fireT = this.has("rapid") ? 0.11 : 0.22;
    sfx.shoot();
  }

  private updateShots(dt: number) {
    const p = this.player;
    const f = this.focus();
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.ground && this.map.cell(s.x, s.y) === 1) {
        s.life = 0;
        this.puff(s.x, s.y, s.color, 4);
        continue;
      }
      if (s.enemy) {
        const truck = this.mission?.truck;
        if (truck && dist(s, truck) < 34) {
          s.life = 0;
          truck.hp -= s.dmg;
          this.sparks(s.x, s.y);
          continue;
        }
        for (const h of this.mission?.hostages ?? []) {
          if (dist(s, h) < 16) {
            s.life = 0;
            h.quipT = 1;
            h.quip = "Ow!";
            (h as Ped & { hp?: number }).hp = ((h as Ped & { hp?: number }).hp ?? 60) - s.dmg;
          }
        }
        if (p.downT <= 0 && dist(s, f) < (p.vehicle ? SPECS[p.vehicle.kind].r + 6 : 16)) {
          s.life = 0;
          this.hurt(s.dmg);
        }
        continue;
      }
      for (const d of this.drones) {
        if (Math.hypot(d.x - s.x, d.y - s.y) < (d.boss ? 44 : 28)) {
          s.life = 0;
          d.hp -= s.dmg;
          this.puff(s.x, s.y, s.color, 5);
          if (d.hp <= 0) this.killDrone(d);
          break;
        }
      }
      for (const b of this.bots) {
        if (Math.hypot(b.x - s.x, b.y - s.y) < 18) {
          s.life = 0;
          b.hp -= s.dmg;
          b.alert = 6;
          if (b.hp <= 0) {
            b.stun = 8;
            b.hp = 4;
            this.puff(b.x, b.y, "#ffb224", 14);
            sfx.pop();
            this.toast("Guard bot stunned", "#8e8b84");
          }
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private killDrone(d: Drone) {
    this.drones = this.drones.filter((x) => x !== d);
    sfx.pop();
    this.puff(d.x, d.y, "#ffb224", d.boss ? 40 : 18);
    this.puff(d.x, d.y, "#2a2a30", 10);
    this.save.stats.drones++;
    this.save.money += d.boss ? 60 : 8;
    const m = this.mission;
    if (m) m.kills++;
    if (d.boss) {
      this.shake = 1;
      this.toast("Heavy drone down!", "#8bd99b", true);
    }
  }

  /* ---------- Enemies ---------- */

  spawnDrone(near: { x: number; y: number }, boss = false, target: Drone["target"] = "player") {
    const a = Math.random() * TAU;
    const d = rand(500, 750);
    const max = boss ? 45 : 3;
    this.drones.push({ x: clamp(near.x + Math.cos(a) * d, 50, W - 50), y: clamp(near.y + Math.sin(a) * d, 50, H - 50), vx: 0, vy: 0, z: boss ? 90 : 70, hp: max, max, boss, fireT: rand(1.5, 3), orbit: Math.random() * TAU, target });
  }

  private updateEnemies(dt: number) {
    const f = this.focus();
    const p = this.player;
    for (const d of this.drones) {
      const tgt = d.target === "truck" && this.mission?.truck ? this.mission.truck : f;
      d.orbit += dt * (d.boss ? 0.5 : 0.9);
      const want = { x: tgt.x + Math.cos(d.orbit) * (d.boss ? 260 : 210), y: tgt.y + Math.sin(d.orbit) * 160 };
      const sp = d.boss ? 120 : 200;
      const dx = want.x - d.x;
      const dy = want.y - d.y;
      const n = Math.hypot(dx, dy) || 1;
      const mx = (dx / n) * Math.min(sp * dt, n);
      const my = (dy / n) * Math.min(sp * dt, n);
      d.x += mx;
      d.y += my;
      d.vx = mx / dt;
      d.vy = my / dt;
      d.fireT -= dt;
      if (d.fireT <= 0 && Math.hypot(tgt.x - d.x, tgt.y - d.y) < 650) {
        d.fireT = d.boss ? 1.1 : rand(1.4, 2.4);
        const a = Math.atan2(tgt.y - d.y, tgt.x - d.x);
        const burst = d.boss ? [-0.25, 0, 0.25] : [0];
        for (const s of burst) this.shots.push({ x: d.x, y: d.y, vx: Math.cos(a + s) * 330, vy: Math.sin(a + s) * 330, life: 2.4, enemy: true, dmg: d.boss ? 10 : 7, color: "#ff5a4e" });
      }
    }
    for (const b of this.bots) {
      if (b.stun > 0) {
        b.stun -= dt;
        continue;
      }
      const sees = this.botSees(b);
      if (sees) b.alert = Math.max(b.alert, 4);
      if (b.alert > 0) {
        b.alert -= dt;
        const a = Math.atan2(f.y - b.y, f.x - b.x);
        b.a += wrap(a - b.a) * Math.min(1, dt * 6);
        if (dist(b, f) > 140) this.move(b, Math.cos(a) * 125 * dt, Math.sin(a) * 125 * dt, 10);
        b.fireT -= dt;
        if (sees && b.fireT <= 0) {
          b.fireT = 1.1;
          this.shots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 1.8, enemy: true, dmg: 8, color: "#ff5a4e", ground: true });
        }
      } else {
        const t = b.path[b.pi];
        const dx = t.x - b.x;
        const dy = t.y - b.y;
        const n = Math.hypot(dx, dy);
        if (n < 8) b.pi = (b.pi + 1) % b.path.length;
        else {
          b.a += wrap(Math.atan2(dy, dx) - b.a) * Math.min(1, dt * 4);
          this.move(b, (dx / n) * 60 * dt, (dy / n) * 60 * dt, 10);
        }
      }
    }
    void p;
  }

  /** A guard bot sees you: within range, inside its view cone, nothing in the way. */
  botSees(b: Bot) {
    const f = this.focus();
    if (this.player.downT > 0) return false;
    const d = dist(b, f);
    if (d > 230) return false;
    const off = Math.abs(wrap(Math.atan2(f.y - b.y, f.x - b.x) - b.a));
    return off < 0.62 && this.map.clear(b.x, b.y, f.x, f.y);
  }

  searchlightAngle(i: number) {
    const s = this.map.searchlights[i];
    void i;
    return s.base + Math.sin(this.time * 0.6 + s.phase) * 0.75;
  }

  inSearchlight() {
    const f = this.focus();
    return this.map.searchlights.some((s, i) => {
      const d = dist(s, f);
      return d < 300 && d > 20 && Math.abs(wrap(Math.atan2(f.y - s.y, f.x - s.x) - this.searchlightAngle(i))) < 0.3;
    });
  }

  /* ---------- Missions ---------- */

  missionOpen(def: MissionDef) {
    const i = MISSIONS.indexOf(def);
    const prev = MISSIONS[i - 1];
    return this.rank().level >= def.level && (!prev || !!this.save.missions[prev.id]) && (!def.needs || this.built(def.needs));
  }

  startMission(def: MissionDef) {
    if (this.race || this.job) {
      this.toast("Finish what you're doing first", "#ff5a4e");
      return;
    }
    const pl = this.map.places;
    const m: MissionRun = { def, t: 0, wave: 0, kills: 0, need: 0, markers: [], truck: null, hostages: [], wrong: 0, detect: 0, objective: "", started: true };
    this.drones = [];
    this.bots = [];
    this.shots = [];
    const px = (c: number) => c * T;
    const redBots = () => {
      const loops: [number, number][][] = [
        [[74, 35], [81, 35], [81, 38], [74, 38]],
        [[75, 44], [75, 49], [79, 49], [79, 44]],
        [[82, 41], [82, 46], [77, 46]],
        [[73.5, 51], [80, 51], [80, 48.5]],
      ];
      this.bots = loops.map((l) => ({ x: px(l[0][0]), y: px(l[0][1]), a: 0, path: l.map(([c, r]) => ({ x: px(c), y: px(r) })), pi: 1, alert: 0, fireT: 1, hp: 4, stun: 0 }));
    };
    switch (def.kind) {
      case "defense":
        m.need = 3;
        this.gps = pl.hq;
        m.started = false;
        break;
      case "convoy": {
        const t = this.makeVehicle("truck", pl.depot.x, pl.depot.y + 40, 0, "convoy");
        t.hp = 320;
        m.truck = t;
        this.vehicles.push(t);
        this.gps = pl.depot;
        m.started = false;
        break;
      }
      case "stealth":
        redBots();
        m.markers = [
          { x: px(77), y: px(36.5), kind: "photo", label: "radar dish", progress: 0 },
          { x: px(80.5), y: px(45), kind: "photo", label: "drone factory", progress: 0 },
          { x: px(74.5), y: px(48), kind: "photo", label: "command tent", progress: 0 },
        ];
        this.gps = pl.redgate;
        break;
      case "hack":
        redBots();
        m.markers = [
          { x: px(78), y: px(35.5), kind: "terminal", label: "terminal A" },
          { x: px(83), y: px(44), kind: "terminal", label: "terminal B" },
          { x: px(76), y: px(51.5), kind: "terminal", label: "terminal C" },
        ];
        this.gps = pl.redgate;
        break;
      case "extract":
        redBots();
        m.markers = [
          { x: px(81), y: px(36), kind: "hostage", label: "engineer" },
          { x: px(76.5), y: px(46.5), kind: "hostage", label: "engineer" },
          { x: px(82.5), y: px(50), kind: "hostage", label: "engineer" },
        ];
        this.gps = pl.redgate;
        break;
      case "sky":
        m.need = 12;
        for (let i = 0; i < 4; i++) this.spawnDrone(this.focus());
        break;
    }
    this.mission = m;
    this.missionObjective();
    this.toast(`MISSION · ${def.title.toUpperCase()}`, "#ffb224", true);
    sfx.page();
  }

  quitMission() {
    if (!this.mission) return;
    this.endMission(false, "Mission abandoned", "You can try again any time from your phone.", true);
  }

  private endMission(ok: boolean, title: string, text: string, quiet = false) {
    const m = this.mission;
    if (!m) return;
    this.mission = null;
    this.drones = [];
    this.bots = [];
    this.shots = [];
    this.gps = null;
    if (m.truck) this.vehicles = this.vehicles.filter((v) => v !== m.truck);
    this.peds = this.peds.filter((q) => q.follow === undefined);
    if (!ok) {
      if (!quiet) {
        sfx.fail();
        this.emit({ type: "result", ok, title, text });
      }
      return;
    }
    // Stars: time for most missions, truck health for convoy, wrong answers for hack
    const [a, b] = m.def.stars;
    const stars =
      m.def.kind === "convoy" ? ((m.truck?.hp ?? 0) / 320 >= a ? 3 : (m.truck?.hp ?? 0) / 320 >= b ? 2 : 1)
      : m.def.kind === "hack" ? (m.wrong <= a ? 3 : m.wrong <= b ? 2 : 1)
      : m.t <= a ? 3 : m.t <= b ? 2 : 1;
    const prev = this.save.missions[m.def.id];
    const first = !prev;
    this.save.missions[m.def.id] = { stars: Math.max(stars, prev?.stars ?? 0), best: Math.min(m.t, prev?.best ?? Infinity) };
    const money = Math.round((first ? m.def.reward : m.def.reward * 0.4) * (0.7 + stars * 0.1));
    const xp = first ? m.def.xp : Math.round(m.def.xp / 3);
    this.reward(money, xp);
    sfx.success();
    this.confetti(this.player.x, this.player.y);
    this.emit({ type: "result", ok, title, text: `${text} +$${money}, +${xp} XP.`, stars });
  }

  private missionObjective() {
    const m = this.mission;
    if (!m) return;
    const left = m.markers.filter((k) => !k.done).length;
    switch (m.def.kind) {
      case "defense":
        m.objective = !m.started ? "Go to the army base yard" : `Wave ${m.wave}/3 · drones left: ${this.drones.length}`;
        break;
      case "convoy":
        m.objective = !m.started ? "Meet the truck at the Depot" : `Protect the truck · ${Math.max(0, Math.round(((m.truck?.hp ?? 0) / 320) * 100))}%`;
        break;
      case "stealth":
        m.objective = left ? `Photograph targets on foot: ${3 - left}/3 · stay unseen` : "Get out of the Red Zone";
        break;
      case "hack":
        m.objective = `Hack terminals: ${3 - left}/3`;
        break;
      case "extract": {
        const following = m.hostages.length;
        m.objective = left ? `Free the engineers: ${3 - left}/3` : `Lead ${following} engineer${following === 1 ? "" : "s"} to the base HQ`;
        break;
      }
      case "sky":
        m.objective = this.player.vehicle?.kind === "heli" ? `Drones down: ${m.kills}/${m.need}` : "Get in your helicopter";
        break;
    }
  }

  private updateMission(dt: number) {
    const m = this.mission;
    if (!m) return;
    const f = this.focus();
    const p = this.player;
    const pl = this.map.places;
    if (m.started) m.t += dt;
    const yard = { x: 78 * T, y: 20 * T };
    switch (m.def.kind) {
      case "defense":
        if (!m.started && dist(f, yard) < 500) {
          m.started = true;
          this.gps = null;
        }
        if (m.started && this.drones.length === 0) {
          if (m.wave >= 3) return this.endMission(true, "Base secured", "Three waves, zero drones left.");
          m.wave++;
          const n = m.wave === 1 ? 5 : m.wave === 2 ? 7 : 4;
          for (let i = 0; i < n; i++) this.spawnDrone(yard);
          if (m.wave === 3) this.spawnDrone(yard, true);
          this.toast(m.wave === 3 ? "FINAL WAVE · HEAVY DRONE" : `WAVE ${m.wave}`, "#ff5a4e", true);
        }
        break;
      case "convoy": {
        const t = m.truck!;
        if (!m.started && dist(f, t) < 350) {
          m.started = true;
          this.gps = pl.hq;
          this.toast("The truck's rolling. Keep the drones off it!", "#ffb224");
        }
        if (m.started && this.drones.length < 4 && Math.random() < dt * 0.35) this.spawnDrone(t, false, "truck");
        if (t.hp <= 0) return this.endMission(false, "Convoy lost", "The drones took the truck down. Stay closer and shoot them early.");
        if (t.wp >= this.convoyRoute().length) return this.endMission(true, "Supplies delivered", "The truck made it to the base.");
        break;
      }
      case "stealth":
      case "hack":
      case "extract": {
        const inside = this.map.zoneAt(f.x, f.y) === 2;
        if (p.vehicle && inside) {
          p.vehicle.x -= p.vehicle.vx * dt * 3;
          p.vehicle.y -= p.vehicle.vy * dt * 3;
          p.vehicle.vx = p.vehicle.vy = 0;
          this.toast("Vehicles are too loud for the Red Zone. Go on foot.", "#ff5a4e");
        }
        if (inside && this.gps === pl.redgate) this.gps = null;
        if (m.def.kind === "stealth") {
          const seen = this.bots.some((b) => b.stun <= 0 && this.botSees(b)) || (inside && this.inSearchlight());
          m.detect = clamp(m.detect + (seen ? dt * 1.6 : -dt * 0.8), 0, 1);
          if (m.detect >= 1) return this.endMission(false, "Spotted!", "A guard saw you. Watch the sight cones and searchlights, and move when they turn away.");
          for (const k of m.markers) {
            if (k.done) continue;
            if (dist(k, p) < 44 && !p.vehicle) {
              k.progress = (k.progress ?? 0) + dt / 1.5;
              if (k.progress >= 1) {
                k.done = true;
                sfx.page();
                this.toast(`Photo taken: ${k.label}`, "#8bd99b");
              }
            } else k.progress = Math.max(0, (k.progress ?? 0) - dt);
          }
          if (m.markers.every((k) => k.done) && !inside) return this.endMission(true, "Recon complete", "Three clean photos, never seen.");
        } else if (m.def.kind === "hack") {
          if (m.markers.every((k) => k.done)) return this.endMission(true, "Files downloaded", "All three terminals cracked.");
        } else {
          for (const h of m.hostages) {
            const leader = m.hostages.indexOf(h) === 0 ? f : m.hostages[m.hostages.indexOf(h) - 1];
            const d = dist(h, leader);
            if (d > 40) this.move(h, ((leader.x - h.x) / d) * Math.min(230, d * 3) * dt, ((leader.y - h.y) / d) * Math.min(230, d * 3) * dt, 7);
            h.phase += dt * 6;
            if (((h as Ped & { hp?: number }).hp ?? 60) <= 0) return this.endMission(false, "Engineer down", "One of the engineers was hit. Keep them behind you and stun the guards.");
          }
          if (m.markers.every((k) => k.done) && dist(f, pl.hq) < 160) return this.endMission(true, "Everyone's out", "Three engineers safe at the base.");
        }
        break;
      }
      case "sky":
        if (p.vehicle?.kind === "heli" && p.vehicle.z > 40 && this.drones.length < 5 && m.kills + this.drones.length < m.need) this.spawnDrone(f);
        if (m.kills >= m.need) return this.endMission(true, "Skies clear", `${m.need} drones down over the city.`);
        break;
    }
    this.missionObjective();
  }

  private convoyRoute() {
    const pl = this.map.places;
    return [
      { x: pl.depot.x, y: 41 * T },
      { x: 69 * T, y: 41 * T },
      { x: 69 * T, y: 17 * T },
      { x: 76 * T, y: 17 * T },
      { x: 78 * T, y: 15 * T },
    ];
  }

  private convoy(v: Vehicle, dt: number) {
    const m = this.mission;
    if (!m?.started) return;
    const route = this.convoyRoute();
    const t = route[v.wp];
    if (!t) return;
    const d = dist(v, t);
    if (d < 40) {
      v.wp++;
      return;
    }
    const far = dist(v, this.focus()) > 600;
    const sp = far ? 0 : 115;
    const a = Math.atan2(t.y - v.y, t.x - v.x);
    v.a += wrap(a - v.a) * Math.min(1, dt * 3);
    v.vx = Math.cos(v.a) * sp;
    v.vy = Math.sin(v.a) * sp;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    if (far && Math.random() < dt * 0.5) this.toast("The truck is waiting for you", "#8e8b84");
  }

  private hack(i: number) {
    const pool = [...HARD_QUESTIONS, ...this.save.myQuestions];
    const question = pool[Math.floor(Math.random() * pool.length)];
    this.emit({ type: "terminal", index: i, question });
  }

  answerTerminal(i: number, right: boolean) {
    const m = this.mission;
    if (!m) return;
    if (right) {
      m.markers[i].done = true;
      sfx.right();
      this.toast(`${m.markers[i].label} cracked`, "#8bd99b");
    } else {
      m.wrong++;
      sfx.wrong();
      this.toast("WRONG CODE · ALARM!", "#ff5a4e", true);
      for (const b of this.bots) b.alert = 8;
    }
  }

  private freeHostage(i: number) {
    const m = this.mission;
    if (!m) return;
    const k = m.markers[i];
    k.done = true;
    const h = this.spawnPedAt(k.x, k.y + 10) ?? { id: this.nextId++, x: k.x, y: k.y, dir: 0, speed: 0, look: this.randomLook(), phase: 0, dodge: 0, dvx: 0, dvy: 0, quip: "", quipT: 0 };
    if (!this.peds.includes(h)) this.peds.push(h);
    h.look = { ...h.look, top: "#edeae3", headwear: "helmet" };
    h.follow = 1;
    h.quip = "Thank you!";
    h.quipT = 2;
    (h as Ped & { hp?: number }).hp = 60;
    m.hostages.push(h);
    sfx.right();
  }

  /* ---------- Races ---------- */

  raceOpen(def: RaceDef) {
    return this.rank().level >= def.level;
  }

  raceWaypoints(def: RaceDef) {
    return def.route.map(([c, r]) => ({ x: c * T, y: r * T }));
  }

  private startRace(def: RaceDef) {
    const v = this.player.vehicle;
    if (!v || this.mission || this.job) return;
    const wps = this.raceWaypoints(def);
    const start = wps[0];
    const next = wps[1];
    const a = Math.atan2(next.y - start.y, next.x - start.x);
    Object.assign(v, { x: start.x, y: start.y, a, vx: 0, vy: 0, z: 0 });
    const names = ["Jaz", "Kofi", "Ines", "Tao", "Rubi"];
    const racers: Vehicle[] = [];
    for (let i = 0; i < 3; i++) {
      const kind: VKind = def.vehicle === "bike" ? "bike" : i === 2 ? "jeep" : "car";
      const r = this.makeVehicle(kind, start.x - Math.cos(a) * (60 + i * 50) + Math.sin(a) * (i % 2 ? 26 : -26), start.y - Math.sin(a) * (60 + i * 50) - Math.cos(a) * (i % 2 ? 26 : -26), a, "racer", (["red", "green", "purple"] as const)[i]);
      r.wp = 1;
      r.name = names[(i + def.id.length) % names.length];
      racers.push(r);
      this.vehicles.push(r);
    }
    // Clear traffic off the course start
    this.vehicles = this.vehicles.filter((o) => o.role !== "traffic" || dist(o, start) > 400);
    this.race = { def, countdown: 3.2, t: 0, wp: 1, lap: 0, racers, placed: 0 };
    sfx.page();
  }

  private updateRace(dt: number) {
    const r = this.race;
    if (!r) return;
    const v = this.player.vehicle;
    const wps = this.raceWaypoints(r.def);
    if (r.countdown > 0) {
      const before = Math.ceil(r.countdown);
      r.countdown -= dt;
      if (v) {
        v.vx = v.vy = 0;
      }
      if (Math.ceil(r.countdown) !== before) {
        if (r.countdown > 0) sfx.right();
        else sfx.success();
      }
      return;
    }
    r.t += dt;
    if (!v) {
      this.endRace(false, "You left your vehicle");
      return;
    }
    const target = wps[r.wp];
    if (dist(v, target) < 120) {
      r.wp++;
      sfx.coin();
      if (r.wp >= wps.length) {
        const place = r.racers.filter((q) => q.finished > 0).length + 1;
        this.endRace(true, "", place);
        return;
      }
    }
    if (this.gps !== target) this.gps = { ...target, label: "Checkpoint" };
  }

  private racer(v: Vehicle, dt: number) {
    const r = this.race;
    if (!r) {
      this.vehicles = this.vehicles.filter((q) => q !== v);
      return;
    }
    if (r.countdown > 0 || v.finished) {
      if (v.finished) {
        v.vx *= 1 - 2 * dt;
        v.vy *= 1 - 2 * dt;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
      }
      return;
    }
    const wps = this.raceWaypoints(r.def);
    const t = wps[v.wp];
    if (!t) {
      v.finished = r.t;
      return;
    }
    if (dist(v, t) < 90) {
      v.wp++;
      if (v.wp >= wps.length) v.finished = r.t;
      return;
    }
    // Rubber band: a little faster when behind the player, a little slower when ahead
    const lead = v.wp - r.wp;
    const spec = SPECS[v.kind];
    const max = spec.max * (lead > 0 ? 0.86 : lead < 0 ? 1.04 : 0.95) * (r.def.id === "grand" ? 1 : 0.97);
    const a = Math.atan2(t.y - v.y, t.x - v.x);
    v.a += wrap(a - v.a) * Math.min(1, dt * 3.5);
    const corner = Math.abs(wrap(a - v.a)) > 0.5 ? 0.55 : 1;
    const speed = Math.hypot(v.vx, v.vy);
    const s = speed + clamp(max * corner - speed, -700 * dt, spec.accel * dt);
    v.vx = Math.cos(v.a) * s;
    v.vy = Math.sin(v.a) * s;
    v.x += v.vx * dt;
    v.y += v.vy * dt;
  }

  private endRace(ok: boolean, why: string, place = 0) {
    const r = this.race;
    if (!r) return;
    this.race = null;
    this.gps = null;
    for (const q of r.racers) q.role = "traffic";
    this.vehicles = this.vehicles.filter((q) => !r.racers.includes(q));
    if (!ok) {
      this.toast(`Race over: ${why}`, "#ff5a4e");
      return;
    }
    const prize = r.def.prize[place - 1] ?? 30;
    const rec = this.save.races[r.def.id] ?? { wins: 0 };
    const record = !rec.best || r.t < rec.best;
    if (record) rec.best = r.t;
    if (place === 1) rec.wins++;
    this.save.races[r.def.id] = rec;
    this.reward(prize, place === 1 ? 120 : 50);
    if (place === 1) {
      sfx.success();
      this.confetti(this.player.x, this.player.y);
    }
    this.emit({
      type: "result",
      ok: place === 1,
      title: place === 1 ? "1st place!" : `${["1st", "2nd", "3rd", "4th"][place - 1]} place`,
      text: `${r.def.title}: ${r.t.toFixed(2)} s${record ? " (personal best)" : ""}. +$${prize}.`,
      stars: place === 1 ? 3 : place === 2 ? 2 : 1,
    });
    this.onRace(r.def.id, place);
  }

  quitRace() {
    if (this.race) this.endRace(false, "you quit");
  }

  /* ---------- Jobs ---------- */

  startJob(kind: JobRun["kind"]) {
    if (this.mission || this.race) return;
    this.job = { kind, target: null, t: 0, count: 0, combo: 0, earned: 0, passenger: null, fare: 0 };
    if (kind === "pizza") {
      this.nextDelivery();
      this.toast("PIZZA RUN · 5 deliveries · be quick for tips", "#ffb224", true);
    } else this.toast("TAXI · look for people waving by the road", "#ffb224", true);
    sfx.page();
  }

  stopJob() {
    const j = this.job;
    if (!j) return;
    this.job = null;
    this.gps = null;
    if (j.passenger) {
      j.passenger.hail = false;
      this.peds = this.peds.filter((q) => q !== j.passenger);
    }
    for (const q of this.peds) q.hail = false;
    if (j.earned) this.toast(`Shift over: earned $${j.earned}`, "#8bd99b");
  }

  private nextDelivery() {
    const j = this.job!;
    const f = this.focus();
    const doors = this.map.doors.filter((d) => dist(d, f) > 600 && dist(d, f) < 2400);
    const door = doors[Math.floor(Math.random() * doors.length)] ?? this.map.doors[0];
    j.target = { ...door, label: "Pizza delivery" };
    j.t = dist(door, f) / 230 + 14;
    this.gps = j.target;
  }

  private pickUp(q: Ped) {
    const j = this.job!;
    q.hail = false;
    q.follow = 99;
    j.passenger = q;
    const f = this.focus();
    const spots = [...Object.values(this.map.places).filter((pl) => this.map.zoneAt(pl.x, pl.y) === 0), ...this.map.doors].filter((d) => dist(d, f) > 900 && dist(d, f) < 2800);
    const dest = spots[Math.floor(Math.random() * spots.length)] ?? this.map.places.home;
    j.target = { x: dest.x, y: dest.y, label: dest.label === "a house" ? "Drop-off" : dest.label };
    j.t = dist(dest, f) / 260 + 15;
    j.fare = Math.round(dist(dest, f) / 18);
    this.gps = j.target;
    sfx.right();
    this.toast(`Take them to ${j.target.label}`, "#ffb224");
  }

  private updateJob(dt: number) {
    const j = this.job;
    if (!j) return;
    const f = this.focus();
    if (j.kind === "pizza") {
      j.t -= dt;
      if (j.target && dist(j.target, f) < 70) {
        const tip = Math.round((25 + Math.max(0, j.t) * 2.5) * (1 + j.combo * 0.15));
        j.combo++;
        j.count++;
        j.earned += tip;
        this.save.deliveries++;
        this.reward(tip, 15, `Delivered! +$${tip}${j.combo > 1 ? ` · combo ×${j.combo}` : ""}`);
        sfx.coin();
        if (j.count >= 5) {
          this.toast(`Pizza run done: $${j.earned}`, "#8bd99b", true);
          this.job = null;
          this.gps = null;
          return;
        }
        this.nextDelivery();
      } else if (j.t <= 0) {
        this.toast("Too slow — the pizza's cold. Run over.", "#ff5a4e");
        this.job = null;
        this.gps = null;
      }
      return;
    }
    // Taxi
    const v = this.player.vehicle;
    if (!j.passenger) {
      const waving = this.peds.filter((q) => q.hail);
      if (waving.length < 2 && Math.random() < dt) {
        const at = this.map.sidewalkNear(f.x, f.y, Math.random, 300, 800);
        if (at) {
          const q = this.spawnPedAt(at.x, at.y);
          if (q) {
            q.hail = true;
            q.quip = "Taxi!";
            q.quipT = 99;
          }
        }
      }
      if (waving.length && !this.gps) this.gps = { ...waving[0], label: "Fare" };
    } else {
      j.t -= dt;
      const q = j.passenger;
      if (v) {
        q.x = v.x;
        q.y = v.y;
      }
      if (j.target && dist(j.target, f) < 90 && v && Math.hypot(v.vx, v.vy) < 120) {
        const pay = j.fare + Math.round(Math.max(0, j.t) * 3);
        j.earned += pay;
        this.save.stats.fares++;
        this.reward(pay, 20, `Fare paid: $${pay}`);
        this.peds = this.peds.filter((x) => x !== q);
        j.passenger = null;
        j.target = null;
        this.gps = null;
      } else if (j.t <= 0 && j.target) {
        this.toast("Your passenger got bored and left", "#ff5a4e");
        this.peds = this.peds.filter((x) => x !== q);
        j.passenger = null;
        j.target = null;
        this.gps = null;
      }
    }
  }

  /* ---------- Trivia ---------- */

  answerTrivia(right: boolean, hard: boolean) {
    if (right) this.reward(hard ? 45 : 25, hard ? 12 : 8);
  }

  finishTrivia(score: number) {
    this.save.triviaBest = Math.max(this.save.triviaBest, score);
    this.onTrivia(score);
  }

  /* ---------- People's story steps ---------- */

  quest(id: ContactId): QuestState {
    return (this.save.quests[id] ??= { step: 0, accepted: false });
  }

  currentStep(id: ContactId): StepDef | null {
    return CONTACTS[id].steps[this.quest(id).step] ?? null;
  }

  /** The contact shows a "!" when they have something new for you. */
  hasNews(id: ContactId) {
    const q = this.quest(id);
    const s = this.currentStep(id);
    if (!s) return false;
    if (!q.accepted) return true;
    return (s.kind === "fetch" && q.carrying) || (s.kind === "find" && q.found) || !!q.ready;
  }

  /** Talking to a contact: accept or hand in their current step. */
  talk(id: ContactId): { lines: string[]; done?: string; step: StepDef | null; riddle?: Question } {
    const q = this.quest(id);
    const s = this.currentStep(id);
    if (!s) return { lines: [`${CONTACTS[id].name}: Thanks for everything. This city's lucky to have you.`], step: null };
    const handIn = q.accepted && (s.kind === "talk" || (s.kind === "fetch" && q.carrying) || (s.kind === "find" && q.found) || q.ready);
    if (handIn) {
      this.completeStep(id);
      return { lines: [], done: s.done, step: s };
    }
    if (!q.accepted) {
      q.accepted = true;
      if (s.kind === "talk") {
        this.completeStep(id);
        return { lines: s.say, done: s.done, step: s };
      }
      this.armStep(id);
      if (s.kind === "riddle") return { lines: s.say, step: s, riddle: s.question };
      return { lines: s.say, step: s };
    }
    if (s.kind === "riddle") return { lines: ["Have another go:"], step: s, riddle: s.question };
    return { lines: [`Still waiting on this: ${s.text}.`], step: s };
  }

  answerRiddle(id: ContactId, right: boolean) {
    if (right) this.completeStep(id);
  }

  private armStep(id: ContactId) {
    const s = this.currentStep(id);
    if (!s) return;
    if ((s.kind === "fetch" || s.kind === "find") && s.at) {
      const pl = this.map.places[s.at];
      this.questItem = { contact: id, item: { x: pl.x + 40, y: pl.y + (s.at === "lake" ? 0 : 20), label: s.item ?? "item" }, label: s.item ?? "item" };
      this.gps = this.questItem.item;
    }
    // Steps already satisfied finish straight away
    if (s.kind === "mission" && s.mission && this.save.missions[s.mission]) this.quest(id).ready = true;
    if (s.kind === "race" && s.race && this.save.races[s.race]?.wins) this.quest(id).ready = true;
    if (s.kind === "stunt" && this.save.bestStunt >= (s.goal ?? 0)) this.quest(id).ready = true;
    if (s.kind === "trivia" && this.save.triviaBest >= (s.goal ?? 0)) this.quest(id).ready = true;
    this.emit({ type: "save" });
  }

  private completeStep(id: ContactId) {
    const q = this.quest(id);
    const s = this.currentStep(id);
    if (!s) return;
    if (this.questItem?.contact === id) this.questItem = null;
    q.step++;
    q.accepted = false;
    q.carrying = q.found = q.ready = false;
    this.reward(s.reward, s.xp, s.reward ? `${CONTACTS[id].name}: +$${s.reward}` : undefined);
    sfx.success();
    this.emit({ type: "save" });
  }

  private updateQuests() {
    const qi = this.questItem;
    if (qi) {
      const f = this.focus();
      if (dist(qi.item, f) < 60) {
        const q = this.quest(qi.contact);
        const s = this.currentStep(qi.contact);
        if (s?.kind === "fetch") q.carrying = true;
        else q.found = true;
        this.toast(`Got the ${qi.label}! Take it back to ${CONTACTS[qi.contact].name}`, "#8bd99b");
        sfx.page();
        this.gps = { ...this.contactPos(qi.contact), label: CONTACTS[qi.contact].name };
        this.questItem = null;
      }
    }
    for (const id of CONTACT_ORDER) {
      const q = this.save.quests[id];
      const s = this.currentStep(id);
      if (!q?.accepted || !s || q.ready) continue;
      if (s.kind === "mission" && s.mission && this.save.missions[s.mission]) this.ready(id);
      if (s.kind === "deliveries" && this.save.deliveries >= (s.goal ?? 0)) this.ready(id);
    }
  }

  private ready(id: ContactId) {
    this.quest(id).ready = true;
    this.toast(`${CONTACTS[id].name} wants to see you`, "#ffb224");
  }

  private onStunt(score: number) {
    const q = this.save.quests.dre;
    const s = this.currentStep("dre");
    if (q?.accepted && s?.kind === "stunt" && score >= (s.goal ?? 0)) this.ready("dre");
  }

  private onRace(id: string, place: number) {
    const s = this.currentStep("rio");
    if (this.save.quests.rio?.accepted && s?.kind === "race" && s.race === id && place === 1) this.ready("rio");
  }

  private onTrivia(score: number) {
    const s = this.currentStep("maya");
    if (this.save.quests.maya?.accepted && s?.kind === "trivia" && score >= (s.goal ?? 0)) this.ready("maya");
  }

  /** What to do next, for the HUD. */
  nextGoal(): string {
    if (this.mission) return this.mission.objective;
    if (this.race) return this.race.countdown > 0 ? "Get ready…" : `Checkpoint ${this.race.wp}/${this.race.def.route.length - 1}`;
    if (this.job) return this.job.kind === "pizza" ? `Deliver pizza ${this.job.count + 1}/5 · ${Math.ceil(this.job.t)}s` : this.job.passenger ? `Drive to ${this.job.target?.label} · ${Math.ceil(this.job.t)}s` : "Find someone waving for a taxi";
    for (const id of CONTACT_ORDER) {
      const s = this.currentStep(id);
      if (!s) continue;
      if (this.hasNews(id)) return `Talk to ${CONTACTS[id].name} (${CONTACTS[id].role})`;
    }
    if (!this.built("house")) return this.save.money >= PLOTS.house.cost ? "Build your home on your block" : `Earn $${PLOTS.house.cost} for a home: try a pizza run`;
    const m = MISSIONS.find((d) => !this.save.missions[d.id] && this.missionOpen(d));
    if (m) return `Mission ready: ${m.title} (phone → Missions)`;
    return "Explore: races, stunts, taxi fares, trivia, or build something";
  }

  /* ---------- Building and buying ---------- */

  build(i: number, kind: PlotKind) {
    if (this.save.plots[i]) return false;
    let cost = PLOTS[kind].cost;
    if (kind === "lab" && this.quest("lin").step >= 2) cost = Math.round(cost * 0.6);
    if (!this.spend(cost)) return false;
    this.save.plots[i] = kind;
    sfx.build();
    const p = this.map.plots[i];
    for (let k = 0; k < 30; k++) this.puff(p.x + rand(-110, 110), p.y - rand(0, 200), "#c9b28a", 1);
    this.syncOwned();
    this.toast(`${PLOTS[kind].label} built!`, "#8bd99b", true);
    this.confetti(p.x, p.y - 100);
    this.emit({ type: "save" });
    return true;
  }

  sell(i: number) {
    const k = this.save.plots[i];
    if (!k) return;
    this.save.plots[i] = null;
    this.save.money += Math.floor(PLOTS[k].cost / 2);
    this.vehicles = this.vehicles.filter((v) => !(v.owned && ((k === "garage" && v.kind === "car") || (k === "helipad" && v.kind === "heli")) && v !== this.player.vehicle));
    this.emit({ type: "save" });
  }

  buyUpgrade(u: UpgradeId) {
    if (this.has(u)) return false;
    let cost = UPGRADES[u].cost;
    if (u === "nitro" && this.quest("rio").step >= 2) cost = Math.round(cost * 0.6);
    if (!this.spend(cost)) return false;
    this.save.upgrades.push(u);
    if (u === "shield") this.player.shield = 50;
    this.toast(`${UPGRADES[u].label} installed`, "#8bd99b");
    this.emit({ type: "save" });
    return true;
  }

  upgradeCost(u: UpgradeId) {
    if (u === "nitro" && this.quest("rio").step >= 2) return Math.round(UPGRADES[u].cost * 0.6);
    return UPGRADES[u].cost;
  }

  setPaint(paint: Paint) {
    this.save.paint = paint;
    this.syncOwned();
    this.emit({ type: "save" });
  }

  /* ---------- Builder props ---------- */

  refreshProps() {
    this.dyn.fill(0);
    for (const q of this.save.props) {
      const solid = q.kind === "wall" || ART.props[q.kind]?.solid || this.save.packs.find((p) => `pack:${p.id}` === q.kind)?.solid;
      if (!solid) continue;
      const r = q.kind === "wall" ? 30 : 14;
      for (let cy = Math.floor((q.y - 14) / 16); cy <= Math.floor((q.y + 4) / 16); cy++)
        for (let cx = Math.floor((q.x - r) / 16); cx <= Math.floor((q.x + r) / 16); cx++) if (cx >= 0 && cy >= 0 && cx < this.map.cw && cy < this.map.ch) this.dyn[cy * this.map.cw + cx] = 1;
    }
    this.emit({ type: "save" });
  }

  addProp(kind: string, x: number, y: number) {
    if (this.save.props.length >= 400) {
      this.toast("That's the limit of 400 items", "#ff5a4e");
      return null;
    }
    if (this.map.zoneAt(x, y)) {
      this.toast("The army doesn't allow building inside its fences", "#ff5a4e");
      return null;
    }
    const q: BuilderProp = { id: this.save.nextPropId++, kind, x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8 };
    if (kind === "ramp" || kind === "boost") q.heading = 0;
    if (kind === "sign") q.text = "Write something here";
    if (kind === "person") {
      q.text = "Hi! Welcome to my corner of the city.";
      q.color = "#3fa7ff";
    }
    this.save.props.push(q);
    this.selected = q.id;
    sfx.build();
    this.refreshProps();
    return q;
  }

  propAt(x: number, y: number) {
    for (let i = this.save.props.length - 1; i >= 0; i--) {
      const q = this.save.props[i];
      if (Math.abs(q.x - x) < 34 && y > q.y - 60 && y < q.y + 20) return q;
    }
    return null;
  }

  private updateProps(dt: number) {
    const f = this.focus();
    for (const [id, w] of this.propCoin) {
      if (w - dt <= 0) this.propCoin.delete(id);
      else this.propCoin.set(id, w - dt);
    }
    let talking: number | null = null;
    let best = 110;
    for (const q of this.save.props) {
      if (Math.abs(q.x - f.x) > 200 || Math.abs(q.y - f.y) > 200) continue;
      if (q.kind === "coin" && !this.propCoin.has(q.id) && dist(q, f) < 40) {
        this.propCoin.set(q.id, 45);
        this.save.money += 5;
        sfx.coin();
      }
      if ((q.kind === "sign" || q.kind === "person") && dist(q, f) < best) {
        best = dist(q, f);
        talking = q.id;
      }
    }
    if (talking !== null && talking !== this.talking) sfx.page();
    this.talking = talking;
  }

  /* ---------- Effects ---------- */

  puff(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), z: rand(0, 10), vx: rand(-60, 60), vy: rand(-60, 60), vz: rand(20, 120), life: rand(0.3, 0.8), max: 0.8, color, size: rand(3, 7) });
  }

  sparks(x: number, y: number) {
    for (let i = 0; i < 12; i++) this.particles.push({ x, y, z: 10, vx: rand(-260, 260), vy: rand(-260, 260), vz: rand(50, 200), life: rand(0.2, 0.5), max: 0.5, color: "#ffd36b", size: 3 });
  }

  confetti(x: number, y: number) {
    const colors = ["#ffb224", "#ff6b8a", "#3fa7ff", "#8bd99b", "#9b6bff"];
    for (let i = 0; i < 60; i++) this.particles.push({ x, y, z: 40, vx: rand(-300, 300), vy: rand(-300, 300), vz: rand(150, 450), life: rand(0.8, 1.6), max: 1.6, color: colors[i % 5], size: rand(3, 6) });
  }

  speedKmh() {
    const v = this.player.vehicle;
    return v ? Math.round((Math.hypot(v.vx, v.vy) / PPM) * 3.6) : 0;
  }

  /** Is (x, y) inside the play area's land? */
  isLand(x: number, y: number) {
    return this.map.tileAt(x, y) !== Tile.Water && x > 0 && y > 0 && x < W && y < H;
  }

  static readonly MIL_X = MIL_X;
}
