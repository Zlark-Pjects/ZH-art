/* Draws the city: cached ground tiles, then everything that stands up sorted by depth, then
   the night, then the HUD. World positions are ground pixels; the screen squashes y by K. */

import { CONTACTS, CONTACT_ORDER, PLOTS, type Hero } from "./data";
import { SPECS, type City, type Vehicle } from "./engine";
import { COLS, H, HROADS, K, KZ, ROWS, T, Tile, VROADS, W, type CityMap } from "./map";
import { fileUrl, packImage, spinnerFrame, sprite } from "./art";
import { INK, drawHero, mix, type Pose } from "./stick";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** How many world pixels fit across the screen. */
export const viewWidth = (cssW: number, zoom: number) => (cssW < 700 ? 560 : 1100) / zoom;

/* ---------- Ground ---------- */

const CHUNK = 512;
const RES = 1.5;
const chunks = new Map<string, HTMLCanvasElement>();

const TILE_COLOR: Record<Tile, string> = {
  [Tile.Grass]: "#6aa84f",
  [Tile.Road]: "#3a3a42",
  [Tile.Sidewalk]: "#c4c0b6",
  [Tile.Sand]: "#e6c983",
  [Tile.Water]: "#3f8fd0",
  [Tile.Concrete]: "#a9a89f",
  [Tile.Dirt]: "#a4895f",
  [Tile.Plot]: "#8fbf6a",
  [Tile.Park]: "#79b85b",
};

function drawTile(c: Ctx, map: CityMap, col: number, row: number) {
  const t = map.tile(col, row);
  const x = col * T;
  const y = row * T * K;
  const h = T * K + 0.6;
  const v = hash(col * 131 + row * 7);
  c.fillStyle = t === Tile.Grass || t === Tile.Park ? mix(TILE_COLOR[t], v > 0.5 ? "#ffffff" : "#000000", Math.abs(v - 0.5) * 0.08) : TILE_COLOR[t];
  c.fillRect(x, y, T + 0.6, h);
  switch (t) {
    case Tile.Grass:
    case Tile.Park:
      c.fillStyle = "rgba(40,90,30,0.35)";
      for (let i = 0; i < 3; i++) c.fillRect(x + hash(col * 3 + i + row * 17) * T, y + hash(row * 5 + i + col) * h, 2, 3);
      break;
    case Tile.Sidewalk:
      c.strokeStyle = "rgba(0,0,0,0.08)";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, T / 2, h / 2);
      c.strokeRect(x + T / 2 + 0.5, y + h / 2 + 0.5, T / 2, h / 2);
      // Curb where the sidewalk meets the road
      c.fillStyle = "#8e8a80";
      if (map.isRoad(col, row + 1)) c.fillRect(x, y + h - 3, T, 3);
      if (map.isRoad(col, row - 1)) c.fillRect(x, y, T, 2);
      if (map.isRoad(col + 1, row)) c.fillRect(x + T - 3, y, 3, h);
      if (map.isRoad(col - 1, row)) c.fillRect(x, y, 3, h);
      break;
    case Tile.Road: {
      const hr = HROADS.find((r) => row === r || row === r + 1);
      const vr = VROADS.find((q) => col === q || col === q + 1);
      const inter = hr !== undefined && vr !== undefined;
      c.fillStyle = "rgba(255,255,255,0.03)";
      if (v > 0.7) c.fillRect(x + v * 40, y + v * 20, 10, 6);
      if (!inter && hr !== undefined && row === hr) {
        c.fillStyle = "#ffd36b";
        for (let k = 0; k < T; k += 32) c.fillRect(x + k + 4, y + h - 2, 16, 3);
      }
      if (!inter && vr !== undefined && col === vr) {
        c.fillStyle = "#ffd36b";
        for (let k = 0; k < h; k += 24) c.fillRect(x + T - 1.5, y + k + 3, 3, 12);
      }
      // Zebra crossings beside every junction
      c.fillStyle = "rgba(237,234,227,0.85)";
      if (hr !== undefined && vr === undefined && VROADS.some((q) => col === q - 1 || col === q + 2)) for (let k = 0; k < h; k += 8) c.fillRect(x + 10, y + k + 1, T - 20, 4);
      if (vr !== undefined && hr === undefined && HROADS.some((r) => row === r - 1 || row === r + 2)) for (let k = 6; k < T; k += 10) c.fillRect(x + k, y + 6, 5, h - 12);
      break;
    }
    case Tile.Sand:
      c.fillStyle = "rgba(160,120,60,0.25)";
      for (let i = 0; i < 4; i++) c.fillRect(x + hash(col + i * 9 + row) * T, y + hash(row + i * 3 + col * 2) * h, 2, 2);
      if (map.tile(col, row + 1) === Tile.Water) {
        c.fillStyle = "rgba(255,255,255,0.7)";
        c.fillRect(x, y + h - 4, T, 4);
      }
      break;
    case Tile.Water:
      c.strokeStyle = "rgba(255,255,255,0.25)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x + 8 + v * 20, y + h * 0.5);
      c.quadraticCurveTo(x + 18 + v * 20, y + h * 0.3, x + 28 + v * 20, y + h * 0.5);
      c.stroke();
      if (map.tile(col, row - 1) !== Tile.Water) {
        c.fillStyle = "rgba(255,255,255,0.5)";
        c.fillRect(x, y, T, 3);
      }
      break;
    case Tile.Concrete:
      c.strokeStyle = "rgba(0,0,0,0.1)";
      c.strokeRect(x + 0.5, y + 0.5, T, h);
      break;
    case Tile.Dirt:
      c.fillStyle = "rgba(90,60,30,0.3)";
      for (let i = 0; i < 5; i++) c.fillRect(x + hash(col * 7 + i + row) * T, y + hash(row * 3 + i + col) * h, 3, 2);
      break;
    case Tile.Plot:
      break;
  }
}

function chunk(map: CityMap, cx: number, cy: number) {
  const key = `${cx},${cy}`;
  let cv = chunks.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = CHUNK * RES;
  cv.height = Math.ceil(CHUNK * K * RES);
  const c = cv.getContext("2d")!;
  c.scale(RES, RES);
  c.translate(-cx * CHUNK, -cy * CHUNK * K);
  const c0 = Math.floor((cx * CHUNK) / T);
  const r0 = Math.floor((cy * CHUNK) / T);
  const n = CHUNK / T;
  for (let r = r0; r < r0 + n; r++) for (let col = c0; col < c0 + n; col++) if (r < ROWS && col < COLS) drawTile(c, map, col, r);
  // Plot outlines on your block
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.setLineDash([10, 8]);
  c.lineWidth = 2;
  for (const p of map.plots) c.strokeRect(p.x - 120, (p.y - 240) * K, 240, 236 * K);
  c.setLineDash([]);
  chunks.set(key, cv);
  return cv;
}

let minimap: HTMLCanvasElement | null = null;
/** A small picture of the whole city: 1 pixel per 16 ground pixels. */
export function minimapImage(map: CityMap) {
  if (minimap) return minimap;
  const cv = document.createElement("canvas");
  cv.width = W / 16;
  cv.height = H / 16;
  const c = cv.getContext("2d")!;
  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++) {
      const t = map.tile(col, r);
      c.fillStyle = t === Tile.Road ? "#55555f" : t === Tile.Sidewalk ? "#8e8b84" : TILE_COLOR[t];
      c.fillRect(col * 4, r * 4, 4, 4);
    }
  c.fillStyle = "#2a2a30";
  for (const b of map.buildings) c.fillRect(b.rect[0] / 16, b.rect[1] / 16, (b.rect[2] - b.rect[0]) / 16, (b.rect[3] - b.rect[1]) / 16);
  c.strokeStyle = "#ffb224";
  for (const f of map.fences) c.strokeRect(f.rect[0] / 16, f.rect[1] / 16, (f.rect[2] - f.rect[0]) / 16, (f.rect[3] - f.rect[1]) / 16);
  minimap = cv;
  return cv;
}

/* ---------- Pieces ---------- */

function shadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.25) {
  c.fillStyle = `rgba(0,0,0,${a})`;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}

function drawVehicle(c: Ctx, g: City, v: Vehicle) {
  const sx = v.x;
  const sy = v.y * K;
  const fr = spinnerFrame(v.sprite, v.a + v.spin);
  const lift = v.z * KZ;
  const spec = SPECS[v.kind];
  shadow(c, sx + (v.kind === "heli" ? v.z * 0.4 : 0), sy, spec.r * (v.kind === "truck" ? 2.1 : 1.6) * (1 - Math.min(0.5, v.z / 400)), spec.r * 0.75, v.kind === "heli" && v.z > 20 ? 0.18 : 0.28);
  if (fr) {
    const { img, f } = fr;
    c.drawImage(img, f.sx, 0, f.w * 2, f.h * 2, sx - f.ax, sy - f.ay - lift, f.w, f.h);
  } else {
    c.fillStyle = "#3fa7ff";
    c.fillRect(sx - 20, sy - 24 - lift, 40, 20);
  }
  const hero = v === g.player.vehicle ? g.save.hero : v.role === "racer" || v.role === "traffic" || v.role === "convoy" ? citizen(v.id) : null;
  if (hero && (v.kind === "bike" || v.kind === "jeep")) drawHero(c, hero, sx - Math.cos(v.a) * 4, sy - (v.kind === "bike" ? 16 : 24) - lift, Math.cos(v.a + v.spin) >= 0 ? 1 : -1, 0, "seat", 0.5);
  if (v.kind === "heli") {
    const top = sy - 52 - lift;
    const a = v.spin * 2;
    c.strokeStyle = "rgba(29,29,36,0.7)";
    c.lineWidth = 3;
    c.beginPath();
    for (const k of [0, Math.PI / 2]) {
      c.moveTo(sx - Math.cos(a + k) * 62, top - Math.sin(a + k) * 62 * K);
      c.lineTo(sx + Math.cos(a + k) * 62, top + Math.sin(a + k) * 62 * K);
    }
    c.stroke();
  }
  if (v.role === "racer" && v.name) label(c, v.name, sx, sy - 58 - lift, "#ffb224");
  if (v.role === "convoy") bar(c, sx, sy - 80, 60, v.hp / 320, "#8bd99b");
}

const looks = new Map<number, Hero>();
function citizen(id: number): Hero {
  let h = looks.get(id);
  if (!h) {
    const tops = ["#ef5a3c", "#3fa7ff", "#ffb224", "#5fa35a", "#9b6bff", "#ff6b8a", "#edeae3"];
    h = { name: "", hair: (["short", "long", "ponytail", "curly", "spiky"] as const)[id % 5], hairColor: ["#141010", "#3b2416", "#b5562a"][id % 3], headwear: "none", skin: ["#f1c9a5", "#c68b5e", "#7a4b2c", "#e0b48a"][id % 4], top: tops[id % tops.length], bottom: "pants", bottomColor: "#30343c" };
    looks.set(id, h);
  }
  return h;
}

function label(c: Ctx, text: string, x: number, y: number, color = "#edeae3") {
  c.font = "600 11px Geist, system-ui, sans-serif";
  const w = c.measureText(text).width + 12;
  c.fillStyle = "rgba(8,8,10,0.7)";
  c.beginPath();
  c.roundRect(x - w / 2, y - 9, w, 18, 9);
  c.fill();
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x, y + 0.5);
  c.textBaseline = "alphabetic";
}

function bar(c: Ctx, x: number, y: number, w: number, frac: number, color: string) {
  c.fillStyle = "rgba(8,8,10,0.6)";
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = color;
  c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
}

function bubble(c: Ctx, x: number, y: number, text: string, max = 180) {
  c.font = "500 12px Geist, system-ui, sans-serif";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 18;
  const h = lines.length * 15 + 10;
  c.fillStyle = "#fdfcf8";
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(x - w / 2, y - h - 8, w, h, 8);
  c.moveTo(x - 6, y - 8);
  c.lineTo(x, y);
  c.lineTo(x + 6, y - 8);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  lines.forEach((l, i) => c.fillText(l, x, y - h - 8 + 12 + i * 15));
  c.textBaseline = "alphabetic";
}

function cone(c: Ctx, x: number, y: number, a: number, half: number, range: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y * K);
  for (let i = 0; i <= 16; i++) {
    const t = a - half + (i / 16) * half * 2;
    c.lineTo(x + Math.cos(t) * range, (y + Math.sin(t) * range) * K);
  }
  c.closePath();
  c.fill();
}

function drawBot(c: Ctx, x: number, y: number, a: number, alert: boolean, stunned: boolean, time: number) {
  const sy = y * K;
  shadow(c, x, sy, 14, 6);
  c.fillStyle = stunned ? "#5d5b56" : "#3a3a42";
  c.beginPath();
  c.roundRect(x - 11, sy - 34, 22, 28, 6);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = stunned ? "#8e8b84" : alert ? "#ff5a4e" : "#ffd36b";
  c.beginPath();
  c.arc(x + Math.cos(a) * 5, sy - 24, 4, 0, TAU);
  c.fill();
  c.strokeStyle = INK;
  c.beginPath();
  c.moveTo(x, sy - 34);
  c.lineTo(x, sy - 42);
  c.stroke();
  c.fillStyle = alert ? "#ff5a4e" : "#8e8b84";
  c.beginPath();
  c.arc(x, sy - 43, 2.5, 0, TAU);
  c.fill();
  c.fillStyle = INK;
  c.fillRect(x - 9, sy - 7, 6, 7 + Math.sin(time * 8) * 1.5);
  c.fillRect(x + 3, sy - 7, 6, 7 - Math.sin(time * 8) * 1.5);
  if (stunned) {
    c.fillStyle = "#ffd36b";
    for (let i = 0; i < 3; i++) {
      const t = time * 3 + (i * TAU) / 3;
      c.fillRect(x + Math.cos(t) * 12 - 2, sy - 52 + Math.sin(t) * 4, 4, 4);
    }
  }
}

function terminal(c: Ctx, x: number, y: number, time: number, done: boolean) {
  const sy = y * K;
  shadow(c, x, sy, 18, 6);
  c.fillStyle = "#2a2a30";
  c.fillRect(x - 14, sy - 36, 28, 36);
  c.fillStyle = done ? "#8bd99b" : Math.sin(time * 6) > 0 ? "#3fa7ff" : "#1f5a8a";
  c.fillRect(x - 10, sy - 32, 20, 14);
}

function cat(c: Ctx, x: number, y: number, time: number) {
  const sy = y * K;
  shadow(c, x, sy, 12, 4);
  c.fillStyle = "#e08a3a";
  c.beginPath();
  c.ellipse(x, sy - 8, 12, 7, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(x + 11, sy - 14, 6, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(x + 7, sy - 18);
  c.lineTo(x + 9, sy - 25);
  c.lineTo(x + 12, sy - 19);
  c.moveTo(x + 12, sy - 19);
  c.lineTo(x + 15, sy - 25);
  c.lineTo(x + 17, sy - 17);
  c.fill();
  c.strokeStyle = "#e08a3a";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x - 11, sy - 8);
  c.quadraticCurveTo(x - 22, sy - 14 + Math.sin(time * 3) * 4, x - 18, sy - 24);
  c.stroke();
}

function notebook(c: Ctx, x: number, y: number) {
  const sy = y * K;
  shadow(c, x, sy, 12, 4);
  c.fillStyle = "#3fa7ff";
  c.fillRect(x - 10, sy - 14, 20, 12);
  c.fillStyle = "#edeae3";
  c.fillRect(x - 1, sy - 14, 2, 12);
}

function ring(c: Ctx, x: number, y: number, r: number, color: string, time: number, width = 4) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.ellipse(x, y * K, r + Math.sin(time * 4) * 3, (r + Math.sin(time * 4) * 3) * K, 0, 0, TAU);
  c.stroke();
}

function arrowAbove(c: Ctx, x: number, y: number, color: string, time: number) {
  const b = Math.sin(time * 4) * 5;
  c.fillStyle = color;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x - 10, y - 16 + b);
  c.lineTo(x + 10, y - 16 + b);
  c.lineTo(x, y + b);
  c.closePath();
  c.fill();
  c.stroke();
}

/* ---------- The frame ---------- */

interface Drawable {
  y: number;
  draw: () => void;
}

export function render(c: Ctx, g: City, cssW: number, cssH: number, dpr: number) {
  const vw = viewWidth(cssW, g.cam.zoom);
  const scale = cssW / vw;
  const vh = cssH / scale;
  const time = g.time;
  const map = g.map;
  const shakeX = g.shake ? Math.sin(time * 70) * g.shake * 5 : 0;
  const camX = Math.max(vw / 2, Math.min(W - vw / 2, g.cam.x + g.camOffset.x)) + shakeX;
  const camSY = Math.max(vh / 2, Math.min(H * K - vh / 2, (g.cam.y + g.camOffset.y) * K));
  g.view = { x: camX, y: camSY / K, scale, w: cssW, h: cssH };
  const left = camX - vw / 2;
  const top = camSY - vh / 2;
  const right = left + vw;
  const bottom = top + vh;
  const inView = (x: number, sy: number, pad = 200) => x > left - pad && x < right + pad && sy > top - pad && sy < bottom + pad * 2;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = "#3f8fd0";
  c.fillRect(0, 0, cssW, cssH);
  c.setTransform(scale * dpr, 0, 0, scale * dpr, (cssW / 2 - camX * scale) * dpr, (cssH / 2 - camSY * scale) * dpr);
  c.imageSmoothingEnabled = true;

  // Ground
  const cx0 = Math.max(0, Math.floor(left / CHUNK));
  const cx1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor(right / CHUNK));
  const cy0 = Math.max(0, Math.floor(top / (CHUNK * K)));
  const cy1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor(bottom / (CHUNK * K)));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) c.drawImage(chunk(map, cx, cy), cx * CHUNK, cy * CHUNK * K, CHUNK, CHUNK * K);
  // Sparkle on the water
  c.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 40; i++) {
    const x = left + hash(i) * vw;
    const y = top + hash(i + 50) * vh;
    if (map.tileAt(x, y / K) === Tile.Water && Math.sin(time * 2 + i) > 0.6) c.fillRect(x, y, 6, 1.5);
  }

  // Things flat on the ground: boost pads, sight cones, checkpoint rings, markers
  const boosts = [...map.boosts, ...g.save.props.filter((q) => q.kind === "boost").map((q) => ({ x: q.x, y: q.y, heading: q.heading ?? 0 }))];
  for (const b of boosts) {
    if (!inView(b.x, b.y * K)) continue;
    const a = (b.heading * TAU) / 16;
    c.save();
    c.translate(b.x, b.y * K);
    c.scale(1, K);
    c.rotate(a);
    c.fillStyle = "#2a2a30";
    c.fillRect(-40, -22, 80, 44);
    const k = (time * 3) % 1;
    for (let i = 0; i < 4; i++) {
      c.fillStyle = `rgba(255,178,36,${0.35 + 0.65 * ((i / 4 + k) % 1)})`;
      c.beginPath();
      c.moveTo(-30 + i * 18, -14);
      c.lineTo(-18 + i * 18, 0);
      c.lineTo(-30 + i * 18, 14);
      c.lineTo(-36 + i * 18, 14);
      c.lineTo(-24 + i * 18, 0);
      c.lineTo(-36 + i * 18, -14);
      c.fill();
    }
    c.restore();
  }
  const m = g.mission;
  if (m && (m.def.kind === "stealth" || m.def.kind === "hack" || m.def.kind === "extract")) {
    for (const b of g.bots) if (b.stun <= 0) cone(c, b.x, b.y, b.a, 0.62, 230, b.alert > 0 ? "rgba(255,90,78,0.22)" : "rgba(255,211,107,0.18)");
    map.searchlights.forEach((s, i) => cone(c, s.x, s.y, g.searchlightAngle(i), 0.3, 300, "rgba(255,248,200,0.25)"));
  }
  if (g.race) {
    const wps = g.raceWaypoints(g.race.def);
    const t = wps[g.race.wp];
    if (t) ring(c, t.x, t.y, 110, "#ffb224", time, 6);
    const n = wps[g.race.wp + 1];
    if (n) ring(c, n.x, n.y, 110, "rgba(255,178,36,0.35)", time, 3);
  }
  if (g.job?.target) ring(c, g.job.target.x, g.job.target.y, 60, "#8bd99b", time);
  if (m) for (const k of m.markers) if (!k.done && k.kind === "photo") {
    ring(c, k.x, k.y, 44, "#ffb224", time, 3);
    if (k.progress) {
      c.strokeStyle = "#8bd99b";
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(k.x, k.y * K, 44, 44 * K, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k.progress);
      c.stroke();
    }
  }
  for (const r of ["downtown", "bike", "grand"]) {
    const s = map.places[`race_${r}`];
    if (!s || !inView(s.x, s.y * K)) continue;
    c.fillStyle = "rgba(255,178,36,0.25)";
    c.beginPath();
    c.ellipse(s.x, s.y * K, 90, 90 * K, 0, 0, TAU);
    c.fill();
  }

  // Everything that stands up, sorted by depth
  const list: Drawable[] = [];
  const f = g.focus();
  const fsy = f.y * K;
  for (const b of map.buildings) {
    const s = sprite(b.sprite);
    const sy = b.y * K;
    if (!s || !inView(b.x, sy, 400)) continue;
    list.push({
      y: b.y,
      draw: () => {
        // See-through when you're behind it
        const behind = f.y < b.y && f.y > b.rect[1] - 220 && f.x > b.x - s.m.ax && f.x < b.x - s.m.ax + s.m.w && fsy > sy - s.m.ay;
        if (behind) c.globalAlpha = 0.4;
        c.drawImage(s.img, b.x - s.m.ax, sy - s.m.ay, s.m.w, s.m.h);
        c.globalAlpha = 1;
      },
    });
  }
  for (const d of map.decor) {
    const s = sprite(d.sprite);
    if (!s || !inView(d.x, d.y * K)) continue;
    list.push({ y: d.y, draw: () => c.drawImage(s.img, d.x - s.m.ax, d.y * K - s.m.ay, s.m.w, s.m.h) });
  }
  // Plots: a sign on the empty ones, the building on the rest
  map.plots.forEach((p, i) => {
    const k = g.save.plots[i];
    if (!inView(p.x, p.y * K, 300)) return;
    if (k) {
      const s = sprite(PLOTS[k].sprite);
      if (s) list.push({ y: p.y - 30, draw: () => c.drawImage(s.img, p.x - s.m.ax, (p.y - 30) * K - s.m.ay, s.m.w, s.m.h) });
    } else
      list.push({
        y: p.y - 120,
        draw: () => {
          const sy = (p.y - 120) * K;
          c.fillStyle = "#6a4a2a";
          c.fillRect(p.x - 2, sy - 34, 4, 34);
          c.fillStyle = "#ffb224";
          c.beginPath();
          c.roundRect(p.x - 36, sy - 56, 72, 26, 4);
          c.fill();
          c.fillStyle = INK;
          c.font = "700 11px Geist, system-ui, sans-serif";
          c.textAlign = "center";
          c.fillText("FOR SALE", p.x, sy - 39);
        },
      });
  });
  // Fences, in segments so they sort properly
  for (const fc of map.fences) {
    const [x0, y0, x1, y1] = fc.rect;
    const segs: [number, number, number, number][] = [];
    for (let x = x0; x < x1; x += 64) segs.push([x, y0, Math.min(x1, x + 64), y0], [x, y1, Math.min(x1, x + 64), y1]);
    for (let y = y0; y < y1; y += 64) {
      const ye = Math.min(y1, y + 64);
      if (!(y >= fc.gate[0] - 32 && ye <= fc.gate[1] + 32)) segs.push([x0, y, x0, ye]);
      segs.push([x1, y, x1, ye]);
    }
    for (const [ax, ay, bx, by] of segs) {
      if (!inView(ax, ay * K)) continue;
      list.push({
        y: Math.max(ay, by),
        draw: () => {
          c.strokeStyle = "#8e8b84";
          c.lineWidth = 2;
          for (const hgt of [6, 16, 26]) {
            c.beginPath();
            c.moveTo(ax, ay * K - hgt);
            c.lineTo(bx, by * K - hgt);
            c.stroke();
          }
          c.fillStyle = "#5d5b56";
          c.fillRect(ax - 2, ay * K - 30, 4, 30);
        },
      });
    }
    // Gate posts and a sign
    const gx = x0;
    list.push({ y: fc.gate[1], draw: () => label(c, fc === map.fences[0] ? "ARMY BASE" : "RED ZONE · KEEP OUT", gx, fc.gate[0] * K - 40, fc === map.fences[0] ? "#8bd99b" : "#ff5a4e") });
  }
  // Ramps
  const ramps = [...map.ramps, ...g.save.props.filter((q) => q.kind === "ramp").map((q) => ({ x: q.x, y: q.y, heading: q.heading ?? 0 }))];
  for (const r of ramps) {
    const fr = spinnerFrame("ramp", (r.heading * TAU) / 16);
    if (!fr || !inView(r.x, r.y * K)) continue;
    list.push({ y: r.y - 30, draw: () => c.drawImage(fr.img, fr.f.sx, 0, fr.f.w * 2, fr.f.h * 2, r.x - fr.f.ax, r.y * K - fr.f.ay, fr.f.w, fr.f.h) });
  }
  // Builder props
  for (const q of g.save.props) {
    if (q.kind === "ramp" || q.kind === "boost" || !inView(q.x, q.y * K)) continue;
    list.push({ y: q.y, draw: () => drawProp(c, g, q.kind, q.x, q.y, q, time) });
  }
  if (g.builder && g.ghost) {
    const gh = g.ghost;
    list.push({
      y: gh.y + 1000,
      draw: () => {
        c.globalAlpha = 0.55;
        if (gh.kind === "ramp" || gh.kind === "boost") {
          const fr = spinnerFrame("ramp", 0);
          if (fr && gh.kind === "ramp") c.drawImage(fr.img, fr.f.sx, 0, fr.f.w * 2, fr.f.h * 2, gh.x - fr.f.ax, gh.y * K - fr.f.ay, fr.f.w, fr.f.h);
          else ring(c, gh.x, gh.y, 40, "#ffb224", time);
        } else drawProp(c, g, gh.kind, gh.x, gh.y, null, time);
        c.globalAlpha = 1;
      },
    });
  }
  // Vehicles
  for (const v of g.vehicles) if (inView(v.x, v.y * K)) list.push({ y: v.y + (v.kind === "heli" && v.z > 20 ? 2000 : 0), draw: () => drawVehicle(c, g, v) });
  // People
  for (const q of g.peds) {
    if (!inView(q.x, q.y * K) || q === g.job?.passenger && g.player.vehicle) continue;
    list.push({
      y: q.y,
      draw: () => {
        const hostage = q.follow === 1;
        const pose: Pose = q.dodge > 0 ? "air" : q.hail ? "wave" : hostage || q.speed > 0 ? "walk" : "stand";
        shadow(c, q.x, q.y * K, 9, 3.5, 0.2);
        drawHero(c, q.look, q.x, q.y * K, q.dir === 2 ? -1 : q.dir === 0 ? 1 : q.id % 2 ? 1 : -1, q.phase, pose, 0.52);
        if (q.quipT > 0 && q.quip) bubble(c, q.x, q.y * K - 46, q.quip);
        if (hostage) bar(c, q.x, q.y * K - 52, 28, ((q as { hp?: number }).hp ?? 60) / 60, "#8bd99b");
      },
    });
  }
  // The people of the city you can talk to
  for (const id of CONTACT_ORDER) {
    const at = g.contactPos(id);
    if (!inView(at.x, at.y * K)) continue;
    const news = g.hasNews(id);
    list.push({
      y: at.y,
      draw: () => {
        shadow(c, at.x, at.y * K, 10, 4);
        drawHero(c, CONTACTS[id].look, at.x, at.y * K, f.x < at.x ? -1 : 1, time * 3, news ? "wave" : "stand", 0.56);
        label(c, CONTACTS[id].name, at.x, at.y * K - 52, news ? "#ffb224" : "#edeae3");
        if (news) arrowAbove(c, at.x, at.y * K - 66, "#ffb224", time);
      },
    });
  }
  // Mission objects
  if (m) {
    for (const k of m.markers) {
      if (k.done) continue;
      if (k.kind === "terminal") list.push({ y: k.y, draw: () => terminal(c, k.x, k.y, time, false) });
      if (k.kind === "hostage") list.push({ y: k.y, draw: () => {
        drawHero(c, { name: "", hair: "short", hairColor: "#3b2416", headwear: "helmet", skin: "#c68b5e", top: "#edeae3", bottom: "pants", bottomColor: "#30343c" }, k.x, k.y * K, 1, 0, "down", 0.52);
        bubble(c, k.x, k.y * K - 30, "Help!");
      } });
    }
    for (const b of g.bots) if (inView(b.x, b.y * K)) list.push({ y: b.y, draw: () => drawBot(c, b.x, b.y, b.a, b.alert > 0, b.stun > 0, time) });
  }
  if (g.questItem) {
    const it = g.questItem;
    list.push({
      y: it.item.y,
      draw: () => {
        if (it.label.includes("cat")) cat(c, it.item.x, it.item.y, time);
        else if (it.label.includes("notebook")) notebook(c, it.item.x, it.item.y);
        else {
          const s = sprite("crate");
          if (s) c.drawImage(s.img, it.item.x - s.m.ax * 0.8, it.item.y * K - s.m.ay * 0.8, s.m.w * 0.8, s.m.h * 0.8);
        }
        arrowAbove(c, it.item.x, it.item.y * K - 40, "#8bd99b", time);
      },
    });
  }
  // The hero
  const p = g.player;
  if (!p.vehicle && g.save.hero) {
    list.push({
      y: p.y,
      draw: () => {
        shadow(c, p.x, p.y * K, 10, 4, 0.3);
        const moving = Math.hypot(p.vx, p.vy) > 20;
        drawHero(c, g.save.hero!, p.x, p.y * K, p.facing, p.phase, p.downT > 0 ? "down" : moving ? "walk" : "stand", 0.58, p.hurtT > 0);
      },
    });
  }
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();

  // Drones fly above everything
  const drone = sprite("drone");
  for (const d of g.drones) {
    if (!inView(d.x, d.y * K)) continue;
    const sy = d.y * K;
    const bob = Math.sin(time * 4 + d.orbit) * 4;
    shadow(c, d.x, sy, d.boss ? 26 : 13, d.boss ? 9 : 5, 0.2);
    const sc = d.boss ? 2.4 : 1.2;
    if (drone) c.drawImage(drone.img, d.x - drone.m.ax * sc, sy - d.z * KZ - drone.m.ay * sc + bob, drone.m.w * sc, drone.m.h * sc);
    else {
      c.fillStyle = "#2a2a30";
      c.fillRect(d.x - 12, sy - d.z * KZ + bob, 24, 10);
    }
    if (d.boss || d.hp < d.max) bar(c, d.x, sy - d.z * KZ - (d.boss ? 50 : 26) + bob, d.boss ? 80 : 30, d.hp / d.max, d.boss ? "#ff5a4e" : "#ffb224");
  }
  // Paint pellets and enemy fire
  for (const s of g.shots) {
    const sy = s.y * K - 22;
    c.fillStyle = s.color;
    c.beginPath();
    c.arc(s.x, sy, s.enemy ? 5 : 4, 0, TAU);
    c.fill();
    c.fillStyle = s.enemy ? "rgba(255,90,78,0.3)" : "rgba(255,255,255,0.3)";
    c.beginPath();
    c.arc(s.x - s.vx * 0.012, sy - s.vy * 0.012 * K, s.enemy ? 4 : 3, 0, TAU);
    c.fill();
  }
  for (const q of g.particles) {
    c.globalAlpha = Math.max(0, Math.min(1, (q.life / q.max) * 1.5));
    c.fillStyle = q.color;
    c.fillRect(q.x - q.size / 2, q.y * K - q.z * KZ - q.size / 2, q.size, q.size);
  }
  c.globalAlpha = 1;

  // Night
  const night = 1 - g.daylight;
  if (night > 0.04) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = `rgba(10,14,46,${night * 0.55})`;
    c.fillRect(0, 0, cssW, cssH);
    c.setTransform(scale * dpr, 0, 0, scale * dpr, (cssW / 2 - camX * scale) * dpr, (cssH / 2 - camSY * scale) * dpr);
    if (night > 0.3) {
      const a = Math.min(1, (night - 0.3) * 2);
      c.globalAlpha = a * 0.6;
      for (const b of map.buildings) {
        const s = sprite(b.sprite, true);
        if (s && inView(b.x, b.y * K, 400)) c.drawImage(s.img, b.x - s.m.ax, b.y * K - s.m.ay, s.m.w, s.m.h);
      }
      c.globalAlpha = a;
      c.globalCompositeOperation = "lighter";
      const glow = (x: number, y: number, r: number, color: string) => {
        const gr = c.createRadialGradient(x, y, 1, x, y, r);
        gr.addColorStop(0, color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const lamps = [...map.decor.filter((d) => d.sprite === "lamp"), ...g.save.props.filter((q) => q.kind === "lamp")];
      for (const d of lamps) if (inView(d.x, d.y * K)) glow(d.x + 12, d.y * K - 60, 110, "rgba(255,210,120,0.35)");
      // Street lights at every junction
      for (const vr of VROADS) for (const hr of HROADS) if (inView(vr * T, hr * T * K)) glow((vr + 1) * T, (hr + 1) * T * K, 160, "rgba(255,200,110,0.18)");
      for (const v of g.vehicles) {
        if (!inView(v.x, v.y * K) || (v.role === "parked" && v !== g.player.vehicle)) continue;
        const hx = v.x + Math.cos(v.a) * 70;
        const hy = (v.y + Math.sin(v.a) * 70) * K;
        glow(hx, hy, 70, "rgba(255,240,190,0.35)");
      }
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
    }
  }

  // Speech from signs and people placed in the Builder
  if (g.talking !== null) {
    const q = g.save.props.find((r) => r.id === g.talking);
    if (q?.text) bubble(c, q.x, q.y * K - 60, q.text, 220);
  }
  // Builder selection
  if (g.builder && g.selected !== null) {
    const q = g.save.props.find((r) => r.id === g.selected);
    if (q) {
      c.strokeStyle = "#ffb224";
      c.setLineDash([5, 4]);
      c.lineWidth = 2 / scale;
      c.strokeRect(q.x - 36, q.y * K - 70, 72, 84);
      c.setLineDash([]);
    }
  }

  drawHud(c, g, cssW, cssH, dpr, { camX, camSY, scale });
}

/* ---------- Builder props ---------- */

const PEOPLE = new Map<string, Hero>();
function drawProp(c: Ctx, g: City, kind: string, x: number, y: number, q: { id: number; text?: string; color?: string } | null, time: number) {
  const sy = y * K;
  if (kind.startsWith("pack:")) {
    const pk = g.save.packs.find((p) => `pack:${p.id}` === kind);
    const img = pk && packImage(pk);
    if (pk && img) c.drawImage(img, x - pk.ax, sy - pk.ay, pk.w, pk.h);
    return;
  }
  const s = sprite(kind);
  if (s) {
    c.drawImage(s.img, x - s.m.ax, sy - s.m.ay, s.m.w, s.m.h);
    return;
  }
  switch (kind) {
    case "coin":
      if (q && g.propCoin.has(q.id)) return;
      shadow(c, x, sy, 8, 3, 0.2);
      c.fillStyle = "#ffb224";
      c.beginPath();
      c.ellipse(x, sy - 18 + Math.sin(time * 3 + x) * 3, 9 * Math.abs(Math.cos(time * 3 + x * 0.01)) + 1, 9, 0, 0, TAU);
      c.fill();
      break;
    case "sign":
      c.fillStyle = "#6a4a2a";
      c.fillRect(x - 2, sy - 30, 4, 30);
      c.fillStyle = "#c9a26a";
      c.beginPath();
      c.roundRect(x - 34, sy - 54, 68, 26, 3);
      c.fill();
      c.fillStyle = INK;
      c.font = "600 10px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      {
        let t = q?.text ?? "Sign";
        while (t.length > 1 && c.measureText(t).width > 60) t = t.slice(0, -2) + "…";
        c.fillText(t, x, sy - 37);
      }
      break;
    case "person": {
      const key = q?.color ?? "#3fa7ff";
      let look = PEOPLE.get(key);
      if (!look) {
        look = { name: "", hair: "short", hairColor: "#3b2416", headwear: "none", skin: "#e0b48a", top: key, bottom: "pants", bottomColor: "#30343c" };
        PEOPLE.set(key, look);
      }
      shadow(c, x, sy, 10, 4);
      drawHero(c, look, x, sy, g.focus().x < x ? -1 : 1, time * 3, g.talking === q?.id ? "wave" : "stand", 0.55);
      break;
    }
    case "wall": {
      const col = q?.color ?? "#8e8b84";
      c.fillStyle = mix(col, "#000000", 0.25);
      c.fillRect(x - 32, sy - 30, 64, 30);
      c.fillStyle = mix(col, "#ffffff", 0.15);
      c.fillRect(x - 32, sy - 30 - 18, 64, 18);
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.strokeRect(x - 32, sy - 48, 64, 48);
      break;
    }
    default:
      c.fillStyle = "rgba(255,255,255,0.3)";
      c.fillRect(x - 12, sy - 24, 24, 24);
  }
}

/** Small preview images for the Builder palette. */
export const previewUrl = (kind: string) => fileUrl(kind);

/* ---------- HUD ---------- */

function panel(c: Ctx, x: number, y: number, w: number, h: number, fill = "rgba(10,10,14,0.72)", r = 10) {
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

function drawHud(c: Ctx, g: City, W_: number, H_: number, dpr: number, cam: { camX: number; camSY: number; scale: number }) {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const small = W_ < 700;
  const p = g.player;
  const font = (w: number, s: number, mono = false) => `${w} ${s}px ${mono ? "Geist Mono, ui-monospace, monospace" : "Geist, system-ui, sans-serif"}`;
  c.textBaseline = "middle";

  // Money, level, health
  const lv = g.rank();
  panel(c, 12, 12, small ? 176 : 214, 74);
  c.textAlign = "left";
  c.fillStyle = "#8bd99b";
  c.font = font(700, small ? 20 : 24, true);
  c.fillText(`$${g.save.money.toLocaleString()}`, 24, 34);
  c.fillStyle = "#ffb224";
  c.font = font(700, 11, true);
  const lvText = `LV ${lv.level}`;
  c.fillText(lvText, 24, 56);
  const bx = 24 + c.measureText(lvText).width + 8;
  const bw = (small ? 176 : 214) - (bx - 12) - 14;
  c.fillStyle = "rgba(255,255,255,0.12)";
  c.fillRect(bx, 53, bw, 5);
  c.fillStyle = "#ffb224";
  c.fillRect(bx, 53, (bw * lv.into) / lv.need, 5);
  c.fillStyle = "rgba(255,255,255,0.12)";
  c.fillRect(24, 68, (small ? 176 : 214) - 26, 6);
  c.fillStyle = p.hp > 50 ? "#8bd99b" : p.hp > 25 ? "#ffb224" : "#ff5a4e";
  c.fillRect(24, 68, ((small ? 176 : 214) - 26) * (p.hp / 100), 6);
  if (p.shield > 0) {
    c.fillStyle = "#3fa7ff";
    c.fillRect(24, 68, ((small ? 176 : 214) - 26) * (p.shield / 50) * 0.5, 3);
  }
  // Next goal
  const goal = g.nextGoal();
  c.font = font(500, 12);
  const gw = Math.min(W_ - 24, c.measureText(goal).width + 60);
  panel(c, 12, 92, gw, 26, "rgba(10,10,14,0.6)", 13);
  c.fillStyle = "#ffb224";
  c.font = font(700, 10, true);
  c.fillText("NEXT", 22, 105.5);
  c.fillStyle = "#edeae3";
  c.font = font(500, 12);
  c.fillText(goal, 58, 105.5, gw - 56);

  // Minimap
  const mm = minimapImage(g.map);
  const ms = small ? 104 : 168;
  const mx = W_ - ms - 12;
  const my = 12;
  const f = g.focus();
  c.save();
  c.beginPath();
  c.roundRect(mx, my, ms, ms, 14);
  c.clip();
  c.fillStyle = "#3f8fd0";
  c.fillRect(mx, my, ms, ms);
  const zoom = 0.9;
  const sx = f.x / 16 - ms / 2 / zoom;
  const sy = f.y / 16 - ms / 2 / zoom;
  c.imageSmoothingEnabled = false;
  c.drawImage(mm, sx, sy, ms / zoom, ms / zoom, mx, my, ms, ms);
  c.imageSmoothingEnabled = true;
  const toMini = (x: number, y: number) => [mx + (x / 16 - sx) * zoom, my + (y / 16 - sy) * zoom];
  const dot = (x: number, y: number, color: string, r = 3.5) => {
    const [px, py] = toMini(x, y);
    c.fillStyle = color;
    c.beginPath();
    c.arc(Math.max(mx + 4, Math.min(mx + ms - 4, px)), Math.max(my + 4, Math.min(my + ms - 4, py)), r, 0, TAU);
    c.fill();
  };
  for (const id of CONTACT_ORDER) if (g.hasNews(id)) {
    const at = g.contactPos(id);
    dot(at.x, at.y, "#ffb224", 3);
  }
  for (const d of g.drones) dot(d.x, d.y, "#ff5a4e", 2);
  if (g.gps) dot(g.gps.x, g.gps.y, "#8bd99b", 4.5);
  const [px, py] = toMini(f.x, f.y);
  c.fillStyle = "#edeae3";
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.beginPath();
  const pa = p.vehicle ? p.vehicle.a : p.facing > 0 ? 0 : Math.PI;
  c.moveTo(px + Math.cos(pa) * 7, py + Math.sin(pa) * 7);
  c.lineTo(px + Math.cos(pa + 2.5) * 5, py + Math.sin(pa + 2.5) * 5);
  c.lineTo(px + Math.cos(pa - 2.5) * 5, py + Math.sin(pa - 2.5) * 5);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.25)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(mx, my, ms, ms, 14);
  c.stroke();

  // GPS arrow
  if (g.gps) {
    const tx = (g.gps.x - cam.camX) * cam.scale + W_ / 2;
    const ty = (g.gps.y * K - cam.camSY) * cam.scale + H_ / 2;
    const metres = Math.round(Math.hypot(g.gps.x - f.x, g.gps.y - f.y) / 24);
    const onScreen = tx > 30 && tx < W_ - 30 && ty > 130 && ty < H_ - 40;
    if (onScreen) arrowAbove(c, tx, ty - 30, "#8bd99b", g.time);
    else {
      const a = Math.atan2(ty - H_ / 2, tx - W_ / 2);
      const rx = W_ / 2 - 50;
      const ry = H_ / 2 - 70;
      const k = Math.min(rx / Math.abs(Math.cos(a) || 0.001), ry / Math.abs(Math.sin(a) || 0.001));
      const ax = W_ / 2 + Math.cos(a) * k;
      const ay = H_ / 2 + 20 + Math.sin(a) * k;
      c.save();
      c.translate(ax, ay);
      c.rotate(a);
      c.fillStyle = "#8bd99b";
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(16, 0);
      c.lineTo(-8, -11);
      c.lineTo(-3, 0);
      c.lineTo(-8, 11);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
      c.textAlign = "center";
      c.font = font(700, 11, true);
      c.fillStyle = "#8bd99b";
      c.fillText(`${metres} m`, ax - Math.cos(a) * 26, ay - Math.sin(a) * 22);
    }
  }

  // Mission / race / job card
  let ty = small ? 128 : 16;
  const card = (title: string, line: string, right?: string, color = "#ffb224") => {
    const w = Math.min(W_ - 24, 420);
    const x = (W_ - w) / 2;
    const y = small ? ty : 16;
    panel(c, x, y, w, 50);
    c.textAlign = "left";
    c.fillStyle = color;
    c.font = font(700, 10, true);
    c.fillText(title.toUpperCase(), x + 14, y + 16);
    c.fillStyle = "#edeae3";
    c.font = font(500, 13);
    c.fillText(line, x + 14, y + 34, w - 90);
    if (right) {
      c.textAlign = "right";
      c.font = font(700, 18, true);
      c.fillText(right, x + w - 14, y + 26);
    }
    ty = y + 58;
  };
  const m = g.mission;
  if (m) card(`Mission · ${m.def.title}`, m.objective, m.started ? `${Math.floor(m.t)}s` : undefined);
  else if (g.race) {
    const r = g.race;
    const ahead = r.racers.filter((q) => q.finished > 0 || q.wp > r.wp).length;
    card(r.def.title, `Checkpoint ${Math.min(r.wp, r.def.route.length - 1)}/${r.def.route.length - 1}`, `P${ahead + 1}/4`);
  } else if (g.job) card(g.job.kind === "pizza" ? "Pizza run" : "Taxi", g.nextGoal(), g.job.kind === "pizza" || g.job.passenger ? `${Math.max(0, Math.ceil(g.job.t))}s` : `$${g.job.earned}`, "#8bd99b");
  if (m && m.def.kind === "stealth") {
    const w = 140;
    panel(c, (W_ - w) / 2, ty, w, 22, "rgba(10,10,14,0.6)", 11);
    c.fillStyle = m.detect > 0.6 ? "#ff5a4e" : "#ffb224";
    c.fillRect((W_ - w) / 2 + 8, ty + 8, (w - 16) * m.detect, 6);
    c.textAlign = "center";
    c.fillStyle = "#edeae3";
    c.font = font(700, 9, true);
    c.fillText(m.detect > 0 ? "BEING SEEN" : "HIDDEN", W_ / 2, ty + 11);
    ty += 30;
  }

  // Countdown, stunts, toasts
  if (g.race && g.race.countdown > 0) {
    const n = Math.ceil(g.race.countdown);
    c.textAlign = "center";
    c.font = font(800, 96);
    c.fillStyle = "#ffb224";
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.strokeText(n > 3 ? "3" : String(n), W_ / 2, H_ / 2 - 30);
    c.fillText(n > 3 ? "3" : String(n), W_ / 2, H_ / 2 - 30);
  }
  if (g.stunt) {
    const s = g.stunt;
    const k = Math.min(1, s.t * 2);
    c.globalAlpha = k;
    c.textAlign = "center";
    c.font = font(800, small ? 26 : 38);
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.fillStyle = s.label === "WIPEOUT" ? "#ff5a4e" : "#ffb224";
    const y = H_ * 0.32 - (1 - k) * 20;
    c.strokeText(s.label, W_ / 2, y);
    c.fillText(s.label, W_ / 2, y);
    c.globalAlpha = 1;
  }
  if (g.drift > 60) {
    c.textAlign = "center";
    c.font = font(800, 22);
    c.fillStyle = "#3fa7ff";
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.strokeText(`DRIFT ${Math.round(g.drift)}`, W_ / 2, H_ * 0.4);
    c.fillText(`DRIFT ${Math.round(g.drift)}`, W_ / 2, H_ * 0.4);
  }
  c.textAlign = "center";
  for (const t of g.toasts) {
    c.globalAlpha = Math.min(1, t.t * 2);
    if (t.big) {
      c.font = font(800, small ? 22 : 30);
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.fillStyle = t.color;
      c.strokeText(t.text, W_ / 2, ty + 18);
      c.fillText(t.text, W_ / 2, ty + 18);
      ty += 42;
    } else {
      c.font = font(600, 13);
      const w = c.measureText(t.text).width + 26;
      panel(c, W_ / 2 - w / 2, ty, w, 28, "rgba(10,10,14,0.75)", 14);
      c.fillStyle = t.color;
      c.fillText(t.text, W_ / 2, ty + 14.5);
      ty += 34;
    }
  }
  c.globalAlpha = 1;

  // Prompt
  if (g.prompt) {
    c.font = font(600, 14);
    const w = c.measureText(g.prompt.text).width + 30;
    const y = H_ - (small ? 196 : 58);
    panel(c, W_ / 2 - w / 2, y, w, 34, "rgba(255,178,36,0.95)", 17);
    c.fillStyle = "#08080a";
    c.fillText(g.prompt.text, W_ / 2, y + 17.5);
  }

  // Speed and nitro
  const v = p.vehicle;
  if (v) {
    const x = W_ - (small ? 112 : 150);
    const y = H_ - (small ? 250 : 92);
    panel(c, x, y, small ? 100 : 136, 74);
    c.textAlign = "right";
    c.fillStyle = "#edeae3";
    c.font = font(700, small ? 24 : 30, true);
    c.fillText(String(g.speedKmh()), x + (small ? 64 : 88), y + 30);
    c.textAlign = "left";
    c.fillStyle = "#8e8b84";
    c.font = font(600, 10, true);
    c.fillText("KM/H", x + (small ? 68 : 92), y + 34);
    bar(c, x + (small ? 50 : 68), y + 50, small ? 80 : 112, v.hp / SPECS[v.kind].hp, "#8bd99b");
    if (g.has("nitro")) bar(c, x + (small ? 50 : 68), y + 60, small ? 80 : 112, g.nitro, "#3fa7ff");
  }
  if (g.player.downT > 0) {
    c.fillStyle = "rgba(120,0,0,0.25)";
    c.fillRect(0, 0, W_, H_);
  }
  c.textBaseline = "alphabetic";
}
