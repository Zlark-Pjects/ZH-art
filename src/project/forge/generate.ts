import type { CharacterBuild, CharacterLook, CharacterPalette, CharacterProportions, PartSlot } from "../../types";
import { SLOTS } from "./figure";

/*
 * Seeded character generator. Archetypes weight which parts and colours come
 * up; mutate and breed recombine existing designs. Everything is driven by a
 * seed, so any result can be reproduced exactly.
 */

/* ---------- Randomness ---------- */

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length) % items.length],
    chance: (p: number) => next() < p,
  };
}
type Rng = ReturnType<typeof rng>;

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/* ---------- Colour ---------- */

function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const c = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return `#${[c(0), c(8), c(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

const shiftHue = (hex: string, deg: number) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + deg, s, l);
};

const SKIN_TONES = ["#f3d2b8", "#e8b896", "#c98e6b", "#a26a47", "#7a4a30", "#5a3523"];

/* ---------- Archetypes ---------- */

type Weights = Partial<Record<PartSlot, Record<string, number>>>;

export interface Archetype {
  id: string;
  label: string;
  description: string;
  weights: Weights;
  proportions: Record<keyof CharacterProportions, [number, number]>;
  palette: (r: Rng) => CharacterPalette;
  syllables: string[];
}

const P = (head: [number, number], shoulders: [number, number], arms: [number, number], legs: [number, number], bulk: [number, number]) => ({ head, shoulders, arms, legs, bulk });

function scheme(r: Rng, base: number, sat: [number, number], light: [number, number], naturalSkin: boolean): CharacterPalette {
  const kind = r.pick(["analogous", "complementary", "triad", "split"] as const);
  const second = kind === "analogous" ? base + r.range(25, 45) : kind === "complementary" ? base + 180 : kind === "triad" ? base + 120 : base + 150;
  const third = kind === "triad" ? base + 240 : kind === "split" ? base + 210 : base + r.range(-40, -20);
  const s = r.range(sat[0], sat[1]);
  const l = r.range(light[0], light[1]);
  return {
    skin: naturalSkin ? r.pick(SKIN_TONES) : hslToHex(base + r.range(-20, 20), s * 0.7, Math.min(82, l + 30)),
    primary: hslToHex(base, s, l),
    secondary: hslToHex(second, s * 0.8, l * 0.75),
    accent: hslToHex(third, r.range(70, 95), r.range(50, 62)),
    glow: hslToHex(r.chance(0.5) ? second : third, 95, r.range(62, 74)),
    hair: hslToHex(r.chance(0.6) ? base + r.range(-30, 30) : r.range(0, 360), r.range(20, 70), r.range(18, 60)),
  };
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "wild",
    label: "Anything",
    description: "Every part and colour is fair game",
    weights: {},
    proportions: P([0.6, 1.8], [0.7, 1.5], [0.6, 1.6], [0.5, 1.5], [0.6, 1.8]),
    palette: (r) => scheme(r, r.range(0, 360), [35, 85], [30, 60], r.chance(0.3)),
    syllables: ["zo", "ra", "kai", "vex", "lu", "mor", "ith", "qua", "nel", "dra", "yo", "pim"],
  },
  {
    id: "knight",
    label: "Knight",
    description: "Armour, capes, swords and crowns",
    weights: {
      torso: { armored: 6, broad: 3 }, head: { round: 4, block: 3 }, face: { two: 5, visor: 4 }, hair: { sleek: 3, mech: 3, none: 2 },
      headgear: { none: 4, crown: 2, horns: 1, crest: 2 }, arms: { human: 6, mech: 1 }, legs: { human: 6, mech: 1 },
      back: { cape: 6, none: 2, feathers: 1 }, tail: { none: 10 }, prop: { sword: 5, shield: 4, staff: 1 },
    },
    proportions: P([0.85, 1.1], [1.0, 1.35], [0.9, 1.1], [0.9, 1.15], [1.0, 1.4]),
    palette: (r) => scheme(r, r.range(0, 360), [30, 55], [28, 42], true),
    syllables: ["al", "dric", "ber", "wyn", "ga", "len", "ros", "mund", "hel", "ard", "is", "ten"],
  },
  {
    id: "beast",
    label: "Beast",
    description: "Muzzles, manes, paws and tails",
    weights: {
      torso: { broad: 3, round: 3, slim: 1 }, head: { beast: 8, beak: 2 }, face: { two: 5, slits: 4, three: 1 }, hair: { mane: 5, none: 3, quantum: 1 },
      headgear: { "cat-ears": 4, horns: 3, antlers: 3, "long-ears": 2, none: 1 }, arms: { claws: 6, human: 2 }, legs: { beast: 7, hooves: 3 },
      back: { none: 6, bat: 1, feathers: 1 }, tail: { long: 3, fluffy: 4, spiked: 2 }, prop: { none: 8 },
    },
    proportions: P([0.9, 1.3], [1.0, 1.4], [0.8, 1.2], [0.7, 1.05], [1.1, 1.7]),
    palette: (r) => scheme(r, r.pick([20, 30, 40, 90, 120, 200]) + r.range(-10, 10), [30, 60], [30, 50], false),
    syllables: ["gr", "ok", "tha", "rum", "bar", "ka", "fen", "ur", "sha", "rak", "mo", "gor"],
  },
  {
    id: "spirit",
    label: "Spirit",
    description: "Wisps, halos, orbs and flowing hair",
    weights: {
      torso: { core: 5, robe: 4, slim: 1 }, head: { orb: 5, long: 3, round: 2 }, face: { one: 3, slits: 3, two: 2, many: 1 }, hair: { ethereal: 5, none: 3 },
      headgear: { halo: 5, antenna: 1, none: 3, "long-ears": 1 }, arms: { tentacle: 3, human: 3, none: 2 }, legs: { wisp: 8, human: 1 },
      back: { crystals: 4, insect: 3, none: 2 }, tail: { ribbon: 5, none: 4 }, prop: { orb: 4, lantern: 4, none: 2 },
    },
    proportions: P([0.8, 1.4], [0.7, 1.0], [0.9, 1.4], [0.8, 1.2], [0.6, 0.9]),
    palette: (r) => scheme(r, r.range(170, 300), [45, 80], [45, 65], false),
    syllables: ["ae", "li", "sol", "vi", "ra", "mi", "lune", "el", "is", "the", "ria", "nyx"],
  },
  {
    id: "machine",
    label: "Machine",
    description: "Visors, plating, pistons and jets",
    weights: {
      torso: { armored: 4, broad: 3, core: 2 }, head: { block: 7, orb: 2 }, face: { visor: 6, one: 3, many: 1 }, hair: { mech: 5, none: 5 },
      headgear: { antenna: 5, crest: 2, none: 3 }, arms: { mech: 7, blade: 3 }, legs: { mech: 8, arachnid: 2 },
      back: { jetpack: 5, none: 3, crystals: 1 }, tail: { none: 6, spiked: 1, scorpion: 1 }, prop: { none: 4, shield: 2, orb: 2 },
    },
    proportions: P([0.7, 1.1], [1.0, 1.5], [0.9, 1.3], [0.8, 1.2], [0.8, 1.3]),
    palette: (r) => {
      const p = scheme(r, r.range(0, 360), [5, 18], [30, 48], false);
      p.accent = hslToHex(r.range(0, 360), 95, 55);
      p.glow = hslToHex(r.pick([180, 140, 20, 300, 50]), 100, 60);
      return p;
    },
    syllables: ["ax", "ion", "vec", "tor", "kx", "ze", "ta", "nod", "ro", "q", "dyn", "ul"],
  },
  {
    id: "insect",
    label: "Insectoid",
    description: "Many eyes, antennae, wings and legs",
    weights: {
      torso: { slim: 4, round: 3, armored: 2 }, head: { long: 4, round: 2, orb: 1 }, face: { many: 6, three: 3, two: 1 }, hair: { none: 8, quantum: 1 },
      headgear: { antenna: 7, crest: 2, horns: 1 }, arms: { claws: 4, blade: 4, tentacle: 1 }, legs: { arachnid: 6, human: 2, mech: 1 },
      back: { insect: 8, none: 1 }, tail: { scorpion: 3, none: 5, spiked: 1 }, prop: { none: 8 },
    },
    proportions: P([0.7, 1.1], [0.7, 1.1], [1.0, 1.6], [0.8, 1.3], [0.6, 0.9]),
    palette: (r) => scheme(r, r.pick([80, 110, 160, 280, 40]) + r.range(-15, 15), [55, 85], [30, 50], false),
    syllables: ["zz", "chi", "tik", "vri", "sk", "kla", "zi", "ix", "chit", "rr", "ki", "ess"],
  },
  {
    id: "celestial",
    label: "Celestial",
    description: "Feathered wings, crowns, staffs and starlight",
    weights: {
      torso: { robe: 5, slim: 2, core: 2 }, head: { round: 4, long: 3, orb: 2 }, face: { two: 4, one: 2, slits: 2 }, hair: { ethereal: 5, sleek: 2 },
      headgear: { halo: 4, crown: 4, "long-ears": 1 }, arms: { human: 6, none: 1 }, legs: { human: 4, wisp: 3 },
      back: { feathers: 7, crystals: 2 }, tail: { none: 7, ribbon: 3 }, prop: { staff: 5, orb: 3, lantern: 1 },
    },
    proportions: P([0.85, 1.1], [0.85, 1.15], [0.95, 1.2], [1.0, 1.35], [0.7, 1.0]),
    palette: (r) => {
      const p = scheme(r, r.range(215, 260), [40, 70], [22, 38], r.chance(0.4));
      p.accent = hslToHex(r.range(40, 52), 90, 58);
      p.glow = hslToHex(r.range(40, 60), 100, 80);
      return p;
    },
    syllables: ["ser", "aph", "el", "ari", "on", "ce", "les", "thi", "ra", "ion", "vae", "sun"],
  },
];

export const archetypeById = (id: string) => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[0];

/* ---------- Parts ---------- */

function pickPart(r: Rng, slot: PartSlot, arch: Archetype): string {
  const options = SLOTS.find((s) => s.slot === slot)!.options;
  const weights = arch.weights[slot];
  // Unlisted parts keep a small chance so archetypes still surprise
  const base = weights ? 0.25 : 1;
  const w = options.map((o) => weights?.[o.id] ?? base);
  let roll = r.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= w[i];
    if (roll <= 0) return options[i].id;
  }
  return options[0].id;
}

/** Keep combinations that would look broken out of the result. */
function tidy(parts: Record<PartSlot, string>): Record<PartSlot, string> {
  const out = { ...parts };
  if (out.arms === "none" && ["sword", "shield", "staff", "lantern"].includes(out.prop)) out.prop = "orb";
  if (out.head === "orb" && out.hair !== "none" && out.hair !== "ethereal") out.hair = "none";
  return out;
}

const ALL_SLOTS = SLOTS.map((s) => s.slot);

export type LockKey = PartSlot | "colours" | "proportions";

function clampProportions(p: CharacterProportions): CharacterProportions {
  const c = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)) * 100) / 100;
  return { head: c(p.head, 0.6, 1.8), shoulders: c(p.shoulders, 0.7, 1.5), arms: c(p.arms, 0.6, 1.6), legs: c(p.legs, 0.5, 1.6), bulk: c(p.bulk, 0.6, 1.8) };
}

/* ---------- Generate ---------- */

/** A brand-new character. Locked slots, colours or proportions are kept from `base`. */
export function randomBuild(seed: number, archetypeId: string, base?: CharacterBuild, locks: Set<LockKey> = new Set()): CharacterBuild {
  const arch = archetypeById(archetypeId);
  const r = rng(seed);
  const parts = Object.fromEntries(ALL_SLOTS.map((slot) => [slot, base && locks.has(slot) ? base.parts[slot] : pickPart(r, slot, arch)])) as Record<PartSlot, string>;
  const proportions =
    base && locks.has("proportions")
      ? base.proportions
      : clampProportions(Object.fromEntries(Object.entries(arch.proportions).map(([k, [lo, hi]]) => [k, r.range(lo, hi)])) as unknown as CharacterProportions);
  const palette = base && locks.has("colours") ? base.palette : arch.palette(r);
  return { seed, archetype: arch.id, parts: tidy(parts), proportions, palette };
}

/** Change a design a little (one part, small shifts) or a lot (several parts, new colours). */
export function mutate(build: CharacterBuild, strength: "small" | "wild", seed: number, locks: Set<LockKey> = new Set()): CharacterBuild {
  const r = rng(seed);
  const arch = archetypeById(build.archetype);
  const parts = { ...build.parts };
  const open = ALL_SLOTS.filter((s) => !locks.has(s));
  const changes = strength === "small" ? (r.chance(0.7) ? 1 : 0) : 3 + Math.floor(r.next() * 3);
  for (let i = 0; i < changes && open.length; i++) {
    const slot = r.pick(open);
    // Wild mutations ignore the archetype, so anything can appear
    parts[slot] = pickPart(r, slot, strength === "wild" && r.chance(0.5) ? ARCHETYPES[0] : arch);
  }
  const spread = strength === "small" ? 0.12 : 0.4;
  const proportions = locks.has("proportions")
    ? build.proportions
    : clampProportions(Object.fromEntries(Object.entries(build.proportions).map(([k, v]) => [k, v * (1 + r.range(-spread, spread))])) as unknown as CharacterProportions);
  let palette = build.palette;
  if (!locks.has("colours")) {
    if (strength === "wild" && r.chance(0.6)) palette = (r.chance(0.5) ? arch : ARCHETYPES[0]).palette(r);
    else {
      const shift = r.range(-1, 1) * (strength === "small" ? 22 : 90);
      palette = Object.fromEntries(Object.entries(build.palette).map(([k, v]) => [k, k === "skin" && r.chance(0.6) ? v : shiftHue(v, shift)])) as unknown as CharacterPalette;
    }
  }
  return { seed, archetype: build.archetype, parts: tidy(parts), proportions, palette };
}

/** Offspring of two designs: each slot from one parent, blended proportions and colours. */
export function breed(a: CharacterBuild, b: CharacterBuild, seed: number, locks: Set<LockKey> = new Set(), base: CharacterBuild = a): CharacterBuild {
  const r = rng(seed);
  const parts = Object.fromEntries(ALL_SLOTS.map((slot) => [slot, locks.has(slot) ? base.parts[slot] : r.chance(0.5) ? a.parts[slot] : b.parts[slot]])) as Record<PartSlot, string>;
  const proportions = locks.has("proportions")
    ? base.proportions
    : clampProportions(
        Object.fromEntries(
          (Object.keys(a.proportions) as (keyof CharacterProportions)[]).map((k) => [k, ((a.proportions[k] + b.proportions[k]) / 2) * (1 + r.range(-0.08, 0.08))]),
        ) as unknown as CharacterProportions,
      );
  const palette = locks.has("colours")
    ? base.palette
    : (Object.fromEntries((Object.keys(a.palette) as (keyof CharacterPalette)[]).map((k) => [k, r.chance(0.5) ? a.palette[k] : b.palette[k]])) as unknown as CharacterPalette);
  return { seed, archetype: r.chance(0.5) ? a.archetype : b.archetype, parts: tidy(parts), proportions, palette };
}

/* ---------- Names ---------- */

const EPITHETS: [(b: CharacterBuild) => boolean, string[]][] = [
  [(b) => b.parts.back === "feathers", ["the Winged", "Featherborn"]],
  [(b) => b.parts.back === "bat", ["Duskwing", "of the Night Wing"]],
  [(b) => b.parts.head === "orb", ["the Lantern-Headed", "Glowhead"]],
  [(b) => b.parts.face === "many", ["of Many Eyes", "the Watcher"]],
  [(b) => b.parts.face === "one", ["One-Eye", "the Seer"]],
  [(b) => b.parts.tail === "scorpion", ["Stingtail", "the Venomous"]],
  [(b) => b.parts.headgear === "crown", ["the Crowned", "First of the Court"]],
  [(b) => b.parts.headgear === "halo", ["the Haloed", "the Kind"]],
  [(b) => b.parts.headgear === "antlers", ["Antlerborn", "of the Deep Wood"]],
  [(b) => b.parts.legs === "arachnid", ["Sixfoot", "the Skittering"]],
  [(b) => b.parts.legs === "wisp", ["the Drifting", "Halfway-There"]],
  [(b) => b.parts.prop === "staff", ["the Sage", "Staffbearer"]],
  [(b) => b.parts.prop === "sword", ["Blade-Sworn", "the Bold"]],
  [(b) => b.parts.prop === "lantern", ["Lamplighter", "the Wayfinder"]],
  [(b) => b.parts.arms === "tentacle", ["Manyhands", "of the Tide"]],
  [(b) => b.parts.back === "jetpack", ["Skyburner", "the Swift"]],
];

/** A pronounceable name with an epithet earned from the design. Same build, same name. */
export function nameFor(build: CharacterBuild): string {
  const r = rng(build.seed ^ 0x9e3779b9);
  const syl = archetypeById(build.archetype).syllables;
  const count = r.chance(0.55) ? 2 : 3;
  let name = "";
  for (let i = 0; i < count; i++) name += r.pick(syl);
  name = name.replace(/(.)\1\1+/g, "$1$1");
  while (name.replace(/[^a-z]/gi, "").length < 4) name += r.pick(syl);
  name = name[0].toUpperCase() + name.slice(1);
  if (build.archetype === "machine") name = `${name.toUpperCase().slice(0, 3)}-${Math.floor(r.range(2, 99))}`;
  const earned = EPITHETS.filter(([test]) => test(build)).flatMap(([, names]) => names);
  return earned.length ? `${name} ${r.pick(earned)}` : name;
}

/* ---------- Project character ---------- */

const HAIR_STYLES = ["sleek", "quantum", "mech", "ethereal"] as const;

/** A project character from a build; keeps the legacy colour fields in step for the portrait studio. */
export function lookFromBuild(build: CharacterBuild, id: string, name: string): CharacterLook {
  return {
    id,
    name,
    skin: build.palette.skin,
    hair: build.palette.hair,
    eyes: build.palette.glow,
    costume: build.palette.primary,
    accent: build.palette.accent,
    hairStyle: (HAIR_STYLES as readonly string[]).includes(build.parts.hair) ? (build.parts.hair as CharacterLook["hairStyle"]) : "sleek",
    build,
  };
}
