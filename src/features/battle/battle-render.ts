/* Stickman Battle Royale: drawing. A tilted top-down view: the ground is squashed by K and
   things with height (walls, trees, people) stand up from it. */

import { AMMO_LABEL, Battle, CHARS, CX, CY, GUNS, ISLE, K, MELEE, WALL_H, zoneLabel, type Actor, type Loot } from "./battle";

type Ctx = CanvasRenderingContext2D;
const INK = "#1d1d24";
const TAU = Math.PI * 2;
const FONT = "Geist, system-ui, sans-serif";

/* Decorative ground blobs, made once so the island looks the same every time */
const BLOBS = (() => {
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: 260 }, () => {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 1420;
    return { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, r: 30 + r() * 80, t: r() };
  });
})();

export const viewZoom = (w: number, h: number) => Math.max(0.55, Math.min(1.5, Math.min(w / 880, h / 560)));

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function renderBattle(c: Ctx, g: Battle, w: number, h: number, dpr: number) {
  const z = viewZoom(w, h);
  const sh = g.shake > 0 ? (Math.random() - 0.5) * g.shake * 40 : 0;
  const ox = w / 2 - g.cam.x * z + sh;
  const oy = h / 2 - g.cam.y * K * z + sh;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = "#0d3350";
  c.fillRect(0, 0, w, h);
  c.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
  const vx0 = -ox / z;
  const vy0 = -oy / z;
  const vx1 = vx0 + w / z;
  const vy1 = vy0 + h / z;
  const inView = (x: number, y: number, m = 80) => x > vx0 - m && x < vx1 + m && y * K > vy0 - m - 120 && y * K < vy1 + m + 120;

  /* Sea, beach, grass */
  c.fillStyle = "#14507a";
  for (let i = 0; i < 40; i++) {
    const t = (g.time * 0.05 + i * 0.173) % 1;
    c.globalAlpha = 0.12 * Math.sin(t * Math.PI);
    c.fillRect(vx0 + ((i * 197) % Math.max(1, vx1 - vx0)), vy0 + t * (vy1 - vy0), 90, 3);
  }
  c.globalAlpha = 1;
  const ell = (x: number, y: number, rx: number, ry: number) => {
    c.beginPath();
    c.ellipse(x, y * K, rx, ry * K, 0, 0, TAU);
  };
  ell(CX, CY, ISLE + 36, ISLE + 36);
  c.fillStyle = "#1f6a99";
  c.fill();
  ell(CX, CY, ISLE + 10, ISLE + 10);
  c.fillStyle = "#e2d3a2";
  c.fill();
  ell(CX, CY, ISLE - 48, ISLE - 48);
  c.fillStyle = "#5b9a47";
  c.fill();
  for (const b of BLOBS) {
    if (!inView(b.x, b.y, b.r)) continue;
    c.fillStyle = b.t < 0.5 ? "rgba(40,100,40,0.16)" : "rgba(160,200,90,0.14)";
    ell(b.x, b.y, b.r, b.r * 0.8);
    c.fill();
  }

  /* Building floors, then loot on top of them */
  for (const b of g.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
    c.fillStyle = "#d8ccb2";
    c.fillRect(b.x, b.y * K, b.w, b.h * K);
    c.fillStyle = "rgba(0,0,0,0.06)";
    for (let x = b.x + 20; x < b.x + b.w; x += 20) c.fillRect(x, b.y * K, 1, b.h * K);
  }
  for (const l of g.loot) if (inView(l.x, l.y, 30)) drawLoot(c, l, g.time);

  /* The zone */
  const zn = g.zone;
  c.save();
  c.beginPath();
  c.rect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20);
  c.ellipse(zn.x, zn.y * K, zn.r, zn.r * K, 0, 0, TAU, true);
  c.fillStyle = "rgba(235,60,60,0.24)";
  c.fill("evenodd");
  c.restore();
  ell(zn.x, zn.y, zn.r, zn.r);
  c.lineWidth = 4;
  c.strokeStyle = "#4fc3ff";
  c.stroke();
  if (zn.stage === "wait" && zn.tr < zn.r - 2) {
    ell(zn.tx, zn.ty, zn.tr, zn.tr);
    c.lineWidth = 3;
    c.setLineDash([14, 10]);
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.stroke();
    c.setLineDash([]);
  }

  /* Fallen fighters lie where they dropped */
  for (const a of g.actors) if (!a.alive && a.z === 0 && inView(a.x, a.y)) drawDown(c, a, g.time - a.diedAt);

  /* Things that stand up, back to front */
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const roofOn = g.buildings.map((b) => !(g.you.alive && g.you.z === 0 && g.you.x > b.x - 6 && g.you.x < b.x + b.w + 6 && g.you.y > b.y - 6 && g.you.y < b.y + b.h + 6));
  const bIndex = (a: Actor) => g.buildings.findIndex((b) => a.x > b.x && a.x < b.x + b.w && a.y > b.y && a.y < b.y + b.h);
  for (const o of g.obs) {
    if (o.dead) continue;
    if (o.k === 1) {
      if (!inView(o.x, o.y, 60)) continue;
      items.push({ y: o.y, draw: () => (o.kind === "tree" ? drawTree(c, o.x, o.y, o.x * 7 + o.y) : drawRock(c, o.x, o.y, o.r)) });
    } else {
      if (!inView(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h))) continue;
      items.push({ y: o.y + o.h, draw: () => (o.kind === "gel" ? drawGel(c, o.x, o.y, o.w, o.h, o.hp) : drawWall(c, o.x, o.y, o.w, o.h, g.buildings.find((b) => o.x >= b.x - 1 && o.x <= b.x + b.w && o.y >= b.y - 1 && o.y <= b.y + b.h)?.col ?? "#c9b79c")) });
    }
  }
  g.buildings.forEach((b, i) => {
    if (!roofOn[i] || !inView(b.x + b.w / 2, b.y + b.h / 2, 200)) return;
    items.push({ y: b.y + b.h + 0.5, draw: () => drawRoof(c, b.x, b.y, b.w, b.h, b.roof) });
  });
  if (g.airdrop && inView(g.airdrop.x, g.airdrop.y, 80)) {
    const ad = g.airdrop;
    items.push({ y: ad.y, draw: () => drawCrate(c, ad.x, ad.y, ad.t, g.time) });
  }
  for (const n of g.nades) items.push({ y: n.y, draw: () => ((c.fillStyle = "#222"), c.beginPath(), c.arc(n.x, n.y * K - 6, 5, 0, TAU), c.fill(), (c.fillStyle = "#e55"), c.fillRect(n.x - 1, n.y * K - 13, 2, 3)) });
  const you = g.you;
  const radar = you.alive && you.radar > 0;
  for (const a of g.actors) {
    if (!a.alive || a.z > 0 || !inView(a.x, a.y)) continue;
    if (a !== you) {
      const bi = bIndex(a);
      if (bi >= 0 && roofOn[bi]) continue; // hidden under a roof
      if (a.ghost > 0 && a.reveal <= 0 && Math.hypot(a.x - you.x, a.y - you.y) > 80) continue;
    }
    items.push({ y: a.y, draw: () => drawFighter(c, g, a, 0, radar && a !== you) });
  }
  items.sort((p, q) => p.y - q.y);
  for (const it of items) it.draw();

  /* Aim line for the player */
  if (you.alive && you.z === 0) {
    const gun = g.gun(you);
    const len = Math.min(gun ? gun.range : 60, 420);
    c.strokeStyle = "rgba(255,255,255,0.22)";
    c.lineWidth = 1.5;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.moveTo(you.x, you.y * K - 34);
    c.lineTo(you.x + Math.cos(you.a) * len, (you.y + Math.sin(you.a) * len) * K - 34);
    c.stroke();
    c.setLineDash([]);
  }

  /* Bullets */
  for (const b of g.bullets) {
    if (!inView(b.x, b.y, 40)) continue;
    c.strokeStyle = b.color;
    c.lineWidth = b.pellet ? 2 : 3;
    c.lineCap = "round";
    const L = 0.018;
    c.beginPath();
    c.moveTo(b.x - b.vx * L, (b.y - b.vy * L) * K - 32);
    c.lineTo(b.x, b.y * K - 32);
    c.stroke();
  }

  /* Effects */
  for (const f of g.fx) {
    const k = f.t / f.max;
    if (f.k === "spark") {
      c.fillStyle = f.color ?? "#ffe08a";
      c.globalAlpha = 1 - k;
      c.fillRect(f.x + (f.dx ?? 0) * f.t, f.y * K - 30 + (f.dy ?? 0) * f.t, 3, 3);
      c.globalAlpha = 1;
    } else if (f.k === "ring") {
      c.strokeStyle = f.color ?? "#fff";
      c.globalAlpha = 0.9 * (1 - k);
      c.lineWidth = 4;
      ell(f.x, f.y, (f.v ?? 80) * (0.25 + 0.75 * k), (f.v ?? 80) * (0.25 + 0.75 * k));
      c.stroke();
      c.globalAlpha = 1;
    } else if (f.k === "num") {
      c.font = `bold 15px ${FONT}`;
      c.textAlign = "center";
      c.globalAlpha = 1 - k * k;
      c.fillStyle = "#000";
      c.fillText(String(f.v), f.x + 1, f.y * K - 14 * k * 3 + 1);
      c.fillStyle = f.color ?? "#fff";
      c.fillText(String(f.v), f.x, f.y * K - 14 * k * 3);
      c.globalAlpha = 1;
    }
  }

  /* Parachutists are above everything */
  for (const a of g.actors) {
    if (!a.alive || a.z <= 0) continue;
    const lift = a.z * 260;
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(a.x, a.y * K, 14, 5, 0, 0, TAU);
    c.fill();
    drawFighter(c, g, a, -lift, false, true);
    const def = CHARS.find((x) => x.id === a.ch) ?? CHARS[0];
    const cy = a.y * K - lift - 96;
    c.fillStyle = def.color;
    c.beginPath();
    c.arc(a.x, cy, 34, Math.PI, 0);
    c.quadraticCurveTo(a.x, cy + 10, a.x - 34, cy);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(a.x - 34, cy);
    c.lineTo(a.x, a.y * K - lift - 46);
    c.moveTo(a.x + 34, cy);
    c.lineTo(a.x, a.y * K - lift - 46);
    c.stroke();
  }

  /* ---------- HUD (screen space) ---------- */
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHud(c, g, w, h);
}

/* ---------- Scenery ---------- */

function drawTree(c: Ctx, x: number, y: number, seed: number) {
  const sy = y * K;
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(x + 4, sy + 1, 15, 6, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#6b4a2b";
  c.fillRect(x - 3, sy - 26, 6, 26);
  const g = 0.85 + (Math.abs(Math.sin(seed)) % 1) * 0.3;
  c.fillStyle = shade("#2f7d3a", g);
  c.beginPath();
  c.arc(x, sy - 38, 19, 0, TAU);
  c.fill();
  c.fillStyle = shade("#3f9a4a", g);
  c.beginPath();
  c.arc(x - 5, sy - 43, 11, 0, TAU);
  c.fill();
}
function drawRock(c: Ctx, x: number, y: number, r: number) {
  const sy = y * K;
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(x + 3, sy + 2, r + 4, (r + 4) * K, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#7d8088";
  c.beginPath();
  c.moveTo(x - r, sy);
  c.lineTo(x - r * 0.7, sy - r * 1.1);
  c.lineTo(x + r * 0.1, sy - r * 1.45);
  c.lineTo(x + r * 0.85, sy - r * 0.9);
  c.lineTo(x + r, sy);
  c.closePath();
  c.fill();
  c.fillStyle = "#9da0a8";
  c.beginPath();
  c.moveTo(x - r * 0.7, sy - r * 1.1);
  c.lineTo(x + r * 0.1, sy - r * 1.45);
  c.lineTo(x + r * 0.2, sy - r * 0.6);
  c.closePath();
  c.fill();
}
function drawWall(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  const H = WALL_H;
  const yb = (y + h) * K;
  c.fillStyle = shade(col, 0.74);
  c.fillRect(x, yb - H, w, H);
  c.fillStyle = shade(col, 1.08);
  c.fillRect(x, y * K - H, w, h * K);
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y * K - H + 0.5, w - 1, h * K + H - 1);
}
function drawRoof(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  const H = WALL_H;
  const top = y * K - H - 12;
  const bot = (y + h) * K - H + 6;
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.fillRect(x - 3, bot, w + 6, 10);
  c.fillStyle = shade(col, 1);
  c.fillRect(x - 6, top, w + 12, bot - top);
  c.fillStyle = shade(col, 1.2);
  c.fillRect(x - 6, top, w + 12, (bot - top) * 0.45);
  c.strokeStyle = shade(col, 0.6);
  c.lineWidth = 2;
  c.strokeRect(x - 6, top, w + 12, bot - top);
  c.fillStyle = shade(col, 0.8);
  c.fillRect(x + w / 2 - 1.5, top, 3, bot - top);
}
function drawGel(c: Ctx, x: number, y: number, w: number, h: number, hp: number) {
  const H = 30;
  const yb = (y + h) * K;
  const a = Math.max(0.35, Math.min(0.85, hp / 240));
  c.fillStyle = `rgba(90,210,255,${a})`;
  c.fillRect(x, yb - H, w, H);
  c.fillStyle = `rgba(190,240,255,${a})`;
  c.fillRect(x, y * K - H, w, h * K);
  c.strokeStyle = "rgba(255,255,255,0.8)";
  c.lineWidth = 1.5;
  c.strokeRect(x, y * K - H, w, h * K + H);
}
function drawCrate(c: Ctx, x: number, y: number, t: number, time: number) {
  const sy = y * K;
  const g = c.createLinearGradient(0, sy - 360, 0, sy);
  g.addColorStop(0, "rgba(214,139,255,0)");
  g.addColorStop(1, "rgba(214,139,255,0.5)");
  c.fillStyle = g;
  c.fillRect(x - 6, sy - 360, 12, 360);
  c.fillStyle = "#8a5a2b";
  c.fillRect(x - 18, sy - 26, 36, 26);
  c.fillStyle = "#d68bff";
  c.fillRect(x - 18, sy - 26, 36, 6);
  c.fillRect(x - 3, sy - 26, 6, 26);
  if (t < 4) {
    const k = 1 - t / 4;
    c.fillStyle = "#e8e2d2";
    c.beginPath();
    c.arc(x, sy - 26 - k * 260 - 40, 40, Math.PI, 0);
    c.fill();
  }
  c.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5);
  c.strokeStyle = "#fff";
  c.lineWidth = 2;
  c.strokeRect(x - 22, sy - 30, 44, 34);
  c.globalAlpha = 1;
}

function drawLoot(c: Ctx, l: Loot, time: number) {
  const bob = Math.sin(time * 3 + l.x) * 2;
  const x = l.x;
  const y = l.y * K - 8 + bob;
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(l.x, l.y * K, 9, 3.5, 0, 0, TAU);
  c.fill();
  const glow = (col: string) => {
    c.fillStyle = col;
    c.globalAlpha = 0.28;
    c.beginPath();
    c.arc(x, y, 14, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  };
  c.lineCap = "round";
  switch (l.kind) {
    case "gun": {
      const gun = GUNS[l.key];
      glow(gun.color);
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x - 9, y);
      c.lineTo(x + 9, y);
      c.stroke();
      c.strokeStyle = gun.color;
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(x - 8, y);
      c.lineTo(x + 8, y);
      c.stroke();
      c.fillStyle = INK;
      c.fillRect(x - 4, y, 4, 6);
      break;
    }
    case "melee": {
      const m = MELEE[l.key];
      glow(m.color);
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x - 9, y + 5);
      c.lineTo(x + 9, y - 5);
      c.stroke();
      c.strokeStyle = m.color;
      c.lineWidth = 3;
      c.stroke();
      break;
    }
    case "ammo": {
      const col = { light: "#8bd1ff", med: "#9be36b", shell: "#ffb454", snip: "#d68bff" }[l.key as "light"];
      glow(col);
      c.fillStyle = INK;
      c.fillRect(x - 8, y - 6, 16, 12);
      c.fillStyle = col;
      for (let i = 0; i < 3; i++) c.fillRect(x - 6 + i * 5, y - 4, 3, 8);
      break;
    }
    case "kit":
    case "band":
      glow("#ff6b6b");
      c.fillStyle = "#fff";
      c.fillRect(x - 8, y - 7, 16, 14);
      c.fillStyle = "#e5484d";
      c.fillRect(x - 2, y - 5, 4, 10);
      c.fillRect(x - 5, y - 2, 10, 4);
      break;
    case "armor":
      glow("#4aa8ff");
      c.fillStyle = l.n >= 100 ? "#3b82f6" : "#7aa7d9";
      c.beginPath();
      c.moveTo(x - 8, y - 7);
      c.lineTo(x + 8, y - 7);
      c.lineTo(x + 7, y + 3);
      c.lineTo(x, y + 9);
      c.lineTo(x - 7, y + 3);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.stroke();
      break;
    case "gel":
      glow("#5ad2ff");
      c.fillStyle = "rgba(90,210,255,0.9)";
      c.fillRect(x - 7, y - 6, 14, 12);
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.strokeRect(x - 7, y - 6, 14, 12);
      break;
    case "nade":
      glow("#ffb454");
      c.fillStyle = "#3a4a2a";
      c.beginPath();
      c.arc(x, y + 1, 6.5, 0, TAU);
      c.fill();
      c.fillStyle = "#cfcfcf";
      c.fillRect(x - 2, y - 8, 4, 4);
      break;
  }
}

/* ---------- Stick fighters ---------- */

function drawDown(c: Ctx, a: Actor, since: number) {
  const def = CHARS.find((x) => x.id === a.ch) ?? CHARS[0];
  const x = a.x;
  const y = a.y * K;
  c.globalAlpha = Math.max(0.35, 1 - since / 20);
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - 16, y - 2);
  c.lineTo(x + 6, y - 2);
  c.moveTo(x + 6, y - 2);
  c.lineTo(x + 18, y + 3);
  c.moveTo(x + 6, y - 2);
  c.lineTo(x + 16, y - 8);
  c.stroke();
  c.strokeStyle = def.color;
  c.lineWidth = 4.5;
  c.beginPath();
  c.moveTo(x - 16, y - 2);
  c.lineTo(x - 2, y - 2);
  c.stroke();
  c.fillStyle = "#f4e6d0";
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x - 25, y - 3, 8, 0, TAU);
  c.fill();
  c.stroke();
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(x - 28, y - 6);
  c.lineTo(x - 23, y - 1);
  c.moveTo(x - 23, y - 6);
  c.lineTo(x - 28, y - 1);
  c.stroke();
  c.globalAlpha = 1;
}

function drawFighter(c: Ctx, g: Battle, a: Actor, yOff: number, marked: boolean, chute = false) {
  const def = CHARS.find((x) => x.id === a.ch) ?? CHARS[0];
  const you = a === g.you;
  const x = a.x;
  const y = a.y * K + yOff;
  const ghost = a.ghost > 0;
  c.save();
  c.globalAlpha = ghost ? (you ? 0.45 : 0.3) : 1;
  if (!yOff) {
    c.fillStyle = "rgba(0,0,0,0.28)";
    c.beginPath();
    c.ellipse(x, y, 13, 5, 0, 0, TAU);
    c.fill();
    if (marked) {
      c.strokeStyle = "#ff4d4d";
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(x, y, 20, 8, 0, 0, TAU);
      c.stroke();
    }
    if (you) {
      c.strokeStyle = "rgba(255,214,102,0.9)";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(x, y, 17, 6.5, 0, 0, TAU);
      c.stroke();
    }
  }
  const rolling = a.rollT > 0 && a.dashT <= 0;
  if (rolling) {
    const p = 1 - a.rollT / 0.4;
    c.translate(x, y - 20);
    c.rotate(p * TAU * (a.face || 1) * 1.2);
    c.scale(0.7, 0.7);
    c.translate(-x, -(y - 20));
  }
  const hurt = a.hurtT > 0;
  const ink = hurt ? "#ffffff" : INK;
  c.lineCap = "round";
  c.lineJoin = "round";
  const line = (pts: number[][], col: string, wd: number) => {
    c.strokeStyle = col;
    c.lineWidth = wd;
    c.beginPath();
    c.moveTo(x + pts[0][0], y + pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(x + pts[i][0], y + pts[i][1]);
    c.stroke();
  };
  const walking = Math.abs(a.dx) + Math.abs(a.dy) > 0.1 && !chute && a.dashT <= 0 && !rolling;
  const sw = walking ? Math.sin(a.step) : 0;
  // legs
  if (chute) {
    line([[0, -26], [-4, -14], [-5, -2]], ink, 4);
    line([[0, -26], [4, -14], [5, -2]], ink, 4);
  } else {
    line([[0, -26], [sw * 9, -13], [sw * 12, -1 - Math.max(0, -Math.cos(a.step)) * 4 * (walking ? 1 : 0)]], ink, 4);
    line([[0, -26], [-sw * 9, -13], [-sw * 12, -1 - Math.max(0, Math.cos(a.step)) * 4 * (walking ? 1 : 0)]], ink, 4);
  }
  // body
  line([[0, -26], [0, -45]], hurt ? "#fff" : def.color, 5.5);
  // arms toward the aim
  const sdx = Math.cos(a.a);
  const sdy = Math.sin(a.a) * K;
  const sn = Math.hypot(sdx, sdy) || 1;
  const dirx = sdx / sn;
  const diry = sdy / sn;
  const gun = a.cur < 2 && a.guns[a.cur] ? GUNS[a.guns[a.cur]!.id] : null;
  const shoulder = [0, -42];
  if (chute) {
    line([shoulder, [-10, -52]], ink, 3.5);
    line([shoulder, [10, -52]], ink, 3.5);
  } else if (gun) {
    const hx = dirx * 14;
    const hy = shoulder[1] + diry * 14;
    line([shoulder, [hx, hy]], ink, 3.5);
    line([shoulder, [dirx * 7, shoulder[1] + diry * 7 + 3]], ink, 3.5);
    const len = gun.id === "sniper" ? 30 : gun.id === "pistol" ? 12 : 22;
    line([[hx - dirx * 5, hy - diry * 5], [hx + dirx * len, hy + diry * len]], INK, 6.5);
    line([[hx - dirx * 5, hy - diry * 5], [hx + dirx * len, hy + diry * len]], gun.color, 3.5);
    if (a.flash > 0) {
      c.fillStyle = "#fff3a8";
      c.beginPath();
      c.arc(x + hx + dirx * (len + 6), y + hy + diry * (len + 6), 7, 0, TAU);
      c.fill();
    }
  } else {
    const m = MELEE[a.melee];
    const k = a.swing > 0 ? a.swing / 0.22 : 0;
    const ang = a.a + (a.swing > 0 ? (k - 0.5) * 2.4 * a.swingDir : 0.5);
    const mx = Math.cos(ang);
    const my = Math.sin(ang) * K;
    const mn = Math.hypot(mx, my) || 1;
    const hx = (mx / mn) * 14;
    const hy = shoulder[1] + (my / mn) * 14;
    line([shoulder, [hx, hy]], ink, 3.5);
    line([shoulder, [-dirx * 6, -30]], ink, 3.5);
    if (a.melee !== "fists") {
      line([[hx, hy], [hx + (mx / mn) * 22, hy + (my / mn) * 22]], INK, 6);
      line([[hx, hy], [hx + (mx / mn) * 22, hy + (my / mn) * 22]], m.color, 3.5);
    } else {
      c.fillStyle = "#f4e6d0";
      c.beginPath();
      c.arc(x + hx, y + hy, 4.5, 0, TAU);
      c.fill();
    }
    if (a.swing > 0) {
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y - 36, 30, a.a - 1.2, a.a + 1.2);
      c.stroke();
    }
  }
  // head
  c.fillStyle = hurt ? "#fff" : "#f4e6d0";
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(x, y - 55, 9, 0, TAU);
  c.fill();
  c.stroke();
  c.strokeStyle = def.color;
  c.lineWidth = 3.5;
  c.beginPath();
  c.arc(x, y - 55, 9.5, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(x + a.face * 3.5, y - 55, 1.6, 0, TAU);
  c.fill();
  c.restore();

  // status effects
  c.save();
  if (a.shield > 0) {
    c.strokeStyle = "rgba(244,168,37,0.9)";
    c.fillStyle = "rgba(244,168,37,0.16)";
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(x, y - 30, 26, 38, 0, 0, TAU);
    c.fill();
    c.stroke();
  }
  if (a.stun > 0) {
    c.fillStyle = "#ffd166";
    for (let i = 0; i < 3; i++) {
      const t = g.time * 6 + (i * TAU) / 3;
      c.fillRect(x + Math.cos(t) * 12 - 2, y - 72 + Math.sin(t) * 3 - 2, 4, 4);
    }
  }
  if (a.healT > 0 || (a.ch === "mia" && a.skillT > 0)) {
    c.fillStyle = "#6be39b";
    const up = (g.time * 24) % 18;
    c.fillRect(x - 2, y - 74 - up, 4, 12);
    c.fillRect(x - 6, y - 70 - up, 12, 4);
  }
  if (a.reloadT > 0) {
    const g2 = a.cur < 2 && a.guns[a.cur] ? GUNS[a.guns[a.cur]!.id] : null;
    const total = (g2?.reload ?? 1) * (a.ch === "nia" ? 0.75 : 1);
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y - 82, 7, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - a.reloadT / total));
    c.stroke();
  }
  if (!you && !chute) {
    c.font = `600 10px ${FONT}`;
    c.textAlign = "center";
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillText(a.name, x + 1, y - 80);
    c.fillStyle = "#fff";
    c.fillText(a.name, x, y - 81);
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.fillRect(x - 15, y - 77, 30, 4);
    c.fillStyle = a.hp > 50 ? "#6be39b" : a.hp > 25 ? "#ffd166" : "#ff6b6b";
    c.fillRect(x - 15, y - 77, 30 * (a.hp / 100), 4);
    if (a.armor > 0) {
      c.fillStyle = "#4aa8ff";
      c.fillRect(x - 15, y - 73, 30 * Math.min(1, a.armor / 100), 2);
    }
  }
  c.restore();
}

/* ---------- HUD ---------- */

function pill(c: Ctx, text: string, x: number, y: number, bg = "rgba(0,0,0,0.55)", fg = "#fff", size = 13) {
  c.font = `700 ${size}px ${FONT}`;
  c.textAlign = "center";
  const tw = c.measureText(text).width + 22;
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(x - tw / 2, y - size - 3, tw, size + 12, 12);
  c.fill();
  c.fillStyle = fg;
  c.fillText(text, x, y + 2);
}

function drawHud(c: Ctx, g: Battle, w: number, h: number) {
  const you = g.you;
  const small = Math.min(w, h) < 520;
  const alive = g.actors.filter((a) => a.alive).length;
  c.textBaseline = "alphabetic";

  // Health + armor, top left
  const bw = small ? 128 : 180;
  c.fillStyle = "rgba(0,0,0,0.5)";
  c.beginPath();
  c.roundRect(10, 10, bw + 16, you.armor > 0 ? 44 : 30, 10);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.15)";
  c.fillRect(18, 18, bw, 10);
  c.fillStyle = you.hp > 50 ? "#6be39b" : you.hp > 25 ? "#ffd166" : "#ff6b6b";
  c.fillRect(18, 18, bw * Math.max(0, you.hp / 100), 10);
  c.font = `700 10px ${FONT}`;
  c.textAlign = "left";
  c.fillStyle = "#fff";
  c.fillText(String(Math.ceil(you.hp)), 22, 27);
  if (you.armor > 0) {
    c.fillStyle = "rgba(255,255,255,0.15)";
    c.fillRect(18, 34, bw, 8);
    c.fillStyle = "#4aa8ff";
    c.fillRect(18, 34, bw * Math.min(1, you.armor / 100), 8);
  }

  // Alive / kills / zone, top centre
  pill(c, `ALIVE ${alive}   ·   KILLS ${you.kills}`, w / 2, 26);
  const zl = zoneLabel(g);
  pill(c, zl.text, w / 2, 52, zl.hot ? "rgba(200,40,40,0.8)" : "rgba(0,0,0,0.5)", "#fff", 11);

  // Minimap, top right
  const m = Math.round(Math.max(88, Math.min(150, Math.min(w, h) * 0.27)));
  const mx = w - m - 10;
  const my = 10;
  const s = m / 2 / (ISLE + 50);
  c.save();
  c.beginPath();
  c.roundRect(mx, my, m, m, 12);
  c.clip();
  c.fillStyle = "#0d3350";
  c.fillRect(mx, my, m, m);
  const px = (x: number) => mx + m / 2 + (x - CX) * s;
  const py = (y: number) => my + m / 2 + (y - CY) * s;
  c.fillStyle = "#4d8a3f";
  c.beginPath();
  c.arc(px(CX), py(CY), ISLE * s, 0, TAU);
  c.fill();
  c.fillStyle = "#cdbb8a";
  for (const b of g.buildings) c.fillRect(px(b.x), py(b.y), Math.max(2, b.w * s), Math.max(2, b.h * s));
  const zn = g.zone;
  c.strokeStyle = "#4fc3ff";
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(px(zn.x), py(zn.y), zn.r * s, 0, TAU);
  c.stroke();
  if (zn.stage === "wait" && zn.tr < zn.r - 2) {
    c.strokeStyle = "#fff";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(px(zn.tx), py(zn.ty), zn.tr * s, 0, TAU);
    c.stroke();
  }
  if (g.airdrop) {
    c.fillStyle = "#d68bff";
    c.beginPath();
    c.moveTo(px(g.airdrop.x), py(g.airdrop.y) - 5);
    c.lineTo(px(g.airdrop.x) + 4, py(g.airdrop.y));
    c.lineTo(px(g.airdrop.x), py(g.airdrop.y) + 5);
    c.lineTo(px(g.airdrop.x) - 4, py(g.airdrop.y));
    c.fill();
  }
  if (you.radar > 0) {
    c.fillStyle = "#ff4d4d";
    for (const a of g.actors) if (a !== you && a.alive && Math.hypot(a.x - you.x, a.y - you.y) < 900) {
      c.beginPath();
      c.arc(px(a.x), py(a.y), 2.6, 0, TAU);
      c.fill();
    }
  }
  c.fillStyle = "#ffd166";
  c.save();
  c.translate(px(you.x), py(you.y));
  c.rotate(you.a);
  c.beginPath();
  c.moveTo(6, 0);
  c.lineTo(-4, -4);
  c.lineTo(-4, 4);
  c.fill();
  c.restore();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(mx, my, m, m, 12);
  c.stroke();

  // Kill feed under the minimap
  c.font = `600 11px ${FONT}`;
  c.textAlign = "right";
  g.feed.forEach((f, i) => {
    c.globalAlpha = Math.min(1, f.t);
    c.fillStyle = "rgba(0,0,0,0.5)";
    const tw = c.measureText(f.text).width + 12;
    c.fillRect(w - 10 - tw, my + m + 6 + i * 19, tw, 17);
    c.fillStyle = f.text.includes(you.name + " ›") ? "#ffd166" : "#fff";
    c.fillText(f.text, w - 16, my + m + 19 + i * 19);
    c.globalAlpha = 1;
  });

  // Banner
  if (g.banner) {
    c.globalAlpha = Math.min(1, g.banner.t);
    pill(c, g.banner.text, w / 2, 94, "rgba(0,0,0,0.65)", g.banner.color, small ? 13 : 16);
    c.globalAlpha = 1;
  }

  // Outside the zone
  if (you.alive && you.z === 0 && Math.hypot(you.x - zn.x, you.y - zn.y) > zn.r) {
    const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    gr.addColorStop(0, "rgba(255,0,0,0)");
    gr.addColorStop(1, "rgba(255,0,0,0.35)");
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    pill(c, "OUTSIDE THE ZONE: run to the circle!", w / 2, 124, "rgba(200,40,40,0.85)", "#fff", 12);
  }

  // Parachute help
  if (you.alive && you.z > 0) pill(c, "PARACHUTING: steer to a building. Space / dive button lands faster", w / 2, h - 28, "rgba(0,0,0,0.6)", "#fff", 12);

  // Weapon slots, bottom centre
  if (you.alive && you.z === 0) {
    const sw = small ? 104 : 132;
    const sy = h - (small ? 62 : 70);
    const x0 = w / 2 - sw - 6;
    const slots = [
      { id: you.guns[0]?.id ?? "", mag: you.guns[0]?.mag ?? 0, i: 0 },
      { id: you.guns[1]?.id ?? "", mag: you.guns[1]?.mag ?? 0, i: 1 },
    ];
    slots.forEach((sl, k) => {
      const sx = x0 + k * (sw + 8);
      const on = you.cur === sl.i;
      c.fillStyle = on ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.5)";
      c.beginPath();
      c.roundRect(sx, sy, sw, 40, 10);
      c.fill();
      if (on) {
        c.strokeStyle = "#ffd166";
        c.lineWidth = 2;
        c.stroke();
      }
      c.textAlign = "left";
      if (sl.id) {
        const gn = GUNS[sl.id];
        c.fillStyle = gn.color;
        c.font = `700 11px ${FONT}`;
        c.fillText(gn.name, sx + 8, sy + 16);
        c.fillStyle = "#fff";
        c.font = `700 14px ${FONT}`;
        c.fillText(`${sl.mag}`, sx + 8, sy + 33);
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.font = `600 11px ${FONT}`;
        c.fillText(`/ ${you.ammo[gn.ammo]} ${AMMO_LABEL[gn.ammo]}`, sx + 8 + c.measureText(`${sl.mag}`).width + 6, sy + 33);
      } else {
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.font = `600 11px ${FONT}`;
        c.fillText("empty slot", sx + 8, sy + 24);
      }
    });
    c.textAlign = "center";
    c.font = `600 11px ${FONT}`;
    c.fillStyle = "rgba(255,255,255,0.85)";
    const mel = MELEE[you.melee];
    c.fillText(`${mel.name}   ·   Kit ${you.kits}   Bandage ${you.bands}   Gel ${you.gels}   Grenade ${you.nades}`, w / 2, sy + 56);
    const ng = g.nearGun(you);
    if (ng) {
      const nm = ng.kind === "gun" ? GUNS[ng.key].name : MELEE[ng.key].name;
      pill(c, `E / PICK: take ${nm}`, w / 2, sy - 12, "rgba(255,209,102,0.92)", "#1d1d24", 12);
    }
  }
  if (!you.alive) pill(c, `Spectating ${g.actors.find((a) => a.alive && a.name === you.killer)?.name ?? "the match"}`, w / 2, h - 28);

  // Hit and kill markers
  if (g.hit > 0 || g.kill > 0) {
    c.strokeStyle = g.kill > 0 ? "#ff4d4d" : "#fff";
    c.lineWidth = 2.5;
    const cx = w / 2;
    const cy = h / 2 - 20;
    c.globalAlpha = Math.min(1, Math.max(g.hit * 6, g.kill));
    c.beginPath();
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      c.moveTo(cx + dx * 6, cy + dy * 6);
      c.lineTo(cx + dx * 13, cy + dy * 13);
    }
    c.stroke();
    c.globalAlpha = 1;
  }
}
