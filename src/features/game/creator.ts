/* Creator mode: the things a player can place in the world, their sizes, and the world-file
   format for sharing creations. Art props come from the Blender renders (art/manifest.json);
   packs are the player's own imports (from the Blender add-on, or any PNG). */

import manifest from "./art/manifest.json";
import type { Question } from "./data";

export interface SpriteMeta {
  w: number;
  h: number;
  ax: number;
  ay: number;
  ext?: string;
  solid?: boolean;
  night?: SpriteMeta;
}

export const ART = manifest as unknown as {
  pxPerM: number;
  buildings: Record<string, SpriteMeta>;
  vehicles: Record<string, SpriteMeta>;
  props: Record<string, SpriteMeta>;
};

/** An imported sprite: from the Blender add-on (.stickpack.json) or a plain PNG. */
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

export interface Prop {
  id: number;
  /** A built-in kind, an art prop name, or `pack:<id>`. */
  kind: string;
  x: number;
  /** The bottom of the prop (where it stands). */
  y: number;
  w?: number;
  h?: number;
  color?: string;
  text?: string;
  dir?: 1 | -1;
  /** Best time for a finish line, in seconds. */
  best?: number;
}

export type ToolGroup = "Build" | "Play" | "Nature" | "Town" | "Story" | "Mine";

export interface PropDef {
  label: string;
  group: ToolGroup;
  /** Snaps onto the ground or platform under the pointer. */
  grounded: boolean;
  solid?: boolean;
  hint: string;
  w?: number;
  h?: number;
  color?: string;
  text?: string;
}

export const PROP_DEFS: Record<string, PropDef> = {
  block: { label: "Block", group: "Build", grounded: false, solid: true, w: 120, h: 40, color: "#8e8b84", hint: "A platform you can stand and drive on. Resize and recolour it." },
  ramp: { label: "Ramp", group: "Build", grounded: true, hint: "A stunt ramp. Flip it to launch the other way." },
  trampoline: { label: "Trampoline", group: "Play", grounded: true, solid: true, w: 80, h: 18, hint: "Bounces you sky-high." },
  boost: { label: "Boost pad", group: "Play", grounded: true, w: 90, h: 8, hint: "A burst of speed for whoever crosses it." },
  coin: { label: "Coin", group: "Play", grounded: false, hint: "Worth 2 coins, comes back after a while." },
  start: { label: "Start line", group: "Play", grounded: true, hint: "Cross it heading right to start a timed course." },
  finish: { label: "Finish line", group: "Play", grounded: true, hint: "Ends a course and remembers the best time." },
  sign: { label: "Sign", group: "Story", grounded: true, text: "Write something here", hint: "Shows its message when someone walks past. Great for facts and clues." },
  person: { label: "Person", group: "Story", grounded: true, text: "Hello, explorer!", color: "#3fa7ff", hint: "A citizen who says your line when you come near." },
  flag: { label: "Flag", group: "Story", grounded: true, color: "#ffb224", hint: "Mark a spot." },
};

const ART_LABELS: Record<string, [string, ToolGroup, string]> = {
  tree: ["Tree", "Nature", "A leafy tree."],
  pine: ["Pine", "Nature", "An evergreen."],
  bush: ["Bush", "Nature", "A flowering bush."],
  rock: ["Rock", "Nature", "A boulder you can stand on."],
  cactus: ["Cactus", "Nature", "Desert life."],
  crate: ["Crate", "Town", "A wooden crate. Solid: stack them."],
  barrel: ["Barrel", "Town", "A solid barrel."],
  lamp: ["Street lamp", "Town", "Glows at night."],
  tent: ["Tent", "Town", "A camp tent."],
  fountain: ["Fountain", "Town", "A town-square fountain."],
  statue: ["Statue", "Town", "A golden stick hero."],
};
for (const [name, meta] of Object.entries(ART.props)) {
  const [label, group, hint] = ART_LABELS[name] ?? [name, "Town", ""];
  PROP_DEFS[name] = { label, group, grounded: true, solid: !!meta.solid, hint };
}

export function propDef(kind: string, packs: Pack[]): PropDef | null {
  if (kind.startsWith("pack:")) {
    const p = packs.find((q) => `pack:${q.id}` === kind);
    return p ? { label: p.name, group: "Mine", grounded: true, solid: p.solid, hint: "Your imported item." } : null;
  }
  return PROP_DEFS[kind] ?? null;
}

/** World-space box of a prop, for picking and collisions. */
export function propBounds(p: Prop, packs: Pack[], groundY: (x: number) => number) {
  const art = ART.props[p.kind];
  const pack = p.kind.startsWith("pack:") ? packs.find((q) => `pack:${q.id}` === p.kind) : null;
  if (art || pack) {
    const m = (art ?? pack)!;
    return { x0: p.x - m.ax, x1: p.x - m.ax + m.w, y0: p.y - m.ay, y1: p.y - m.ay + m.h, top: p.y - m.ay * 0.88 };
  }
  switch (p.kind) {
    case "block": {
      const w = p.w ?? 120;
      const h = p.h ?? 40;
      return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h, y1: p.y, top: p.y - h };
    }
    case "trampoline":
      return { x0: p.x - 40, x1: p.x + 40, y0: p.y - 22, y1: p.y, top: p.y - 18 };
    case "boost":
      return { x0: p.x - 45, x1: p.x + 45, y0: p.y - 12, y1: p.y + 2, top: p.y - 6 };
    case "coin":
      return { x0: p.x - 12, x1: p.x + 12, y0: p.y - 12, y1: p.y + 12, top: p.y };
    case "ramp": {
      const d = p.dir ?? 1;
      const gy = groundY(p.x);
      return { x0: d > 0 ? p.x - 150 : p.x - 45, x1: d > 0 ? p.x + 45 : p.x + 150, y0: gy - 70, y1: gy + 4, top: gy };
    }
    case "start":
    case "finish":
      return { x0: p.x - 8, x1: p.x + 92, y0: p.y - 165, y1: p.y, top: p.y };
    case "sign":
      return { x0: p.x - 50, x1: p.x + 50, y0: p.y - 80, y1: p.y, top: p.y };
    case "person":
      return { x0: p.x - 16, x1: p.x + 16, y0: p.y - 78, y1: p.y, top: p.y };
    case "flag":
      return { x0: p.x - 6, x1: p.x + 40, y0: p.y - 95, y1: p.y, top: p.y };
    default:
      return { x0: p.x - 20, x1: p.x + 20, y0: p.y - 40, y1: p.y, top: p.y };
  }
}

/* ---------- World files ---------- */

export const WORLD_FORMAT = "stickville-world";

export interface WorldFile {
  format: typeof WORLD_FORMAT;
  version: 1;
  name: string;
  props: Prop[];
  packs: Pack[];
  questions: Question[];
}

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
const image = (v: unknown) => (typeof v === "string" && /^data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 4_000_000 ? v : undefined);

export function cleanPack(raw: unknown): Pack | null {
  const r = raw as Record<string, unknown>;
  const src = image(r?.src ?? r?.png);
  const w = num(r?.w, 4, 2000);
  const h = num(r?.h, 4, 2000);
  if (!src || !w || !h) return null;
  return {
    id: str(r.id, 40) || Math.random().toString(36).slice(2, 10),
    name: str(r.name, 32) || "Imported",
    w,
    h,
    ax: num(r.ax, -2000, 4000) ?? w / 2,
    ay: num(r.ay, -2000, 4000) ?? h,
    solid: r.solid === true,
    src,
  };
}

export function cleanProp(raw: unknown, id: number, kinds: Set<string>): Prop | null {
  const r = raw as Record<string, unknown>;
  const kind = str(r?.kind, 60);
  const x = num(r?.x, 0, 10000);
  const y = num(r?.y, -1500, 600);
  if (!kind || !kinds.has(kind) || x === undefined || y === undefined) return null;
  const p: Prop = { id, kind, x, y };
  const w = num(r.w, 20, 1200);
  const h = num(r.h, 10, 600);
  if (w) p.w = w;
  if (h) p.h = h;
  if (color(r.color)) p.color = color(r.color);
  if (str(r.text, 200)) p.text = str(r.text, 200);
  if (r.dir === -1) p.dir = -1;
  const best = num(r.best, 0, 36000);
  if (best) p.best = best;
  return p;
}

export function cleanQuestion(raw: unknown): Question | null {
  const r = raw as Record<string, unknown>;
  const q = str(r?.q, 200);
  const options = Array.isArray(r?.options) ? r.options.map((o) => str(o, 80) ?? "").filter(Boolean).slice(0, 4) : [];
  const answer = num(r?.answer, 0, 3);
  if (!q || options.length < 2 || answer === undefined || answer >= options.length) return null;
  return { cat: "My questions", q, options, answer: Math.round(answer), why: str(r.why, 300) || "" };
}
