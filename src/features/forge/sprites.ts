import type { CharacterLook, RigClip } from "../../types";
import { drawOps, type DrawOp } from "../../project/forge/figure";
import { FLOOR, TAU } from "../../project/forge/draw";
import { GAME_STATES, drawCharacter, drawClip, isPerformance, planOf, stateForClip, stateSeconds, type GameState } from "../../project/forge/plans";
import { clipLength } from "../../project/rig";
import { makeZip } from "../../lib/zip";

/*
 * Game sprite export. Renders each animation state frame by frame, crops all
 * frames to one shared box (so the character never jumps between frames),
 * lays them out as a grid (one row per state) and writes an atlas that
 * Phaser loads directly. The fixed grid also slices cleanly in Godot, Unity
 * and GameMaker.
 */

export interface SpriteOptions {
  states: GameState[];
  /** Motion clips to add as extra animations */
  clips?: RigClip[];
  /** Longest side of one frame, in pixels */
  frameSize: number;
  fps: number;
  facing: "right" | "left";
}

export interface SpriteSheet {
  canvas: HTMLCanvasElement;
  cell: { w: number; h: number };
  columns: number;
  rows: { name: string; label: string; frames: number }[];
  /** Feet position inside a cell, 0-1 */
  anchor: { x: number; y: number };
  atlas: object;
  baseName: string;
}

// Generous rig-space window that fits wings, tails, staffs and jumps
const WIN = { x: -260, y: -260, w: 920, h: 820 };
const MEASURE_SCALE = 0.5;

interface Row {
  name: string;
  label: string;
  seconds: number;
  draw: (t: number) => DrawOp[];
}

/** How long one loop of a clip lasts. */
export function clipSeconds(look: CharacterLook, clip: RigClip) {
  if (isPerformance(clip)) return clipLength(clip);
  if (clip.motion && planOf(look) !== "biped") return stateSeconds(stateForClip(clip));
  // One full cycle of the procedural motion (the rig advances 3 * speed rad/s)
  if (clip.motion) return Math.min(4, TAU / (3 * Math.max(0.1, clip.speed)));
  return 0.5;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function rowsFor(look: CharacterLook, opts: SpriteOptions): Row[] {
  const rows: Row[] = GAME_STATES.filter((s) => opts.states.includes(s.id)).map((s) => ({
    name: s.id,
    label: s.label,
    seconds: s.seconds,
    draw: (t) => drawCharacter(look, s.id, t, true),
  }));
  const taken = new Set(rows.map((r) => r.name));
  for (const clip of opts.clips ?? []) {
    let name = slugify(clip.name) || "clip";
    for (let n = 2; taken.has(name); n++) name = `${slugify(clip.name) || "clip"}-${n}`;
    taken.add(name);
    const seconds = clipSeconds(look, clip);
    rows.push({ name, label: clip.name, seconds, draw: (t) => drawClip(look, clip, t, seconds) });
  }
  return rows;
}

function framesFor(seconds: number, fps: number) {
  const count = Math.max(2, Math.round(seconds * fps));
  return Array.from({ length: count }, (_, i) => (i * seconds) / count);
}

/** Bounding box (rig space) of everything drawn across all frames. */
function measure(rows: Row[], fps: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(WIN.w * MEASURE_SCALE);
  canvas.height = Math.ceil(WIN.h * MEASURE_SCALE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of rows) {
    for (const t of framesFor(row.seconds, fps)) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(MEASURE_SCALE, 0, 0, MEASURE_SCALE, -WIN.x * MEASURE_SCALE, -WIN.y * MEASURE_SCALE);
      drawOps(ctx, row.draw(t));
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
  }
  if (!isFinite(minX)) return { x: 100, y: 0, w: 200, h: 480 };
  const pad = 6;
  const x = minX / MEASURE_SCALE + WIN.x - pad;
  const y = minY / MEASURE_SCALE + WIN.y - pad;
  // Always include the floor line so feet sit at the same height in every cell
  const bottom = Math.max(maxY / MEASURE_SCALE + WIN.y + pad, FLOOR + 4);
  return { x, y, w: maxX / MEASURE_SCALE + WIN.x + pad - x, h: bottom - y };
}

export async function renderSpriteSheet(look: CharacterLook, opts: SpriteOptions): Promise<SpriteSheet> {
  const defs = rowsFor(look, opts);
  if (!defs.length) throw new Error("Pick at least one animation.");
  const box = measure(defs, opts.fps);
  const scale = opts.frameSize / Math.max(box.w, box.h);
  const cell = { w: Math.ceil(box.w * scale), h: Math.ceil(box.h * scale) };
  const rows = defs.map((d) => ({ ...d, times: framesFor(d.seconds, opts.fps) }));
  const columns = Math.max(...rows.map((r) => r.times.length));

  const canvas = document.createElement("canvas");
  canvas.width = cell.w * columns;
  canvas.height = cell.h * rows.length;
  const ctx = canvas.getContext("2d")!;
  const slug = (look.name || "character").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
  const frames: Record<string, object> = {};
  const animations: Record<string, string[]> = {};
  const frameTags: object[] = [];
  let index = 0;

  rows.forEach((row, r) => {
    animations[row.name] = [];
    frameTags.push({ name: row.name, from: index, to: index + row.times.length - 1, direction: "forward" });
    row.times.forEach((t, c) => {
      const flip = opts.facing === "left";
      ctx.save();
      ctx.beginPath();
      ctx.rect(c * cell.w, r * cell.h, cell.w, cell.h);
      ctx.clip();
      ctx.setTransform(flip ? -scale : scale, 0, 0, scale, flip ? c * cell.w + cell.w + box.x * scale : c * cell.w - box.x * scale, r * cell.h - box.y * scale);
      drawOps(ctx, row.draw(t));
      ctx.restore();
      const name = `${row.name}_${String(c).padStart(2, "0")}`;
      animations[row.name].push(name);
      frames[name] = {
        frame: { x: c * cell.w, y: r * cell.h, w: cell.w, h: cell.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: cell.w, h: cell.h },
        sourceSize: { w: cell.w, h: cell.h },
        duration: Math.round(1000 / opts.fps),
      };
      index++;
    });
  });

  const anchor = { x: Math.round(((200 - box.x) / box.w) * 1000) / 1000, y: Math.round(((FLOOR - box.y) / box.h) * 1000) / 1000 };
  if (opts.facing === "left") anchor.x = Math.round((1 - anchor.x) * 1000) / 1000;
  const atlas = {
    frames,
    animations,
    meta: {
      app: "ZH-art",
      version: "1",
      image: `${slug}.png`,
      format: "RGBA8888",
      size: { w: canvas.width, h: canvas.height },
      scale: "1",
      frameTags,
      zhart: {
        character: look.name,
        bodyPlan: planOf(look),
        facing: opts.facing,
        fps: opts.fps,
        cell,
        columns,
        rows: rows.map((r, i) => ({ name: r.name, label: r.label, row: i, frames: r.times.length, seconds: r.seconds, loop: true })),
        anchor,
      },
    },
  };
  return { canvas, cell, columns, rows: rows.map((r) => ({ name: r.name, label: r.label, frames: r.times.length })), anchor, atlas, baseName: slug };
}

export function sheetPng(sheet: SpriteSheet): Promise<Blob> {
  return new Promise((resolve, reject) => sheet.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the PNG."))), "image/png"));
}

export function readme(sheet: SpriteSheet, fps: number) {
  const { cell, columns, rows, baseName, anchor } = sheet;
  const rowList = rows.map((r, i) => `  row ${i}: ${r.name} (${r.frames} frames)`).join("\n");
  return `${baseName} — exported from ZH-art

Files
  ${baseName}.png   sprite sheet, ${columns} columns x ${rows.length} rows, each cell ${cell.w} x ${cell.h} px
  ${baseName}.json  atlas: frame rectangles, animations, fps and anchor

Animations (all loop at ${fps} fps)
${rowList}

Anchor (where the feet touch the ground), as a fraction of the cell: x ${anchor.x}, y ${anchor.y}

Phaser 3
  this.load.atlas("${baseName}", "${baseName}.png", "${baseName}.json");
  // then for each animation, e.g. "${rows[0].name}":
  this.anims.create({ key: "${rows[0].name}", frames: this.anims.generateFrameNames("${baseName}", { prefix: "${rows[0].name}_", end: ${rows[0].frames - 1}, zeroPad: 2 }), frameRate: ${fps}, repeat: -1 });
  sprite.setOrigin(${anchor.x}, ${anchor.y});

Godot 4
  AnimatedSprite2D > SpriteFrames > "Add frames from sprite sheet": Horizontal ${columns}, Vertical ${rows.length};
  pick each row's frames into an animation named after it, set speed to ${fps} FPS and Loop on.

Unity
  Import the PNG, set Sprite Mode to Multiple, open the Sprite Editor, Slice > Grid By Cell Size ${cell.w} x ${cell.h}.
  Drag each row's sprites into the scene to make an animation clip; set the sample rate to ${fps}.

GameMaker
  Create a Sprite > Import Strip Image: frame width ${cell.w}, height ${cell.h}, frames per row ${columns}.
`;
}

export async function sheetZip(sheet: SpriteSheet, fps: number): Promise<Blob> {
  const png = new Uint8Array(await (await sheetPng(sheet)).arrayBuffer());
  return makeZip([
    { name: `${sheet.baseName}.png`, data: png },
    { name: `${sheet.baseName}.json`, data: JSON.stringify(sheet.atlas, null, 2) },
    { name: "README.txt", data: readme(sheet, fps) },
  ]);
}
