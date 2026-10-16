/* Stickville renderer: parallax sky, terrain, town, vehicles, stick figures and the HUD,
   all drawn on one 2D canvas each frame. */

import { BUILDINGS, VEHICLES, type BuildingKind, type Hero } from "./data";
import { MAX_HP, type Game, type Point, type Vehicle } from "./engine";
import { drawSprite, packSprite, sprite, type Sprite } from "./art";
import { propBounds, type Prop } from "./creator";
import {
  DEPOT_X,
  HILLS_END,
  OUTPOST_X,
  PLOT_COUNT,
  PLOT_W,
  RACE_END,
  RACE_START,
  TOWN_END,
  WATCHTOWER_X,
  WORLD_W,
  plotLeft,
  type Ramp,
} from "./world";

type Ctx = CanvasRenderingContext2D;
const INK = "#1d1d24";
const TAU = Math.PI * 2;

/** How many world pixels fit across the screen. */
export const viewWidth = (cssW: number) => (cssW < 700 ? 900 : 1280);

/* ---------- Colour helpers ---------- */

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/* ---------- Stick figures ---------- */

export type Pose = "stand" | "walk" | "air" | "seat" | "down" | "wave";

export function drawHero(c: Ctx, hero: Hero, x: number, y: number, facing: number, phase: number, pose: Pose, scale = 1, hurt = false) {
  c.save();
  c.translate(x, y);
  c.scale(facing * scale, scale);
  if (pose === "down") {
    c.rotate(-Math.PI / 2);
    c.translate(-6, 30);
  }
  c.lineCap = "round";
  c.lineJoin = "round";
  const line = (pts: number[][], color: string, w: number) => {
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
    c.stroke();
  };
  const hip = [0, -30];
  const sh = [0, -50];
  const swing = pose === "walk" ? Math.sin(phase) * 0.7 : 0;
  const limb = (from: number[], a1: number, a2: number, l1: number, l2: number) => {
    const k = [from[0] + Math.sin(a1) * l1, from[1] + Math.cos(a1) * l1];
    const e = [k[0] + Math.sin(a2) * l2, k[1] + Math.cos(a2) * l2];
    return [from, k, e];
  };

  let legA: number[][], legB: number[][], armA: number[][], armB: number[][];
  if (pose === "seat") {
    legA = [hip, [15, -30], [17, -14]];
    legB = [hip, [13, -28], [14, -12]];
    armA = [sh, [12, -44], [24, -44]];
    armB = [sh, [10, -42], [22, -42]];
  } else if (pose === "air") {
    legA = limb(hip, 0.6, -0.3, 15, 15);
    legB = limb(hip, -0.2, -0.7, 15, 15);
    armA = limb(sh, 2.4, 2.8, 12, 11);
    armB = limb(sh, -2.3, -2.7, 12, 11);
  } else if (pose === "wave") {
    const w = Math.sin(phase * 3) * 0.4;
    legA = limb(hip, 0.15, 0.1, 15, 15);
    legB = limb(hip, -0.15, -0.1, 15, 15);
    armA = limb(sh, 2.6 + w, 3.0 + w, 12, 11);
    armB = limb(sh, -0.3, -0.2, 12, 11);
  } else {
    legA = limb(hip, swing, swing - Math.max(0, swing) * 0.9, 15, 15);
    legB = limb(hip, -swing, -swing - Math.max(0, -swing) * 0.9, 15, 15);
    armA = limb(sh, -swing * 0.8, -swing * 0.8 + 0.5, 12, 11);
    armB = limb(sh, swing * 0.8, swing * 0.8 + 0.5, 12, 11);
  }

  // Back limbs first, slightly darker
  line(armB, INK, 3.5);
  const legColor = hero.bottom === "pants" ? hero.bottomColor : INK;
  line(legB, hero.bottom === "pants" ? mix(hero.bottomColor, "#000000", 0.25) : INK, hero.bottom === "pants" ? 5 : 3.5);
  if (hero.bottom === "shorts") line([legB[0], [(legB[0][0] + legB[1][0]) / 2, (legB[0][1] + legB[1][1]) / 2]], mix(hero.bottomColor, "#000000", 0.25), 6);
  line(legA, legColor, hero.bottom === "pants" ? 5 : 3.5);
  if (hero.bottom === "shorts") line([legA[0], [(legA[0][0] + legA[1][0]) / 2, (legA[0][1] + legA[1][1]) / 2]], hero.bottomColor, 6);
  // Shoes
  c.fillStyle = INK;
  for (const leg of [legA, legB]) {
    const f = leg[2];
    c.beginPath();
    c.ellipse(f[0] + 2, f[1], 4.5, 2.6, 0, 0, TAU);
    c.fill();
  }
  // Torso (shirt)
  line([[0, -52], [0, -31]], hurt ? "#ff5a4e" : hero.top, 10);
  if (hero.bottom === "skirt") {
    c.fillStyle = hero.bottomColor;
    c.beginPath();
    c.moveTo(-5, -34);
    c.lineTo(5, -34);
    c.lineTo(12, -17);
    c.lineTo(-12, -17);
    c.closePath();
    c.fill();
  }
  line(armA, INK, 3.5);
  c.fillStyle = hero.skin;
  c.beginPath();
  c.arc(armA[2][0], armA[2][1], 2.6, 0, TAU);
  c.fill();

  // Head
  const hx = 0;
  const hy = -64;
  drawHairBack(c, hero, hx, hy, phase);
  c.fillStyle = hero.skin;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(hx, hy, 10, 0, TAU);
  c.fill();
  c.stroke();
  drawHairFront(c, hero, hx, hy);
  // Face
  c.fillStyle = INK;
  c.beginPath();
  c.arc(hx + 5, hy - 1, 1.6, 0, TAU);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(hx + 4, hy + 3, 3, 0.2, 1.4);
  c.stroke();
  drawHeadwear(c, hero, hx, hy);
  c.restore();
}

function drawHairBack(c: Ctx, h: Hero, x: number, y: number, phase: number) {
  c.fillStyle = h.hairColor;
  c.strokeStyle = h.hairColor;
  c.lineCap = "round";
  switch (h.hair) {
    case "long":
      c.beginPath();
      c.moveTo(-10, y - 3);
      c.quadraticCurveTo(-14, y + 12, -9, y + 22);
      c.lineTo(-2, y + 18);
      c.lineTo(-1, y);
      c.fill();
      break;
    case "ponytail": {
      const sw = Math.sin(phase) * 3;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(-8, y - 6);
      c.quadraticCurveTo(-20, y - 4 + sw, -18 + sw, y + 12);
      c.stroke();
      break;
    }
    case "bun":
      c.beginPath();
      c.arc(-7, y - 10, 5.5, 0, TAU);
      c.fill();
      break;
    case "braids":
      c.lineWidth = 4;
      for (const dx of [-8, -4]) {
        c.beginPath();
        c.moveTo(dx, y);
        c.lineTo(dx - 2, y + 20);
        c.stroke();
        c.beginPath();
        c.arc(dx - 2, y + 21, 2.5, 0, TAU);
        c.fill();
      }
      break;
  }
}

function drawHairFront(c: Ctx, h: Hero, x: number, y: number) {
  c.fillStyle = h.hairColor;
  if (h.hair === "none") return;
  if (h.hair === "curly") {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.0 + i / 6);
      c.beginPath();
      c.arc(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 5, 0, TAU);
      c.fill();
    }
    return;
  }
  // A cap of hair over the top of the head
  c.beginPath();
  c.arc(x, y, 10.8, Math.PI * 0.95, Math.PI * 2.05);
  c.quadraticCurveTo(x + 4, y - 4, x - 6, y - 3);
  c.closePath();
  c.fill();
  if (h.hair === "spiky") {
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const bx = x - 9 + i * 5.5;
      c.moveTo(bx, y - 7);
      c.lineTo(bx + 1.5, y - 17 + (i % 2) * 2);
      c.lineTo(bx + 5, y - 8);
    }
    c.fill();
  }
}

function drawHeadwear(c: Ctx, h: Hero, x: number, y: number) {
  switch (h.headwear) {
    case "cap":
      c.fillStyle = h.top;
      c.beginPath();
      c.arc(x, y - 2, 11, Math.PI, TAU);
      c.fill();
      c.fillRect(x + 4, y - 5, 12, 3);
      break;
    case "beret":
      c.fillStyle = "#b8323a";
      c.beginPath();
      c.ellipse(x - 1, y - 9, 12, 5, -0.15, 0, TAU);
      c.fill();
      break;
    case "helmet":
      c.fillStyle = "#5b6b3a";
      c.beginPath();
      c.arc(x, y - 1, 12.5, Math.PI * 1.02, Math.PI * 1.98);
      c.closePath();
      c.fill();
      c.fillRect(x - 13, y - 3, 26, 3);
      break;
    case "headband":
      c.fillStyle = h.top;
      c.fillRect(x - 10.5, y - 6, 21, 3.5);
      c.beginPath();
      c.moveTo(x - 10, y - 5);
      c.lineTo(x - 17, y - 1);
      c.lineTo(x - 15, y + 2);
      c.fill();
      break;
    case "bow":
      c.fillStyle = "#ff6b8a";
      c.beginPath();
      c.moveTo(x - 3, y - 10);
      c.lineTo(x - 11, y - 16);
      c.lineTo(x - 11, y - 5);
      c.closePath();
      c.moveTo(x - 3, y - 10);
      c.lineTo(x + 5, y - 16);
      c.lineTo(x + 5, y - 5);
      c.closePath();
      c.fill();
      break;
  }
}

/* ---------- Vehicles ---------- */

function wheel(c: Ctx, x: number, y: number, r: number, spin: number) {
  c.fillStyle = INK;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = "#8e8b84";
  c.beginPath();
  c.arc(x, y, r * 0.45, 0, TAU);
  c.fill();
  c.strokeStyle = "#5d5b56";
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * TAU) / 3;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
  }
  c.stroke();
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

export function drawVehicle(c: Ctx, v: Vehicle, rider: Hero | null, carrying: boolean) {
  const color = VEHICLES[v.kind].color;
  c.save();
  c.translate(v.x, v.y);
  c.rotate(v.angle);
  c.scale(v.dir, 1);
  if (v.crashT > 0) c.rotate(Math.sin(v.crashT * 20) * 0.15);
  c.lineCap = "round";
  c.lineJoin = "round";
  const art = sprite("vehicles", v.kind);
  if (art) {
    drawVehicleArt(c, v, art, rider, carrying);
    c.restore();
    return;
  }
  switch (v.kind) {
    case "bike": {
      wheel(c, -26, -13, 13, v.wheel);
      wheel(c, 26, -13, 13, v.wheel);
      c.strokeStyle = "#2a2a30";
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(-26, -13);
      c.lineTo(-4, -32);
      c.lineTo(18, -40);
      c.lineTo(26, -13);
      c.moveTo(-26, -13);
      c.lineTo(2, -18);
      c.lineTo(18, -40);
      c.stroke();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-14, -34);
      c.quadraticCurveTo(4, -46, 16, -38);
      c.lineTo(4, -28);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(16, -40);
      c.lineTo(22, -48);
      c.stroke();
      if (rider) drawHero(c, rider, -6, -4, 1, 0, "seat");
      break;
    }
    case "car": {
      if (rider) drawHero(c, rider, -8, -12, 1, 0, "seat", 0.85);
      c.fillStyle = color;
      roundRect(c, -56, -46, 112, 32, 9);
      c.fill();
      c.fillStyle = mix(color, "#000000", 0.2);
      c.beginPath();
      c.moveTo(-40, -46);
      c.lineTo(-30, -78);
      c.lineTo(18, -78);
      c.lineTo(36, -46);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(170,220,255,0.55)";
      c.beginPath();
      c.moveTo(-33, -49);
      c.lineTo(-26, -73);
      c.lineTo(-5, -73);
      c.lineTo(-5, -49);
      c.closePath();
      c.moveTo(0, -49);
      c.lineTo(0, -73);
      c.lineTo(15, -73);
      c.lineTo(29, -49);
      c.closePath();
      c.fill();
      c.fillStyle = "#ffe08a";
      c.fillRect(50, -40, 6, 7);
      c.fillStyle = "#ff5a4e";
      c.fillRect(-56, -40, 5, 7);
      wheel(c, -34, -14, 14, v.wheel);
      wheel(c, 34, -14, 14, v.wheel);
      break;
    }
    case "jeep": {
      if (carrying) {
        c.fillStyle = "#a07a3a";
        c.fillRect(-56, -72, 30, 26);
        c.strokeStyle = "#5a4320";
        c.lineWidth = 2;
        c.strokeRect(-56, -72, 30, 26);
        c.beginPath();
        c.moveTo(-56, -72);
        c.lineTo(-26, -46);
        c.stroke();
      }
      if (rider) drawHero(c, rider, 2, -16, 1, 0, "seat");
      c.fillStyle = color;
      roundRect(c, -60, -50, 120, 34, 4);
      c.fill();
      c.fillStyle = mix(color, "#000000", 0.25);
      c.fillRect(-60, -24, 120, 8);
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(30, -50);
      c.lineTo(38, -76);
      c.stroke();
      // White star on the door
      c.fillStyle = "#edeae3";
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 3.5 : 8;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        c.lineTo(-8 + Math.cos(a) * r, -34 + Math.sin(a) * r);
      }
      c.fill();
      wheel(c, -66, -36, 11, 0);
      wheel(c, -38, -16, 16, v.wheel);
      wheel(c, 38, -16, 16, v.wheel);
      break;
    }
    case "heli": {
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-42, -2);
      c.lineTo(42, -2);
      c.moveTo(-26, -2);
      c.lineTo(-22, -18);
      c.moveTo(24, -2);
      c.lineTo(20, -18);
      c.stroke();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-30, -44);
      c.lineTo(-104, -50);
      c.lineTo(-104, -40);
      c.lineTo(-30, -32);
      c.fill();
      c.fillStyle = mix(color, "#000000", 0.2);
      c.fillRect(-110, -64, 8, 26);
      if (rider) drawHero(c, rider, 6, -16, 1, 0, "seat", 0.8);
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, -38, 46, 22, 0, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(170,220,255,0.6)";
      c.beginPath();
      c.ellipse(16, -42, 24, 15, 0, Math.PI * 1.15, Math.PI * 2.25);
      c.fill();
      c.fillStyle = INK;
      c.fillRect(-3, -66, 6, 8);
      const spin = Math.cos(v.wheel);
      c.strokeStyle = "rgba(29,29,36,0.85)";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-92 * spin, -66);
      c.lineTo(92 * spin, -66);
      c.stroke();
      c.beginPath();
      c.moveTo(-106, -52 + 12 * Math.sin(v.wheel * 1.3));
      c.lineTo(-106, -52 - 12 * Math.sin(v.wheel * 1.3));
      c.stroke();
      break;
    }
  }
  c.restore();
}

/** The Blender-rendered body, with the moving parts (wheels, rotors) and the rider drawn here. */
function drawVehicleArt(c: Ctx, v: Vehicle, art: Sprite, rider: Hero | null, carrying: boolean) {
  switch (v.kind) {
    case "bike":
      wheel(c, -26, -13, 13, v.wheel);
      wheel(c, 26, -13, 13, v.wheel);
      drawSprite(c, art, 0, 0);
      if (rider) drawHero(c, rider, -6, -4, 1, 0, "seat");
      break;
    case "car":
      if (rider) drawHero(c, rider, -8, -12, 1, 0, "seat", 0.85);
      drawSprite(c, art, 0, 0);
      wheel(c, -34, -14, 14, v.wheel);
      wheel(c, 34, -14, 14, v.wheel);
      break;
    case "jeep":
      if (carrying) {
        const crate = sprite("props", "crate");
        if (crate) drawSprite(c, crate, -42, -46, 0.7);
      }
      if (rider) drawHero(c, rider, 2, -16, 1, 0, "seat");
      drawSprite(c, art, 0, 0);
      wheel(c, -66, -36, 11, 0);
      wheel(c, -38, -16, 16, v.wheel);
      wheel(c, 38, -16, 16, v.wheel);
      break;
    case "heli": {
      if (rider) drawHero(c, rider, 6, -16, 1, 0, "seat", 0.8);
      drawSprite(c, art, 0, 0);
      const spin = Math.cos(v.wheel);
      c.strokeStyle = "rgba(29,29,36,0.85)";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-92 * spin, -68);
      c.lineTo(92 * spin, -68);
      c.stroke();
      c.beginPath();
      c.moveTo(-106, -50 + 12 * Math.sin(v.wheel * 1.3));
      c.lineTo(-106, -50 - 12 * Math.sin(v.wheel * 1.3));
      c.stroke();
      break;
    }
  }
}

/* ---------- Buildings ---------- */

/** Night-time window glows from the Blender night pass, drawn after the world darkens. */
const nightQueue: [Sprite, number, number][] = [];

function cloth(c: Ctx, x: number, top: number, color: string, time: number, w = 34, h = 20) {
  const wv = Math.sin(time * 4 + x) * 4;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, top);
  c.quadraticCurveTo(x + w / 2, top + 4 + wv, x + w, top + 6);
  c.lineTo(x + w, top + 6 + h);
  c.quadraticCurveTo(x + w / 2, top + h + 2 + wv, x, top + h);
  c.fill();
}

function gear(c: Ctx, x: number, y: number, time: number) {
  c.save();
  c.translate(x, y);
  c.rotate(time);
  c.fillStyle = "#ffb224";
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 8 : 12;
    const a = (i * TAU) / 16;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.fill();
  c.fillStyle = "#5a4320";
  c.beginPath();
  c.arc(0, 0, 4, 0, TAU);
  c.fill();
  c.restore();
}

function windows(c: Ctx, lights: number[][], x: number, y: number, w: number, h: number) {
  c.fillStyle = "#9fd3ff";
  c.fillRect(x, y, w, h);
  c.strokeStyle = "rgba(255,255,255,0.7)";
  c.lineWidth = 1.5;
  c.strokeRect(x, y, w, h);
  lights.push([x, y, w, h]);
}

function drawBuilding(c: Ctx, kind: BuildingKind, x0: number, progress: number, lights: number[][], time: number) {
  const W = PLOT_W;
  const col = BUILDINGS[kind].color;
  const H = { house: 130, school: 170, garage: 110, barracks: 105, workshop: 115, solar: 70, park: 120, hospital: 190, helipad: 60 }[kind];
  c.save();
  if (progress < 1) {
    c.beginPath();
    c.rect(x0 - 20, -H * progress - 40, W + 40, H * progress + 40);
    c.clip();
  }
  const cx = x0 + W / 2;
  const art = sprite("buildings", kind);
  if (art) {
    drawSprite(c, art, cx, 0);
    const lit = sprite("buildings", kind, true);
    if (lit && progress >= 1) nightQueue.push([lit, cx, 0]);
    if (kind === "barracks") cloth(c, cx + 104, -150, "#ffb224", time);
    if (kind === "workshop") gear(c, cx + 34, -150, time);
    if (kind === "helipad") cloth(c, cx + 104, -82, "#ff8a3a", time * 1.5, 22, 8);
    if (kind === "school") {
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(cx + 14, -177);
      c.lineTo(cx + 14 + Math.cos(time) * 9, -177 + Math.sin(time) * 9);
      c.moveTo(cx + 14, -177);
      c.lineTo(cx + 14, -184);
      c.stroke();
    }
  } else switch (kind) {
    case "house": {
      c.fillStyle = col;
      c.fillRect(x0 + 30, -110, 160, 110);
      c.fillStyle = "#8a3a2a";
      c.beginPath();
      c.moveTo(x0 + 18, -108);
      c.lineTo(cx, -170);
      c.lineTo(x0 + 202, -108);
      c.fill();
      c.fillStyle = "#5a3a2a";
      c.fillRect(cx - 14, -52, 28, 52);
      windows(c, lights, x0 + 46, -88, 34, 28);
      windows(c, lights, x0 + 140, -88, 34, 28);
      c.fillStyle = "#6a6a6a";
      c.fillRect(x0 + 150, -160, 16, 30);
      break;
    }
    case "school": {
      c.fillStyle = col;
      c.fillRect(x0 + 10, -140, 200, 140);
      c.fillStyle = mix(col, "#000000", 0.3);
      c.fillRect(x0 + 4, -146, 212, 10);
      c.fillStyle = col;
      c.fillRect(cx - 22, -190, 44, 50);
      c.fillStyle = "#edeae3";
      c.beginPath();
      c.arc(cx, -168, 12, 0, TAU);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, -168);
      c.lineTo(cx + Math.cos(time) * 9, -168 + Math.sin(time) * 9);
      c.moveTo(cx, -168);
      c.lineTo(cx, -175);
      c.stroke();
      c.fillStyle = "#edeae3";
      c.font = "700 15px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("SCHOOL", cx, -118);
      for (let i = 0; i < 4; i++) windows(c, lights, x0 + 24 + i * 48, -96, 30, 30);
      c.fillStyle = "#5a3a2a";
      c.fillRect(cx - 16, -46, 32, 46);
      break;
    }
    case "garage": {
      c.fillStyle = col;
      c.fillRect(x0 + 20, -110, 180, 110);
      c.fillStyle = mix(col, "#000000", 0.35);
      c.fillRect(x0 + 10, -118, 200, 12);
      c.fillStyle = "#c9c9c9";
      c.fillRect(x0 + 40, -80, 140, 80);
      c.strokeStyle = "#8e8b84";
      c.lineWidth = 2;
      for (let y = -72; y < 0; y += 10) {
        c.beginPath();
        c.moveTo(x0 + 40, y);
        c.lineTo(x0 + 180, y);
        c.stroke();
      }
      c.fillStyle = "#edeae3";
      c.font = "700 13px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("GARAGE", cx, -90);
      break;
    }
    case "barracks": {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x0 + 10, 0);
      c.lineTo(x0 + 10, -60);
      c.quadraticCurveTo(cx, -130, x0 + 210, -60);
      c.lineTo(x0 + 210, 0);
      c.fill();
      c.strokeStyle = mix(col, "#000000", 0.3);
      c.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        c.beginPath();
        c.moveTo(x0 + 10 + i * 33, 0);
        c.lineTo(x0 + 10 + i * 33, -70 - Math.sin((i / 6) * Math.PI) * 25);
        c.stroke();
      }
      c.fillStyle = "#3a3f24";
      c.fillRect(cx - 18, -48, 36, 48);
      windows(c, lights, x0 + 34, -50, 26, 18);
      windows(c, lights, x0 + 160, -50, 26, 18);
      // Flagpole
      c.strokeStyle = "#8e8b84";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x0 + 214, 0);
      c.lineTo(x0 + 214, -150);
      c.stroke();
      const wv = Math.sin(time * 4) * 4;
      c.fillStyle = "#ffb224";
      c.beginPath();
      c.moveTo(x0 + 214, -150);
      c.quadraticCurveTo(x0 + 230, -146 + wv, x0 + 248, -142);
      c.lineTo(x0 + 248, -122);
      c.quadraticCurveTo(x0 + 230, -126 + wv, x0 + 214, -128);
      c.fill();
      break;
    }
    case "workshop": {
      c.fillStyle = col;
      c.fillRect(x0 + 30, -100, 160, 100);
      c.fillStyle = "#5a4320";
      c.beginPath();
      c.moveTo(x0 + 20, -98);
      c.lineTo(x0 + 70, -130);
      c.lineTo(x0 + 200, -130);
      c.lineTo(x0 + 200, -98);
      c.fill();
      c.fillStyle = "#3a2a1a";
      c.fillRect(x0 + 50, -64, 50, 64);
      windows(c, lights, x0 + 130, -76, 40, 30);
      // Spinning gear sign
      c.save();
      c.translate(cx + 40, -114);
      c.rotate(time);
      c.fillStyle = "#ffb224";
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 8 : 12;
        const a = (i * TAU) / 16;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.fill();
      c.fillStyle = "#5a4320";
      c.beginPath();
      c.arc(0, 0, 4, 0, TAU);
      c.fill();
      c.restore();
      break;
    }
    case "solar": {
      for (let i = 0; i < 3; i++) {
        const px = x0 + 16 + i * 68;
        c.strokeStyle = "#8e8b84";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(px + 30, 0);
        c.lineTo(px + 30, -38);
        c.stroke();
        c.save();
        c.translate(px + 30, -40);
        c.rotate(-0.4);
        c.fillStyle = col;
        c.fillRect(-30, -12, 60, 24);
        c.strokeStyle = "#9fd3ff";
        c.lineWidth = 1;
        for (let k = -20; k < 30; k += 15) {
          c.beginPath();
          c.moveTo(k, -12);
          c.lineTo(k, 12);
          c.stroke();
        }
        c.restore();
      }
      break;
    }
    case "park": {
      for (const [dx, s] of [[40, 1], [150, 1.25], [100, 0.8]] as const) {
        c.fillStyle = "#6a4a2a";
        c.fillRect(x0 + dx - 5, -50 * s, 10, 50 * s);
        c.fillStyle = "#3f8a3a";
        c.beginPath();
        c.arc(x0 + dx, -70 * s, 30 * s, 0, TAU);
        c.fill();
        c.fillStyle = "#4f9a4a";
        c.beginPath();
        c.arc(x0 + dx - 10 * s, -80 * s, 18 * s, 0, TAU);
        c.fill();
      }
      c.fillStyle = "#8a5a2a";
      c.fillRect(x0 + 70, -22, 60, 6);
      c.fillRect(x0 + 74, -16, 4, 16);
      c.fillRect(x0 + 122, -16, 4, 16);
      break;
    }
    case "hospital": {
      c.fillStyle = col;
      c.fillRect(x0 + 15, -180, 190, 180);
      c.fillStyle = "#ff5a4e";
      c.fillRect(cx - 8, -170, 16, 44);
      c.fillRect(cx - 22, -156, 44, 16);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) windows(c, lights, x0 + 28 + i * 46, -110 + r * 42, 28, 26);
      c.fillStyle = "#9fd3ff";
      c.fillRect(cx - 18, -30, 36, 30);
      break;
    }
    case "helipad": {
      c.fillStyle = "#3a3a42";
      c.fillRect(x0 + 10, -14, 200, 14);
      c.fillStyle = "#ffb224";
      c.font = "700 13px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("H", cx, -3);
      c.fillStyle = "#6a6a72";
      c.fillRect(x0 + 196, -60, 12, 46);
      c.fillStyle = "#ff8a3a";
      c.beginPath();
      c.moveTo(x0 + 208, -60);
      c.lineTo(x0 + 232 + Math.sin(time * 3) * 3, -56);
      c.lineTo(x0 + 208, -50);
      c.fill();
      break;
    }
  }
  c.restore();
  if (progress < 1) {
    // Scaffolding and a crane while it goes up
    c.strokeStyle = "#ffb224";
    c.lineWidth = 2;
    const top = -H * Math.max(progress, 0.15) - 20;
    for (let x = x0 + 16; x <= x0 + W - 16; x += 47) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, top);
      c.stroke();
    }
    for (let y = -20; y > top; y -= 30) {
      c.beginPath();
      c.moveTo(x0 + 16, y);
      c.lineTo(x0 + W - 16, y);
      c.stroke();
    }
    c.fillStyle = "#ffb224";
    c.font = "600 13px Geist Mono, monospace";
    c.textAlign = "center";
    c.fillText(`${Math.round(progress * 100)}%`, x0 + W / 2, top - 10);
  }
}

function drawEmptyPlot(c: Ctx, i: number) {
  const x0 = plotLeft(i);
  c.strokeStyle = "rgba(237,234,227,0.35)";
  c.setLineDash([8, 6]);
  c.lineWidth = 2;
  c.strokeRect(x0 + 10, -100, PLOT_W - 20, 100);
  c.setLineDash([]);
  c.fillStyle = "#8a5a2a";
  c.fillRect(x0 + PLOT_W / 2 - 3, -58, 6, 58);
  c.fillStyle = "#c9a26a";
  c.fillRect(x0 + PLOT_W / 2 - 46, -90, 92, 36);
  c.fillStyle = INK;
  c.font = "700 12px Geist, system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("FOR SALE", x0 + PLOT_W / 2, -75);
  c.font = "500 11px Geist Mono, monospace";
  c.fillText(`PLOT ${i + 1}`, x0 + PLOT_W / 2, -61);
}

/* ---------- Props ---------- */

function flag(c: Ctx, x: number, y: number, h: number, color: string, time: number) {
  c.strokeStyle = "#5d5b56";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - h);
  c.stroke();
  const w = Math.sin(time * 4 + x) * 4;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - h);
  c.quadraticCurveTo(x + 18, y - h + 4 + w, x + 36, y - h + 6);
  c.lineTo(x + 36, y - h + 26);
  c.quadraticCurveTo(x + 18, y - h + 22 + w, x, y - h + 20);
  c.fill();
}

function signpost(c: Ctx, x: number, y: number, text: string) {
  c.fillStyle = "#6a4a2a";
  c.fillRect(x - 3, y - 60, 6, 60);
  c.font = "700 12px Geist, system-ui, sans-serif";
  const w = c.measureText(text).width + 20;
  c.fillStyle = "#c9a26a";
  c.beginPath();
  c.moveTo(x - w / 2, y - 76);
  c.lineTo(x + w / 2, y - 76);
  c.lineTo(x + w / 2 + 10, y - 64);
  c.lineTo(x + w / 2, y - 52);
  c.lineTo(x - w / 2, y - 52);
  c.closePath();
  c.fill();
  c.fillStyle = INK;
  c.textAlign = "center";
  c.fillText(text, x + 3, y - 60);
}

function gate(c: Ctx, x: number, y: number, label: string) {
  c.fillStyle = "#edeae3";
  c.fillRect(x - 4, y - 150, 8, 150);
  c.fillRect(x + 80, y - 150, 8, 150);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = i % 2 ? INK : "#edeae3";
    c.fillRect(x - 4 + i * 7.67, y - 150, 7.67, 12);
    c.fillStyle = i % 2 ? "#edeae3" : INK;
    c.fillRect(x - 4 + i * 7.67, y - 138, 7.67, 12);
  }
  c.fillStyle = "#ffb224";
  c.font = "700 13px Geist, system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText(label, x + 42, y - 158);
}

function drawRamp(c: Ctx, g: Game, r: Ramp) {
  const t = g.terrain;
  const start = r.x - r.dir * r.w;
  c.fillStyle = "#a0723a";
  c.strokeStyle = "#5a4320";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(start, t.base(start));
  for (let i = 0; i <= 10; i++) {
    const x = start + ((r.x - start) * i) / 10;
    c.lineTo(x, t.y(x));
  }
  const back = r.x + r.dir * r.w * 0.3;
  c.lineTo(back, t.base(back));
  c.closePath();
  c.fill();
  c.stroke();
  for (let i = 1; i < 6; i++) {
    const x = start + ((r.x - start) * i) / 6;
    c.beginPath();
    c.moveTo(x, t.y(x));
    c.lineTo(x, t.base(x));
    c.stroke();
  }
  c.fillStyle = "#ffb224";
  c.fillRect(r.x - 3, t.y(r.x) - 4, 6, 4);
}

function drawPoint(c: Ctx, q: Point, time: number) {
  if (q.done && q.kind !== "home") return;
  const bob = Math.sin(time * 3 + q.x) * 4;
  switch (q.kind) {
    case "crate":
      c.fillStyle = "#a07a3a";
      c.fillRect(q.x - 18, q.y - 36, 36, 36);
      c.strokeStyle = "#5a4320";
      c.lineWidth = 3;
      c.strokeRect(q.x - 18, q.y - 36, 36, 36);
      c.beginPath();
      c.moveTo(q.x - 18, q.y - 36);
      c.lineTo(q.x + 18, q.y);
      c.stroke();
      break;
    case "terminal":
      c.fillStyle = "#3a3a42";
      c.fillRect(q.x - 16, q.y - 56, 32, 56);
      c.fillStyle = Math.sin(time * 6) > 0 ? "#8bd99b" : "#3fa7ff";
      c.fillRect(q.x - 11, q.y - 50, 22, 16);
      c.fillStyle = "#ffb224";
      c.fillRect(q.x - 2, q.y - 80, 4, 24);
      break;
    case "hiker": {
      const hiker: Hero = { name: "", hair: "short", hairColor: "#5a3a1a", headwear: "cap", skin: "#e0b48a", top: "#ff8a3a", bottom: "shorts", bottomColor: "#4a4a2a" };
      c.fillStyle = "#3f6a8a";
      c.fillRect(q.x - 16, q.y - 52, 10, 22);
      drawHero(c, hiker, q.x, q.y, -1, time, "wave");
      c.fillStyle = "#edeae3";
      c.font = "700 14px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("HELP!", q.x, q.y - 92 + bob);
      break;
    }
    case "ring":
      c.strokeStyle = "#ffb224";
      c.lineWidth = 7;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.ellipse(q.x, q.y, 22, 60, 0, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
      break;
    default:
      break;
  }
  if (!q.done) {
    // A bobbing arrow marks every objective
    c.fillStyle = "#ffb224";
    const ay = (q.kind === "ring" ? q.y - 80 : q.y - 120) + bob;
    c.beginPath();
    c.moveTo(q.x - 10, ay - 14);
    c.lineTo(q.x + 10, ay - 14);
    c.lineTo(q.x, ay);
    c.fill();
  }
}

function drawDrone(c: Ctx, x: number, y: number, time: number, angry: boolean) {
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(time * 2) * 0.1);
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-24, -6);
  c.lineTo(24, -6);
  c.stroke();
  c.fillStyle = "#2a2a30";
  roundRect(c, -14, -10, 28, 16, 5);
  c.fill();
  c.fillStyle = angry ? "#ff5a4e" : "#8bd99b";
  c.beginPath();
  c.arc(6, -2, 4, 0, TAU);
  c.fill();
  c.strokeStyle = "rgba(29,29,36,0.7)";
  c.lineWidth = 2;
  const s = Math.cos(time * 40) * 12;
  for (const px of [-24, 24]) {
    c.beginPath();
    c.moveTo(px - s, -10);
    c.lineTo(px + s, -10);
    c.stroke();
  }
  c.restore();
}

/* ---------- Scene ---------- */

export function render(c: Ctx, g: Game, cssW: number, cssH: number, dpr: number) {
  const vw = viewWidth(cssW);
  const scale = cssW / vw;
  const vh = cssH / scale;
  const time = g.time;
  const light = g.daylight;
  const night = 1 - light;
  const dusk = Math.max(0, 1 - Math.abs(light - 0.35) / 0.2);
  const camX = Math.max(vw / 2, Math.min(WORLD_W - vw / 2, g.cam.x + g.camOffset.x)) + (g.shake ? Math.sin(time * 70) * g.shake * 6 : 0);
  const camY = Math.min(g.cam.y, vh * 0.5 - 120) + g.camOffset.y;
  g.view = { camX, camY, scale, w: cssW, h: cssH };
  nightQueue.length = 0;
  const left = camX - vw / 2;
  const right = camX + vw / 2;
  const top = camY - vh / 2;

  // Sky (screen space)
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, cssH);
  sky.addColorStop(0, mix(mix("#4aa3f0", "#ff8a5a", dusk * 0.6), "#0a0f2e", night * 1.1));
  sky.addColorStop(1, mix(mix("#cfe9ff", "#ffc48a", dusk), "#1f2a55", night));
  c.fillStyle = sky;
  c.fillRect(0, 0, cssW, cssH);
  if (night > 0.45) {
    c.fillStyle = `rgba(255,255,255,${(night - 0.45) * 1.6})`;
    for (let i = 0; i < 70; i++) {
      const sx = (hash(i) * cssW * 1.5 - camX * 0.02 * scale) % cssW;
      c.fillRect((sx + cssW) % cssW, hash(i + 99) * cssH * 0.6, 1.6, 1.6);
    }
  }
  // Sun and moon travel across the sky: sunrise at a quarter of the day, sunset at three quarters
  const body = (phase: number, color: string, r: number) => {
    const k = (phase - 0.25) * 2;
    if (k < -0.05 || k > 1.05) return;
    c.fillStyle = color;
    c.beginPath();
    c.arc(cssW * (0.05 + 0.9 * k), cssH * (0.8 - 0.62 * Math.sin(Math.PI * k)), r * Math.max(0.7, scale), 0, TAU);
    c.fill();
  };
  body(g.dayPhase, "#ffe08a", 26);
  body((g.dayPhase + 0.5) % 1, "#e8e8f0", 18);

  // Parallax layers, in their own scrolled spaces
  const zoneMix = Math.max(0, Math.min(1, (camX - HILLS_END + 600) / 900));
  const layer = (factor: number, amp: number, period: number, baseY: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, cssH);
    for (let sx = 0; sx <= cssW + 20; sx += 20) {
      const wx = sx / scale + left * factor;
      const h = amp * (0.6 * Math.sin(wx / period) + 0.4 * Math.sin(wx / (period * 0.37) + 1.3));
      c.lineTo(sx, (baseY - h - (camY - -150) * factor * 0.3) * scale);
    }
    c.lineTo(cssW, cssH);
    c.fill();
  };
  const far = mix(mix("#8fb4d9", "#d9b48f", zoneMix), "#1a2246", night * 0.9);
  const mid = mix(mix("#6f9f6a", "#c99a5a", zoneMix), "#151d36", night * 0.9);
  layer(0.15, 70, 260, vh * 0.6, far);
  // Clouds
  c.fillStyle = `rgba(255,255,255,${0.75 - night * 0.55})`;
  for (let i = 0; i < 8; i++) {
    const wx = ((hash(i + 7) * 3000 + time * 12 - left * 0.25) % 3000 + 3000) % 3000 - 400;
    const cy = (60 + hash(i + 3) * 160) * scale;
    const s = (0.7 + hash(i + 11) * 0.6) * scale;
    for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 32], [58, 0, 24]]) {
      c.beginPath();
      c.arc(wx * scale + dx * s, cy + dy * s, r * s, 0, TAU);
      c.fill();
    }
  }
  layer(0.4, 50, 180, vh * 0.72, mid);
  // Distant city skyline behind the town
  if (left < TOWN_END + 1200) {
    c.fillStyle = mix("#7a8aa6", "#141a33", night * 0.9);
    for (let i = 0; i < 24; i++) {
      const wx = i * 140 - left * 0.55;
      const h = 80 + hash(i) * 160;
      const sx = wx * scale;
      if (sx < -200 || sx > cssW + 50) continue;
      c.fillRect(sx, (vh * 0.78 - h - (camY + 150) * 0.15) * scale, 90 * scale, (h + 400) * scale);
    }
  }

  // World space
  c.setTransform(scale * dpr, 0, 0, scale * dpr, (cssW / 2 - camX * scale) * dpr, (cssH / 2 - camY * scale) * dpr);
  const t = g.terrain;
  const lights: number[][] = [];

  // Trees and cacti in the hills and desert (behind everything)
  for (let x = Math.floor(left / 160) * 160; x < right + 160; x += 160) {
    if (x < TOWN_END + 80 || x > WORLD_W) continue;
    const h = hash(x);
    if (h < 0.45) continue;
    const gy = t.base(x + h * 60);
    const px = x + h * 60;
    const decor = sprite("props", px < HILLS_END ? (h > 0.8 ? "tree" : "pine") : h > 0.85 ? "rock" : "cactus");
    if (decor) {
      drawSprite(c, decor, px, gy + 3, 0.6 + h * 0.35);
      continue;
    }
    if (px < HILLS_END) {
      c.fillStyle = "#6a4a2a";
      c.fillRect(px - 4, gy - 46, 8, 46);
      c.fillStyle = mix("#3f8a3a", "#0f2a1a", night * 0.6);
      c.beginPath();
      c.moveTo(px - 26, gy - 34);
      c.lineTo(px, gy - 100 - h * 30);
      c.lineTo(px + 26, gy - 34);
      c.fill();
    } else {
      c.strokeStyle = mix("#4f8a4a", "#1a3a1a", night * 0.6);
      c.lineWidth = 9;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(px, gy);
      c.lineTo(px, gy - 60);
      c.moveTo(px, gy - 30);
      c.lineTo(px - 16, gy - 34);
      c.lineTo(px - 16, gy - 50);
      c.moveTo(px, gy - 38);
      c.lineTo(px + 14, gy - 42);
      c.lineTo(px + 14, gy - 56);
      c.stroke();
    }
  }

  // Landmarks
  if (left < 400) {
    signpost(c, 70, 0, "STICKVILLE");
  }
  if (Math.abs(DEPOT_X - camX) < vw) {
    const crate = sprite("props", "crate");
    const barrel = sprite("props", "barrel");
    if (crate && barrel) {
      drawSprite(c, crate, DEPOT_X + 52, 0, 0.8);
      drawSprite(c, crate, DEPOT_X + 52, -32, 0.65);
      drawSprite(c, barrel, DEPOT_X - 48, 0, 0.8);
    }
    c.fillStyle = "#6a6a72";
    c.fillRect(DEPOT_X - 30, -70, 60, 70);
    c.fillStyle = "#edeae3";
    c.font = "700 11px Geist, system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText("DEPOT", DEPOT_X, -54);
  }
  if (Math.abs(RACE_START - camX) < vw) {
    gate(c, RACE_START, t.y(RACE_START), g.save.bestRace ? `RACE · BEST ${g.save.bestRace.toFixed(1)}s` : "RACE START");
    signpost(c, TOWN_END - 10, 0, "HILLS →");
  }
  if (Math.abs(RACE_END - camX) < vw) gate(c, RACE_END, t.y(RACE_END), "FINISH");
  if (Math.abs(HILLS_END + 150 - camX) < vw) signpost(c, HILLS_END + 150, t.y(HILLS_END + 150), "MILITARY ZONE →");
  if (Math.abs(WATCHTOWER_X - camX) < vw) {
    const gy = t.y(WATCHTOWER_X);
    c.strokeStyle = "#7a5a3a";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(WATCHTOWER_X - 40, gy);
    c.lineTo(WATCHTOWER_X - 24, gy - 150);
    c.moveTo(WATCHTOWER_X + 40, gy);
    c.lineTo(WATCHTOWER_X + 24, gy - 150);
    c.moveTo(WATCHTOWER_X - 34, gy - 50);
    c.lineTo(WATCHTOWER_X + 30, gy - 100);
    c.moveTo(WATCHTOWER_X + 34, gy - 50);
    c.lineTo(WATCHTOWER_X - 30, gy - 100);
    c.stroke();
    c.fillStyle = "#8a6a4a";
    c.fillRect(WATCHTOWER_X - 40, gy - 166, 80, 18);
    flag(c, WATCHTOWER_X, gy - 166, 50, "#ffb224", time);
  }
  if (Math.abs(OUTPOST_X - camX) < vw) {
    const gy = t.y(OUTPOST_X);
    const tent = sprite("props", "tent");
    if (tent) drawSprite(c, tent, OUTPOST_X - 20, gy + 4, 0.9);
    else {
      c.fillStyle = "#6b7a3a";
      c.beginPath();
      c.moveTo(OUTPOST_X - 80, gy);
      c.lineTo(OUTPOST_X - 20, gy - 80);
      c.lineTo(OUTPOST_X + 40, gy);
      c.fill();
    }
    c.fillStyle = "#c9b28a";
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(OUTPOST_X + 60 + i * 18, t.y(OUTPOST_X + 60 + i * 18) - 8, 11, 8, 0, 0, TAU);
      c.fill();
    }
    c.strokeStyle = "#8e8b84";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(OUTPOST_X - 110, gy);
    c.lineTo(OUTPOST_X - 110, gy - 140);
    c.stroke();
    c.fillStyle = Math.sin(time * 5) > 0 ? "#ff5a4e" : "#5d5b56";
    c.beginPath();
    c.arc(OUTPOST_X - 110, gy - 142, 4, 0, TAU);
    c.fill();
    flag(c, OUTPOST_X - 20, gy - 80, 40, "#ffb224", time);
  }

  // Town plots
  for (let i = 0; i < PLOT_COUNT; i++) {
    const x0 = plotLeft(i);
    if (x0 > right + 50 || x0 + PLOT_W < left - 50) continue;
    const k = g.save.plots[i];
    if (k) drawBuilding(c, k, x0, g.built.get(i) ?? 1, lights, time);
    else drawEmptyPlot(c, i);
  }

  // Ground: one shape, grass fading into sand at the edge of the desert
  const step = 16;
  const x0 = Math.floor((left - 40) / step) * step;
  const x1 = right + 40;
  const bottom = top + vh + 400;
  const sand = (a: string, b: string) => {
    const gr = c.createLinearGradient(HILLS_END - 200, 0, HILLS_END + 200, 0);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    return gr;
  };
  c.beginPath();
  c.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + step; x += step) c.lineTo(x, t.base(x));
  c.lineTo(x1 + step, bottom);
  c.closePath();
  c.fillStyle = sand("#7a5a3a", "#c9a25c");
  c.fill();
  c.beginPath();
  for (let x = x0; x <= x1 + step; x += step) c.lineTo(x, t.base(x) + 4);
  c.strokeStyle = sand("#5aa04a", "#e2c27a");
  c.lineWidth = 12;
  c.lineJoin = "round";
  c.stroke();
  // Town road
  if (left < TOWN_END) {
    c.fillStyle = "#3a3a42";
    c.fillRect(Math.max(0, left), 0, Math.min(TOWN_END, right) - Math.max(0, left), 28);
    c.fillStyle = "#edeae3";
    for (let x = Math.floor(left / 80) * 80; x < Math.min(TOWN_END, right); x += 80) c.fillRect(x, 13, 40, 3);
  }
  for (const r of t.ramps) if (r.x > left - 300 && r.x < right + 300) drawRamp(c, g, r);

  // Things the player placed in Creator mode
  const ground = (x: number) => t.y(x);
  const lamps: number[][] = [];
  for (const q of g.save.props) {
    if (q.x < left - 300 || q.x > right + 300) continue;
    drawProp(c, g, q, time);
    if (q.kind === "lamp") lamps.push([q.x + 19, q.y - 103]);
  }
  if (g.creator && g.ghost) {
    c.globalAlpha = 0.5;
    drawProp(c, g, { id: -1, kind: g.ghost.kind, x: g.ghost.x, y: g.ghost.y, w: 120, h: 40, text: "…", color: "#ffb224" }, time);
    c.globalAlpha = 1;
  }
  if (g.creator && g.selected !== null) {
    const q = g.save.props.find((r) => r.id === g.selected);
    if (q) {
      const b = propBounds(q, g.save.packs, ground);
      c.strokeStyle = "#ffb224";
      c.lineWidth = 2 / scale;
      c.setLineDash([6, 4]);
      c.strokeRect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8);
      c.setLineDash([]);
    }
  }

  // Pickups
  for (const coin of g.coins) {
    if (coin.wait > 0 || coin.x < left - 40 || coin.x > right + 40) continue;
    const w = Math.abs(Math.cos(time * 3 + coin.x * 0.01));
    c.fillStyle = "#ffb224";
    c.beginPath();
    c.ellipse(coin.x, coin.y, 9 * w + 1, 9, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#ffe08a";
    c.beginPath();
    c.ellipse(coin.x, coin.y, 5 * w, 5, 0, 0, TAU);
    c.fill();
  }
  for (const b of g.books) {
    if (b.x < left - 40 || b.x > right + 40) continue;
    const by = b.y + Math.sin(time * 2 + b.x) * 6;
    c.fillStyle = `rgba(255,226,138,${0.25 + 0.15 * Math.sin(time * 4)})`;
    c.beginPath();
    c.arc(b.x, by, 26, 0, TAU);
    c.fill();
    c.fillStyle = "#3fa7ff";
    c.fillRect(b.x - 13, by - 10, 12, 20);
    c.fillStyle = "#9b6bff";
    c.fillRect(b.x + 1, by - 10, 12, 20);
    c.fillStyle = "#edeae3";
    c.fillRect(b.x - 1, by - 10, 2, 20);
  }

  // Mission objects
  const m = g.mission;
  if (m) for (const q of m.points) drawPoint(c, q, time);

  // Vehicles and the hero
  const p = g.player;
  const hero = g.save.hero;
  for (const v of g.vehicles) {
    if (v.x < left - 200 || v.x > right + 200) continue;
    drawVehicle(c, v, v === p.vehicle ? hero : null, !!m?.carrying && v === p.vehicle);
  }
  if (hero && !p.vehicle) {
    const pose: Pose = p.downT > 0 ? "down" : !p.grounded ? "air" : Math.abs(p.vx) > 20 ? "walk" : "stand";
    if (m?.carrying) {
      c.fillStyle = "#a07a3a";
      c.fillRect(p.x - 14, p.y - 96, 28, 22);
    }
    drawHero(c, hero, p.x, p.y, p.facing, p.phase, pose, 1, p.hurtT > 0);
  }
  // Rescued hikers ride along, shown as a little crowd behind you
  if (m?.def.kind === "rescue" && m.aboard > 0) {
    const f = g.focus();
    const hiker: Hero = { name: "", hair: "short", hairColor: "#5a3a1a", headwear: "cap", skin: "#e0b48a", top: "#ff8a3a", bottom: "shorts", bottomColor: "#4a4a2a" };
    for (let i = 0; i < m.aboard; i++) {
      const hx = f.x - (p.vehicle?.dir ?? p.facing) * (70 + i * 26);
      drawHero(c, hiker, hx, t.y(hx), p.vehicle?.dir ?? p.facing, time * 8 + i, Math.abs(f.vx) > 20 ? "walk" : "stand", 0.8);
    }
  }
  for (const d of g.drones) if (d.x > left - 60 && d.x < right + 60) drawDrone(c, d.x, d.y, time, d.shoots);
  for (const s of g.shots) {
    c.fillStyle = s.color;
    c.beginPath();
    c.arc(s.x, s.y, s.enemy ? 6 : 5, 0, TAU);
    c.fill();
  }
  for (const q of g.particles) {
    c.globalAlpha = Math.max(0, Math.min(1, q.life / q.max * 1.5));
    c.fillStyle = q.color;
    c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  c.globalAlpha = 1;

  // Night falls over the world; windows light up
  if (night > 0.05) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = `rgba(8,12,40,${night * 0.45})`;
    c.fillRect(0, 0, cssW, cssH);
    c.setTransform(scale * dpr, 0, 0, scale * dpr, (cssW / 2 - camX * scale) * dpr, (cssH / 2 - camY * scale) * dpr);
    if (night > 0.35) {
      const a = Math.min(1, (night - 0.35) * 2.5);
      c.fillStyle = `rgba(255,211,107,${a})`;
      for (const [x, y, w, h] of lights) c.fillRect(x, y, w, h);
      c.globalAlpha = a;
      for (const [img, x, y] of nightQueue) drawSprite(c, img, x, y);
      for (const [x, y] of lamps) {
        const glow = c.createRadialGradient(x, y, 2, x, y, 90);
        glow.addColorStop(0, "rgba(255,224,138,0.55)");
        glow.addColorStop(1, "rgba(255,224,138,0)");
        c.fillStyle = glow;
        c.fillRect(x - 90, y - 90, 180, 180);
      }
      c.globalAlpha = 1;
    }
  }

  // Signs and citizens speak when you come near
  if (g.talking !== null) {
    const q = g.save.props.find((r) => r.id === g.talking);
    if (q?.text) bubble(c, q.x, q.y - (q.kind === "person" ? 92 : 92), q.text);
  }

  drawHud(c, g, cssW, cssH, dpr);
}

/* ---------- HUD ---------- */

function pill(c: Ctx, x: number, y: number, w: number, h: number, fill = "rgba(8,8,10,0.72)") {
  c.fillStyle = fill;
  roundRect(c, x, y, w, h, 6);
  c.fill();
}

function drawHud(c: Ctx, g: Game, W: number, H: number, dpr: number) {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = W < 700 ? 0.82 : 1;
  const font = (weight: number, size: number, mono = false) => `${weight} ${Math.round(size * s)}px ${mono ? "Geist Mono, ui-monospace, monospace" : "Geist, system-ui, sans-serif"}`;
  c.textBaseline = "middle";

  // Status card: name, rank, XP, coins, health
  const rank = g.rank();
  const cw = 210 * s;
  pill(c, 12, 12, cw, 84 * s);
  c.textAlign = "left";
  c.fillStyle = "#edeae3";
  c.font = font(600, 14);
  c.fillText(g.save.hero?.name || "Hero", 24, 28 * s + 4);
  c.fillStyle = "#ffb224";
  c.font = font(500, 11, true);
  c.fillText(rank.name.toUpperCase(), 24, 46 * s + 4);
  const xpFrac = rank.next ? (g.save.xp - rank.from) / (rank.next - rank.from) : 1;
  c.fillStyle = "rgba(237,234,227,0.15)";
  c.fillRect(110 * s, 44 * s, 100 * s, 5);
  c.fillStyle = "#ffb224";
  c.fillRect(110 * s, 44 * s, 100 * s * xpFrac, 5);
  // coins
  c.fillStyle = "#ffb224";
  c.beginPath();
  c.arc(30, 70 * s + 4, 7 * s, 0, TAU);
  c.fill();
  c.fillStyle = "#edeae3";
  c.font = font(600, 14, true);
  c.fillText(String(g.save.coins), 44, 70 * s + 4);
  // health
  const hp = Math.max(0, g.player.hp) / MAX_HP;
  c.fillStyle = "rgba(237,234,227,0.15)";
  c.fillRect(110 * s, 68 * s + 2, 100 * s, 6);
  c.fillStyle = hp > 0.5 ? "#8bd99b" : hp > 0.25 ? "#ffb224" : "#ff5a4e";
  c.fillRect(110 * s, 68 * s + 2, 100 * s * hp, 6);

  // Minimap
  const mw = Math.min(300, W * 0.36);
  const mx = W - mw - 12;
  const my = 12;
  pill(c, mx, my, mw, 34 * s);
  const bar = (x0: number, x1: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(mx + 8 + (x0 / WORLD_W) * (mw - 16), my + 14 * s, ((x1 - x0) / WORLD_W) * (mw - 16), 6 * s);
  };
  bar(0, TOWN_END, "#5d5b56");
  bar(TOWN_END, HILLS_END, "#4f9a4a");
  bar(HILLS_END, WORLD_W, "#c9a25c");
  const mark = (x: number, col: string, r = 3) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(mx + 8 + (x / WORLD_W) * (mw - 16), my + 17 * s, r, 0, TAU);
    c.fill();
  };
  g.mission?.points.forEach((q) => !q.done && mark(q.x, "#ffb224", 4));
  for (const d of g.drones) mark(d.x, "#ff5a4e", 2);
  mark(g.focus().x, "#edeae3", 4.5);
  c.fillStyle = "#8e8b84";
  c.font = font(500, 9, true);
  c.textAlign = "left";
  c.fillText("TOWN", mx + 8, my + 28 * s + 1);
  c.textAlign = "right";
  c.fillText("DESERT", mx + mw - 8, my + 28 * s + 1);

  // Mission card
  const m = g.mission;
  let ty = 108 * s;
  if (m) {
    const w = Math.min(W - 24, 460 * s);
    const x = (W - w) / 2;
    const y = W < 700 ? 104 * s : 12;
    pill(c, x, y, w, 52 * s, "rgba(8,8,10,0.8)");
    c.textAlign = "left";
    c.fillStyle = "#ffb224";
    c.font = font(600, 11, true);
    c.fillText(`MISSION · ${m.def.title.toUpperCase()}`, x + 12, y + 16 * s);
    c.fillStyle = "#edeae3";
    c.font = font(500, 13);
    c.fillText(m.objective, x + 12, y + 36 * s, w - 80);
    c.textAlign = "right";
    c.fillStyle = m.time < 15 ? "#ff5a4e" : "#edeae3";
    c.font = font(600, 18, true);
    c.fillText(`${Math.ceil(m.time)}s`, x + w - 12, y + 26 * s);
    ty = y + 64 * s;
  } else if (W < 700) ty = 104 * s;
  const timer = g.race?.t ?? g.course?.t;
  if (timer !== undefined) {
    pill(c, W / 2 - 70, ty, 140, 34);
    c.textAlign = "center";
    c.fillStyle = "#ffb224";
    c.font = font(600, 18, true);
    c.fillText(`${timer.toFixed(2)} s`, W / 2, ty + 17);
    ty += 42;
  }

  // Toasts
  c.textAlign = "center";
  for (const t of g.toasts) {
    c.globalAlpha = Math.min(1, t.t * 2);
    c.font = font(600, 14);
    const w = c.measureText(t.text).width + 24;
    pill(c, W / 2 - w / 2, ty, w, 30 * s);
    c.fillStyle = t.color;
    c.fillText(t.text, W / 2, ty + 15 * s);
    ty += 36 * s;
  }
  c.globalAlpha = 1;

  // Prompt
  if (g.prompt) {
    c.font = font(600, 14);
    const w = c.measureText(g.prompt.text).width + 28;
    const y = H - (W < 700 ? 200 : 56);
    pill(c, W / 2 - w / 2, y, w, 34, "rgba(255,178,36,0.92)");
    c.fillStyle = "#08080a";
    c.fillText(g.prompt.text, W / 2, y + 17);
  }

  // Speedometer
  const v = g.player.vehicle;
  if (v) {
    const y = H - (W < 700 ? 250 : 60);
    pill(c, W - 132, y, 120, 44);
    c.textAlign = "right";
    c.fillStyle = "#edeae3";
    c.font = font(600, 20, true);
    c.fillText(String(g.speedKmh()), W - 58, y + 22);
    c.fillStyle = "#8e8b84";
    c.font = font(500, 10, true);
    c.textAlign = "left";
    c.fillText("KM/H", W - 52, y + 23);
  }
  if (g.player.downT > 0) {
    c.textAlign = "center";
    c.fillStyle = "#ff5a4e";
    c.font = font(700, 28);
    c.fillText("KNOCKED OUT", W / 2, H / 2);
  }
  c.textBaseline = "alphabetic";
}

/* ---------- Creator props ---------- */

function bubble(c: Ctx, x: number, y: number, text: string) {
  c.font = "500 13px Geist, system-ui, sans-serif";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > 220 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 24;
  const h = lines.length * 17 + 16;
  const bx = x - w / 2;
  const by = y - h - 10;
  c.fillStyle = "#fdfcf8";
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(bx, by, w, h, 10);
  c.moveTo(x - 8, by + h);
  c.lineTo(x, by + h + 10);
  c.lineTo(x + 8, by + h);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.textAlign = "left";
  c.textBaseline = "middle";
  lines.forEach((l, i) => c.fillText(l, bx + 12, by + 16 + i * 17));
  c.textBaseline = "alphabetic";
}

const citizen = (color: string): Hero => ({ name: "", hair: "short", hairColor: "#3b2416", headwear: "none", skin: "#e0b48a", top: color, bottom: "pants", bottomColor: "#30343c" });

export function drawProp(c: Ctx, g: Game, q: Prop, time: number) {
  if (q.kind.startsWith("pack:")) {
    const pack = g.save.packs.find((p) => `pack:${p.id}` === q.kind);
    const img = pack && packSprite(pack);
    if (img) drawSprite(c, img, q.x, q.y);
    else placeholder(c, q.x, q.y, pack?.name ?? "missing");
    return;
  }
  const art = sprite("props", q.kind);
  if (art) return drawSprite(c, art, q.x, q.y);
  switch (q.kind) {
    case "block": {
      const w = q.w ?? 120;
      const h = q.h ?? 40;
      const col = q.color ?? "#8e8b84";
      c.fillStyle = mix(col, "#000000", 0.25);
      c.beginPath();
      c.roundRect(q.x - w / 2, q.y - h, w, h, 4);
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(q.x - w / 2, q.y - h, w, h - 6, 4);
      c.fill();
      c.fillStyle = mix(col, "#ffffff", 0.3);
      c.fillRect(q.x - w / 2 + 3, q.y - h + 2, w - 6, 4);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.strokeRect(q.x - w / 2, q.y - h, w, h);
      break;
    }
    case "trampoline":
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(q.x - 34, q.y);
      c.lineTo(q.x - 28, q.y - 16);
      c.moveTo(q.x + 34, q.y);
      c.lineTo(q.x + 28, q.y - 16);
      c.stroke();
      c.fillStyle = "#3fa7ff";
      c.fillRect(q.x - 40, q.y - 22, 80, 7);
      c.fillStyle = "#ff6b8a";
      c.fillRect(q.x - 40, q.y - 22, 10, 7);
      c.fillRect(q.x + 30, q.y - 22, 10, 7);
      break;
    case "boost": {
      c.fillStyle = "#3a3a42";
      c.fillRect(q.x - 45, q.y - 8, 90, 8);
      const k = (time * 3) % 1;
      for (let i = 0; i < 4; i++) {
        c.fillStyle = `rgba(255,178,36,${0.4 + 0.6 * ((i / 4 + k) % 1)})`;
        const bx = q.x - 36 + i * 20;
        c.beginPath();
        c.moveTo(bx, q.y - 7);
        c.lineTo(bx + 9, q.y - 4);
        c.lineTo(bx, q.y - 1);
        c.fill();
      }
      break;
    }
    case "coin": {
      if (g.propCoinWait.has(q.id)) return;
      const w = Math.abs(Math.cos(time * 3 + q.x * 0.01));
      c.fillStyle = "#ffb224";
      c.beginPath();
      c.ellipse(q.x, q.y, 9 * w + 1, 9, 0, 0, TAU);
      c.fill();
      c.fillStyle = "#ffe08a";
      c.beginPath();
      c.ellipse(q.x, q.y, 5 * w, 5, 0, 0, TAU);
      c.fill();
      break;
    }
    case "start":
      gate(c, q.x, q.y, "START");
      break;
    case "finish":
      gate(c, q.x, q.y, q.best ? `FINISH · BEST ${q.best.toFixed(1)}s` : "FINISH");
      break;
    case "sign": {
      c.fillStyle = "#6a4a2a";
      c.fillRect(q.x - 3, q.y - 50, 6, 50);
      c.fillStyle = "#c9a26a";
      c.beginPath();
      c.roundRect(q.x - 48, q.y - 80, 96, 34, 3);
      c.fill();
      c.strokeStyle = "#6a4a2a";
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = INK;
      c.font = "600 11px Geist, system-ui, sans-serif";
      c.textAlign = "center";
      let t = q.text ?? "";
      while (t.length > 1 && c.measureText(t).width > 84) t = t.slice(0, -2) + "…";
      c.fillText(t, q.x, q.y - 59);
      break;
    }
    case "person": {
      const f = g.focus();
      const talking = g.talking === q.id;
      drawHero(c, citizen(q.color ?? "#3fa7ff"), q.x, q.y, f.x < q.x ? -1 : 1, time * 3, talking ? "wave" : "stand");
      break;
    }
    case "flag":
      flag(c, q.x, q.y, 90, q.color ?? "#ffb224", time);
      break;
    case "ramp":
      if (q.id === -1) {
        c.fillStyle = "#a0723a";
        c.beginPath();
        c.moveTo(q.x - 150, q.y);
        c.lineTo(q.x, q.y - 60);
        c.lineTo(q.x + 45, q.y);
        c.fill();
      }
      break;
    default:
      placeholder(c, q.x, q.y, q.kind);
  }
}

function placeholder(c: Ctx, x: number, y: number, label: string) {
  c.fillStyle = "rgba(237,234,227,0.2)";
  c.strokeStyle = "#edeae3";
  c.setLineDash([4, 3]);
  c.strokeRect(x - 20, y - 40, 40, 40);
  c.setLineDash([]);
  c.fillRect(x - 20, y - 40, 40, 40);
  c.fillStyle = "#edeae3";
  c.font = "500 9px Geist Mono, monospace";
  c.textAlign = "center";
  c.fillText(label.slice(0, 8), x, y - 18);
}
