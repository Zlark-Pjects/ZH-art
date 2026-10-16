/* Stick figures: the hero, citizens, rescued engineers. Drawn upright and side-on, the
   way the city's camera sees people. */

import type { Hero } from "./data";

type Ctx = CanvasRenderingContext2D;
export const INK = "#1d1d24";
const TAU = Math.PI * 2;

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

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
