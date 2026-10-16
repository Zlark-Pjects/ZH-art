/* The city map: a grid of roads with sidewalks, blocks of buildings, a park with a lake, a
   beach, the army base and the Red Zone. Positions are in "ground pixels" (24 px = 1 m); the
   camera looks down at 50°, so the screen shows y squashed by K. */

import manifest from "./art/manifest.json";

export const T = 64;
export const COLS = 84;
export const ROWS = 66;
export const W = COLS * T;
export const H = ROWS * T;
/** Screen y per ground y (sin 50°), and screen px per ground px of height (cos 50°). */
export const K = Math.sin((50 * Math.PI) / 180);
export const KZ = Math.cos((50 * Math.PI) / 180);

export const VROADS = [4, 20, 36, 52, 68];
export const HROADS = [4, 16, 28, 40, 52];
/** Roads that continue east to the military gates. */
export const GATE_ROWS = [16, 40];
export const MIL_X = 72;

export enum Tile {
  Grass,
  Road,
  Sidewalk,
  Sand,
  Water,
  Concrete,
  Dirt,
  Plot,
  Park,
}

export interface Meta {
  w: number;
  h: number;
  ax: number;
  ay: number;
  fp?: number[];
  night?: boolean;
  solid?: boolean;
}
export const ART = manifest as unknown as {
  buildings: Record<string, Meta>;
  props: Record<string, Meta>;
  spinners: Record<string, { frames: (Meta & { sx: number })[] }>;
};

export interface Building {
  sprite: string;
  x: number;
  /** Front edge (south), where it meets the sidewalk; it's the depth-sort key. */
  y: number;
  rect: [number, number, number, number];
}

export interface Decor {
  sprite: string;
  x: number;
  y: number;
}

export interface Place {
  x: number;
  y: number;
  label: string;
}

/* ---------- Seeded randomness so the city is the same every time ---------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const inRange = (v: number, list: number[]) => list.some((r) => v === r || v === r + 1);

export class CityMap {
  tiles = new Uint8Array(COLS * ROWS);
  buildings: Building[] = [];
  decor: Decor[] = [];
  /** 16-px collision cells: 1 = solid for anyone on the ground, 2 = water. */
  cells: Uint8Array;
  cw = W / 16;
  ch = H / 16;
  places: Record<string, Place> = {};
  /** Front doors of houses, for pizza deliveries. */
  doors: Place[] = [];
  plots: { x: number; y: number }[] = [];
  /** Base and Red Zone fences: [x0, y0, x1, y1] with a gate gap on the west side. */
  fences: { rect: [number, number, number, number]; gate: [number, number] }[] = [];
  ramps: { x: number; y: number; heading: number }[] = [];
  boosts: { x: number; y: number; heading: number }[] = [];
  searchlights: { x: number; y: number; phase: number; base: number }[] = [];

  constructor() {
    this.cells = new Uint8Array(this.cw * this.ch);
    this.layTiles();
    this.layBlocks();
    this.layMilitary();
    this.layBorders();
    this.rasterise();
  }

  tile(c: number, r: number) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return Tile.Water;
    return this.tiles[r * COLS + c] as Tile;
  }
  tileAt(x: number, y: number) {
    return this.tile(Math.floor(x / T), Math.floor(y / T));
  }
  private set(c: number, r: number, t: Tile) {
    if (c >= 0 && r >= 0 && c < COLS && r < ROWS) this.tiles[r * COLS + c] = t;
  }

  isRoad(c: number, r: number) {
    return this.tile(c, r) === Tile.Road;
  }

  private layTiles() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let t = Tile.Grass;
        if (r >= 60) t = Tile.Water;
        else if (r >= 55) t = Tile.Sand;
        if (c >= MIL_X) {
          if (r >= 5 && r <= 31) t = Tile.Concrete;
          else if (r >= 33 && r <= 52) t = Tile.Dirt;
        }
        const hRoad = inRange(r, HROADS) && c >= 4 && (c <= 69 || (GATE_ROWS.some((g) => r === g || r === g + 1) && c < MIL_X + 2));
        const vRoad = inRange(c, VROADS) && r >= 4 && r <= 53;
        if (hRoad || vRoad) t = Tile.Road;
        this.tiles[r * COLS + c] = t;
      }
    }
    // Sidewalks around every road inside the city
    for (let r = 2; r <= 55; r++) {
      for (let c = 2; c <= 71; c++) {
        if (this.tile(c, r) === Tile.Road) continue;
        let near = false;
        for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1 && !near; dc++) if (this.tile(c + dc, r + dr) === Tile.Road) near = true;
        if (near && this.tile(c, r) !== Tile.Concrete && this.tile(c, r) !== Tile.Dirt) this.set(c, r, Tile.Sidewalk);
      }
    }
  }

  /** Block interior in tiles: [c0, r0, c1, r1] inclusive. */
  block(bx: number, by: number): [number, number, number, number] {
    return [VROADS[bx] + 3, HROADS[by] + 3, VROADS[bx + 1] - 2, HROADS[by + 1] - 2];
  }

  private addBuilding(sprite: string, x: number, y: number) {
    const m = ART.buildings[sprite];
    if (!m) return;
    const fp = m.fp ?? [-m.w / 2, -40, m.w / 2, 0];
    this.buildings.push({ sprite, x, y, rect: [x + fp[0] + 4, y + fp[1] + 4, x + fp[2] - 4, y + fp[3] - 2] });
  }

  private addDecor(sprite: string, x: number, y: number) {
    if (ART.props[sprite]) this.decor.push({ sprite, x, y });
  }

  private layBlocks() {
    const rand = rng(7);
    const px = (c: number) => c * T;
    const houses = ["house_orange", "house_blue", "house_green", "house_cream"];
    const residential = (bx: number, by: number) => {
      const [c0, r0, c1, r1] = this.block(bx, by);
      const x0 = px(c0);
      const width = px(c1 + 1) - x0;
      for (const row of [0, 1]) {
        const y = row === 0 ? px(r0) + 230 : px(r1 + 1) - 6;
        const n = 5;
        for (let i = 0; i < n; i++) {
          const x = x0 + (width / n) * (i + 0.5);
          this.addBuilding(houses[Math.floor(rand() * houses.length)], x, y);
          this.doors.push({ x, y: y + 22, label: "a house" });
          if (rand() < 0.6) this.addDecor(rand() < 0.5 ? "bush" : "tree", x + 78, y - 10);
        }
      }
    };

    // Your block: six plots to build on
    {
      const [c0, r0] = this.block(0, 0);
      for (const row of [0, 1]) {
        for (let i = 0; i < 3; i++) this.plots.push({ x: px(c0) + 128 + i * 256, y: px(r0) + (row === 0 ? 250 : 506) });
      }
      for (const p of this.plots) for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) this.set(Math.floor((p.x - 128) / T) + c, Math.floor((p.y - 250) / T) + r, Tile.Plot);
      this.places.home = { x: this.plots[4].x, y: px(r0) + 560, label: "Your block" };
    }
    // Downtown
    {
      const [c0, r0, , r1] = this.block(1, 0);
      this.addBuilding("tower_brick", px(c0) + 200, px(r0) + 230);
      this.addBuilding("office", px(c0) + 560, px(r0) + 260);
      this.addBuilding("shop_pizza", px(c0) + 200, px(r1 + 1) - 6);
      this.addBuilding("shop_cafe", px(c0) + 560, px(r1 + 1) - 6);
      this.places.pizza = { x: px(c0) + 200, y: px(r1 + 1) + 24, label: "Pizza place" };
      this.places.cafe = { x: px(c0) + 560, y: px(r1 + 1) + 24, label: "Maya's café" };
    }
    {
      const [c0, r0, , r1] = this.block(2, 0);
      this.addBuilding("office", px(c0) + 220, px(r0) + 260);
      this.addBuilding("tower_teal", px(c0) + 570, px(r0) + 230);
      this.addBuilding("shop_style", px(c0) + 200, px(r1 + 1) - 6);
      this.addBuilding("shop_mods", px(c0) + 560, px(r1 + 1) - 6);
      this.places.style = { x: px(c0) + 200, y: px(r1 + 1) + 24, label: "Style shop" };
      this.places.mods = { x: px(c0) + 560, y: px(r1 + 1) + 24, label: "Rio's Mods" };
    }
    {
      const [c0, r0, , r1] = this.block(3, 0);
      this.addBuilding("tower_brick", px(c0) + 180, px(r0) + 230);
      this.addBuilding("hospital", px(c0) + 560, px(r1 + 1) - 6);
      this.addBuilding("house_cream", px(c0) + 180, px(r1 + 1) - 6);
      this.places.hospital = { x: px(c0) + 560, y: px(r1 + 1) + 24, label: "Hospital" };
    }
    residential(0, 1);
    residential(0, 2);
    residential(2, 1);
    residential(1, 2);
    residential(0, 3);
    // Park and lake
    {
      const [c0, r0, c1, r1] = this.block(1, 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, Tile.Park);
      const cx = (c0 + c1 + 1) / 2;
      const cy = (r0 + r1 + 1) / 2;
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) if (((c + 0.5 - cx) / 4.2) ** 2 + ((r + 0.5 - cy) / 2.6) ** 2 < 1) this.set(c, r, Tile.Water);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.addDecor(i % 3 ? "tree" : "pine", px(cx) + Math.cos(a) * 340, px(cy) + Math.sin(a) * 210 + 20);
      }
      this.addDecor("bench", px(cx) - 90, px(r1 + 1) - 20);
      this.addDecor("bench", px(cx) + 90, px(r1 + 1) - 20);
      this.places.lake = { x: px(cx) + 290, y: px(cy) + 40, label: "The lake" };
      this.places.park = { x: px(cx), y: px(r1 + 1) + 20, label: "City park" };
    }
    // School
    {
      const [c0, r0, c1, r1] = this.block(3, 1);
      this.addBuilding("school", px(c0) + 260, px(r1 + 1) - 6);
      for (let r = r0; r <= r0 + 3; r++) for (let c = c0 + 6; c <= c1; c++) this.set(c, r, Tile.Park);
      this.addDecor("tree", px(c0) + 600, px(r1 + 1) - 30);
      this.addDecor("statue", px(c0) + 520, px(r0) + 200);
      this.places.school = { x: px(c0) + 260, y: px(r1 + 1) + 24, label: "School" };
    }
    // Stunt park
    {
      const [c0, r0, c1, r1] = this.block(2, 2);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, Tile.Concrete);
      const y = px(r0) + 260;
      this.ramps.push({ x: px(c0) + 180, y, heading: 0 }, { x: px(c0) + 600, y, heading: 8 }, { x: px(c0) + 390, y: px(r0) + 90, heading: 4 }, { x: px(c0) + 390, y: px(r1) - 20, heading: 12 });
      this.boosts.push({ x: px(c0) + 60, y, heading: 0 }, { x: px(c1) - 20, y, heading: 8 });
      for (let i = 0; i < 6; i++) this.addDecor("cone", px(c0) + 120 + i * 100, px(r1 + 1) - 16);
      this.places.stunt = { x: px(c0) + 390, y: px(r1 + 1) + 24, label: "Stunt park" };
    }
    // Industrial: the Depot
    {
      const [c0, r0, c1, r1] = this.block(3, 2);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, Tile.Concrete);
      this.addBuilding("warehouse", px(c0) + 300, px(r1 + 1) - 70);
      for (let i = 0; i < 4; i++) this.addDecor(i % 2 ? "barrel" : "crate", px(c0) + 600 + (i % 2) * 60, px(r0) + 120 + i * 70);
      this.places.depot = { x: px(c0) + 300, y: px(r1 + 1) + 24, label: "The Depot" };
    }
    {
      const [c0, r0, , r1] = this.block(1, 3);
      this.addBuilding("tower_teal", px(c0) + 200, px(r0) + 230);
      this.addBuilding("shop_cafe", px(c0) + 560, px(r1 + 1) - 6);
      this.addDecor("fountain", px(c0) + 220, px(r1 + 1) - 60);
    }
    {
      const [c0, r0, , r1] = this.block(2, 3);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c0 + 11; c++) this.set(c, r, Tile.Concrete);
      this.addBuilding("warehouse", px(c0) + 300, px(r1 + 1) - 40);
      this.addDecor("crate", px(c0) + 620, px(r0) + 150);
      this.addDecor("crate", px(c0) + 680, px(r0) + 150);
    }
    {
      const [c0, r0, c1, r1] = this.block(3, 3);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, Tile.Park);
      for (let i = 0; i < 8; i++) this.addDecor("palm", px(c0) + 60 + rand() * 640, px(r0) + 60 + rand() * 420);
    }
    // Beach
    for (let i = 0; i < 26; i++) this.addDecor(i % 4 ? "palm" : "rock", 120 + rand() * (MIL_X * T - 240), 56 * T + 30 + rand() * 200);
    this.places.beach = { x: 44 * T, y: 58 * T, label: "The beach" };
    // Race starts sit on the road
    this.places.race_downtown = { x: 21.5 * T, y: 5 * T, label: "Downtown Dash start" };
    this.places.race_bike = { x: 5.5 * T, y: 29 * T, label: "Bike Sprint start" };
    this.places.race_grand = { x: 5 * T, y: 5.5 * T, label: "Grand Loop start" };
  }

  private layMilitary() {
    const px = (c: number) => c * T;
    // The base
    this.fences.push({ rect: [px(MIL_X), px(5), px(COLS) - 8, px(32)], gate: [px(16), px(18)] });
    this.fences.push({ rect: [px(MIL_X), px(33), px(COLS) - 8, px(53)], gate: [px(40), px(42)] });
    this.addBuilding("hq", px(78), px(13));
    this.addBuilding("barracks", px(78), px(25));
    this.addBuilding("watchtower", px(MIL_X) + 70, px(8));
    this.addBuilding("watchtower", px(MIL_X) + 70, px(30));
    this.addBuilding("helipad", px(80), px(30));
    this.addDecor("tent", px(75), px(20));
    this.addDecor("crate", px(82), px(18));
    this.addDecor("barrel", px(82) + 50, px(18));
    this.places.hq = { x: px(78), y: px(13) + 30, label: "Army base HQ" };
    this.places.basepad = { x: px(80), y: px(30) - 60, label: "Base helipad" };
    this.places.basegate = { x: px(MIL_X) - 40, y: px(17), label: "Base gate" };
    // The Red Zone: an enemy compound
    this.addBuilding("warehouse_red", px(79), px(40));
    this.addBuilding("watchtower", px(MIL_X) + 80, px(36));
    this.addBuilding("watchtower", px(82), px(51));
    for (const [c, r] of [[75, 45], [80, 47], [76, 50], [81, 43]]) this.addDecor("tent", px(c), px(r));
    for (const [c, r] of [[74, 37], [77, 43], [82, 38], [78, 51]]) this.addDecor("crate", px(c), px(r));
    // Searchlights sweep the inside of the compound: [x, y, base angle]
    this.searchlights.push({ x: px(MIL_X) + 80, y: px(36), phase: 0, base: 0.75 }, { x: px(82), y: px(51), phase: 2, base: -2.35 });
    this.places.redgate = { x: px(MIL_X) - 40, y: px(41), label: "Red Zone gate" };
  }

  private layBorders() {
    const rand = rng(11);
    for (let i = 0; i < 70; i++) {
      const edge = Math.floor(rand() * 3);
      const x = edge === 0 ? 20 + rand() * 180 : 20 + rand() * (MIL_X * T - 40);
      const y = edge === 1 ? 20 + rand() * 180 : edge === 0 ? 220 + rand() * (54 * T - 220) : 2 * T + rand() * 100;
      if (this.tileAt(x, y) === Tile.Grass) this.addDecor(rand() < 0.6 ? "pine" : "tree", x, y);
    }
  }

  /** Solid cells: buildings, fences, water and solid props. */
  private rasterise() {
    const mark = (x0: number, y0: number, x1: number, y1: number, v: number) => {
      for (let cy = Math.max(0, Math.floor(y0 / 16)); cy <= Math.min(this.ch - 1, Math.floor(y1 / 16)); cy++)
        for (let cx = Math.max(0, Math.floor(x0 / 16)); cx <= Math.min(this.cw - 1, Math.floor(x1 / 16)); cx++) this.cells[cy * this.cw + cx] = Math.max(this.cells[cy * this.cw + cx], v);
    };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.tile(c, r) === Tile.Water) mark(c * T + 4, r * T + 4, c * T + T - 5, r * T + T - 5, 2);
    for (const b of this.buildings) mark(b.rect[0], b.rect[1], b.rect[2], b.rect[3], 1);
    for (const f of this.fences) {
      const [x0, y0, x1, y1] = f.rect;
      mark(x0, y0, x1, y0 + 8, 1);
      mark(x0, y1 - 8, x1, y1, 1);
      mark(x1 - 8, y0, x1, y1, 1);
      mark(x0, y0, x0 + 8, f.gate[0], 1);
      mark(x0, f.gate[1], x0 + 8, y1, 1);
    }
    for (const d of this.decor) {
      const m = ART.props[d.sprite];
      if (m?.solid) mark(d.x - 14, d.y - 12, d.x + 14, d.y + 4, 1);
    }
  }

  /** 0 free, 1 solid, 2 water. */
  cell(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 1;
    return this.cells[Math.floor(y / 16) * this.cw + Math.floor(x / 16)];
  }

  blocked(x: number, y: number, r: number, swim = false) {
    for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const v = this.cell(x + dx, y + dy * 0.6);
      if (v === 1 || (v === 2 && !swim)) return true;
    }
    return false;
  }

  /** True when nothing solid lies between two points (for guards' line of sight). */
  clear(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
    for (let i = 1; i < n; i++) if (this.cell(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n) === 1) return false;
    return true;
  }

  /** The middle of the nearest road lane going a given way, for spawning traffic. */
  laneY(row: number, dir: 1 | -1) {
    return (row + (dir > 0 ? 1.5 : 0.5)) * T;
  }
  laneX(col: number, dir: 1 | -1) {
    return (col + (dir > 0 ? 0.5 : 1.5)) * T;
  }

  /** Inside a fenced zone? 0 none, 1 base, 2 Red Zone. */
  zoneAt(x: number, y: number) {
    for (let i = 0; i < this.fences.length; i++) {
      const [x0, y0, x1, y1] = this.fences[i].rect;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return i + 1;
    }
    return 0;
  }

  /** A random sidewalk tile centre near (x, y). */
  sidewalkNear(x: number, y: number, rand: () => number, min = 500, max = 1000) {
    for (let k = 0; k < 30; k++) {
      const a = rand() * Math.PI * 2;
      const d = min + rand() * (max - min);
      const sx = x + Math.cos(a) * d;
      const sy = y + Math.sin(a) * d;
      if (this.tileAt(sx, sy) === Tile.Sidewalk) return { x: Math.floor(sx / T) * T + T / 2, y: Math.floor(sy / T) * T + T / 2 };
    }
    return null;
  }
}
