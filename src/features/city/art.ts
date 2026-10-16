/* Loads the Blender-rendered city sprites (blender/build_city_art.py) and player imports. */

import { ART, type Meta } from "./map";
import type { Pack } from "./engine";

const files = import.meta.glob("./art/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const images = new Map<string, HTMLImageElement>();

function image(src: string | undefined) {
  if (!src || typeof Image === "undefined") return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export const fileUrl = (name: string) => files[`./art/${name}.webp`];

export function sprite(name: string, night = false): { img: HTMLImageElement; m: Meta } | null {
  const m = ART.buildings[name] ?? ART.props[name];
  if (!m || (night && !m.night)) return null;
  const img = image(fileUrl(night ? `${name}-night` : name));
  return img ? { img, m } : null;
}

/** One frame of a 16-heading sheet (vehicles, ramps); heading in radians, clockwise from east. */
export function spinnerFrame(name: string, heading: number) {
  const s = ART.spinners[name];
  if (!s) return null;
  const img = image(fileUrl(name));
  if (!img) return null;
  const n = s.frames.length;
  const i = ((Math.round((heading / (Math.PI * 2)) * n) % n) + n) % n;
  return { img, f: s.frames[i] };
}

export function packImage(p: Pack) {
  return image(p.src);
}

/** Preload everything so the first drive around town doesn't pop in. */
export function preload() {
  for (const src of Object.values(files)) image(src);
}
