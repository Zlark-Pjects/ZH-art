/* Loads the Blender-rendered sprites (built by blender/build_game_art.py) and the player's
   imported packs. Anything not loaded yet — or the "hand-drawn" art setting — falls back to
   the canvas drawings in render.ts. */

import { ART, type Pack, type SpriteMeta } from "./creator";

const files = import.meta.glob("./art/*.{png,webp}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export interface Sprite extends SpriteMeta {
  img: HTMLImageElement;
}

const cache = new Map<string, Sprite | null>();
let enabled = true;

export function setArtEnabled(on: boolean) {
  enabled = on;
}
export const artEnabled = () => enabled;

function load(key: string, src: string | undefined, meta: SpriteMeta | undefined): Sprite | null {
  if (cache.has(key)) return cache.get(key)!;
  if (!src || !meta || typeof Image === "undefined") {
    cache.set(key, null);
    return null;
  }
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  const s: Sprite = { ...meta, img };
  cache.set(key, s);
  return s;
}

const ready = (s: Sprite | null) => (s && s.img.complete && s.img.naturalWidth > 0 ? s : null);

/** A built-in sprite: group is buildings, vehicles or props. */
export function sprite(group: "buildings" | "vehicles" | "props", name: string, night = false): Sprite | null {
  if (!enabled) return null;
  const meta = ART[group][name];
  if (!meta) return null;
  const m = night ? meta.night : meta;
  const file = `./art/${name}${night ? "-night" : ""}.${meta.ext ?? "png"}`;
  return ready(load(`${group}/${file}`, files[file], m));
}

/** A player's imported sprite. Packs show even with hand-drawn art on: they're the player's own. */
export function packSprite(pack: Pack): Sprite | null {
  return ready(load(`pack/${pack.id}/${pack.src.length}`, pack.src, pack));
}

/** Small preview images for the Creator palette. */
export function propPreview(name: string) {
  const meta = ART.props[name];
  return meta ? files[`./art/${name}.${meta.ext ?? "png"}`] : undefined;
}

export function drawSprite(c: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1) {
  c.drawImage(s.img, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
}
