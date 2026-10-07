import type { CameraMotion, ElementSpec, MusicPreset, ParticleSpec, Scene, Storyboard, VisualPreset } from "../types";

/*
 * Offline storyboard composer. Reads keywords in the idea, picks motifs,
 * a palette from the visual style and a four-beat story arc, then lays out
 * scenes with camera moves, layered shapes and particles. Seeded, so the same
 * idea + seed always gives the same draft; "reroll" just changes the seed.
 */

export interface BuildOptions {
  idea: string;
  style: VisualPreset;
  mood: MusicPreset;
  sceneCount: number;
  seed: number;
}

/* ---------- Randomness ---------- */

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
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
  };
}
type Rng = ReturnType<typeof rng>;

/* ---------- Colour ---------- */

export function mix(hexA: string, hexB: string, amount: number) {
  const a = parseInt(hexA.slice(1, 7), 16);
  const b = parseInt(hexB.slice(1, 7), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

export const STYLE_PALETTES: Record<VisualPreset, { bg: [string, string, string]; accent: string; element: string; particle: ParticleSpec["type"] }> = {
  cinema: { bg: ["#050811", "#121b2d", "#22354e"], accent: "#ffaa00", element: "#e5e9f0", particle: "dust-motes" },
  cyberpunk: { bg: ["#0b0416", "#20063b", "#021c35"], accent: "#ff007f", element: "#00ffff", particle: "rain" },
  anime: { bg: ["#1c1a2e", "#442e61", "#875e9c"], accent: "#ff8da1", element: "#ffffff", particle: "cherry-blossoms" },
  watercolor: { bg: ["#f7f3e8", "#ebdcb9", "#c9b69b"], accent: "#db7b7b", element: "#336699", particle: "dust-motes" },
  vaporwave: { bg: ["#120826", "#4c1c5c", "#8c2e6b"], accent: "#00f0ff", element: "#ff00ff", particle: "stars" },
  "line-art": { bg: ["#0a0a0a", "#1a1a1a", "#2a2a2a"], accent: "#ffffff", element: "#888888", particle: "dust-motes" },
  "retro-pixel": { bg: ["#05020c", "#18002d", "#002824"], accent: "#ffbc00", element: "#00ff66", particle: "stars" },
  "oil-painting": { bg: ["#1e140d", "#402312", "#5c3315"], accent: "#df7f2e", element: "#bfa37a", particle: "dust-motes" },
};

/* ---------- Motifs ---------- */

type ElementTemplate = Pick<ElementSpec, "type" | "shape" | "movement" | "depth"> & {
  size: [number, number];
  x: [number, number];
  y: [number, number];
  color: "accent" | "element" | "dark" | "light";
  details: string;
};

interface Motif {
  id: string;
  keys: string[];
  nouns: string[];
  particle: ParticleSpec["type"];
  setting: string;
  elements: ElementTemplate[];
}

const MOTIFS: Motif[] = [
  {
    id: "space",
    keys: ["space", "star", "stars", "cosmic", "cosmos", "moon", "galaxy", "planet", "astronaut", "nebula", "orbit", "rocket", "comet", "universe"],
    nouns: ["Orbit", "Void", "Starlight", "Horizon", "Signal", "Gravity"],
    particle: "stars",
    setting: "the deep quiet of space",
    elements: [
      { type: "layered-shape", shape: "circle", movement: "pulse", depth: 2, size: [110, 190], x: [35, 65], y: [35, 55], color: "accent", details: "A glowing planet" },
      { type: "starfield", shape: "star", movement: "float", depth: 3, size: [40, 80], x: [65, 85], y: [20, 40], color: "light", details: "A bright star" },
      { type: "abstract-mesh", shape: "ring", movement: "rotate", depth: 1, size: [240, 340], x: [40, 60], y: [40, 60], color: "element", details: "An orbit ring" },
    ],
  },
  {
    id: "ocean",
    keys: ["sea", "ocean", "water", "underwater", "wave", "waves", "river", "lake", "fish", "tide", "whale", "coral", "rain"],
    nouns: ["Tide", "Deep", "Current", "Shore", "Undertow", "Reef"],
    particle: "bubbles",
    setting: "water that never stops moving",
    elements: [
      { type: "abstract-mesh", shape: "spline", movement: "glide", depth: 1, size: [300, 400], x: [40, 60], y: [65, 80], color: "element", details: "A rolling wave" },
      { type: "layered-shape", shape: "circle", movement: "float", depth: 2, size: [60, 120], x: [25, 75], y: [30, 55], color: "accent", details: "A drifting light" },
      { type: "abstract-mesh", shape: "spline", movement: "glide", depth: 3, size: [260, 380], x: [45, 60], y: [82, 92], color: "dark", details: "A foreground swell" },
    ],
  },
  {
    id: "forest",
    keys: ["forest", "tree", "trees", "garden", "flower", "flowers", "leaf", "leaves", "wood", "woods", "jungle", "spring", "bloom", "moss", "fox", "deer"],
    nouns: ["Grove", "Canopy", "Bloom", "Root", "Clearing", "Wild"],
    particle: "cherry-blossoms",
    setting: "an old forest holding its breath",
    elements: [
      { type: "landscape-silhouette", shape: "polygon", movement: "none", depth: 3, size: [260, 380], x: [10, 30], y: [80, 92], color: "dark", details: "A dark pine" },
      { type: "landscape-silhouette", shape: "polygon", movement: "none", depth: 3, size: [220, 340], x: [70, 90], y: [80, 92], color: "dark", details: "A second pine" },
      { type: "layered-shape", shape: "circle", movement: "pulse", depth: 1, size: [90, 150], x: [45, 60], y: [25, 40], color: "accent", details: "Light through the leaves" },
    ],
  },
  {
    id: "city",
    keys: ["city", "neon", "street", "cyber", "cyberpunk", "arcade", "tower", "metro", "night", "robot", "machine", "android", "hacker", "skyline", "car"],
    nouns: ["Grid", "Skyline", "Circuit", "Signal", "Underpass", "Neon"],
    particle: "rain",
    setting: "a city that never powers down",
    elements: [
      { type: "landscape-silhouette", shape: "rect", movement: "none", depth: 3, size: [180, 280], x: [12, 28], y: [75, 88], color: "dark", details: "A tower block" },
      { type: "landscape-silhouette", shape: "rect", movement: "none", depth: 2, size: [150, 240], x: [70, 88], y: [72, 86], color: "dark", details: "A far tower" },
      { type: "geometric-grid", shape: "line", movement: "glide", depth: 1, size: [320, 400], x: [45, 55], y: [82, 90], color: "accent", details: "A neon horizon line" },
      { type: "vector-icon", shape: "ring", movement: "pulse", depth: 2, size: [70, 120], x: [45, 60], y: [30, 45], color: "element", details: "A sign glowing in the rain" },
    ],
  },
  {
    id: "fire",
    keys: ["fire", "flame", "flames", "ember", "embers", "phoenix", "sun", "volcano", "burn", "burning", "heat", "dragon", "forge", "lava"],
    nouns: ["Ember", "Pyre", "Forge", "Ash", "Flare", "Kiln"],
    particle: "sparks",
    setting: "heat rising from below",
    elements: [
      { type: "layered-shape", shape: "circle", movement: "pulse", depth: 1, size: [180, 280], x: [45, 55], y: [55, 70], color: "accent", details: "A furnace glow" },
      { type: "landscape-silhouette", shape: "polygon", movement: "none", depth: 3, size: [300, 400], x: [40, 60], y: [85, 95], color: "dark", details: "A ridge of black rock" },
      { type: "starfield", shape: "star", movement: "rotate", depth: 2, size: [50, 90], x: [30, 70], y: [25, 40], color: "light", details: "A spark caught mid-air" },
    ],
  },
  {
    id: "winter",
    keys: ["snow", "ice", "winter", "frost", "cold", "mountain", "mountains", "glacier", "arctic", "peak"],
    nouns: ["Frost", "Summit", "Silence", "White", "Thaw", "Ridge"],
    particle: "snow",
    setting: "a white silence on the mountain",
    elements: [
      { type: "landscape-silhouette", shape: "polygon", movement: "none", depth: 1, size: [320, 400], x: [30, 45], y: [70, 82], color: "element", details: "A far peak" },
      { type: "landscape-silhouette", shape: "polygon", movement: "none", depth: 3, size: [260, 380], x: [65, 85], y: [82, 94], color: "dark", details: "A near slope" },
      { type: "layered-shape", shape: "circle", movement: "pulse", depth: 2, size: [70, 110], x: [60, 80], y: [20, 30], color: "light", details: "A pale sun" },
    ],
  },
  {
    id: "desert",
    keys: ["desert", "sand", "dune", "dunes", "dust", "canyon", "nomad", "mirage", "oasis"],
    nouns: ["Dune", "Mirage", "Drift", "Expanse", "Caravan", "Noon"],
    particle: "dust-motes",
    setting: "an endless shimmer of sand",
    elements: [
      { type: "layered-shape", shape: "circle", movement: "pulse", depth: 1, size: [200, 300], x: [55, 70], y: [35, 50], color: "accent", details: "A huge low sun" },
      { type: "abstract-mesh", shape: "spline", movement: "glide", depth: 2, size: [320, 400], x: [40, 55], y: [72, 82], color: "element", details: "A dune line" },
      { type: "abstract-mesh", shape: "spline", movement: "glide", depth: 3, size: [300, 400], x: [50, 65], y: [86, 94], color: "dark", details: "A near dune" },
    ],
  },
];

const DREAM: Motif = {
  id: "dream",
  keys: [],
  nouns: ["Echo", "Threshold", "Vision", "Light", "Passage", "Dream"],
  particle: "dust-motes",
  setting: "a place between waking and dreaming",
  elements: [
    { type: "abstract-mesh", shape: "ring", movement: "rotate", depth: 1, size: [260, 360], x: [45, 55], y: [42, 55], color: "element", details: "A slow halo" },
    { type: "layered-shape", shape: "circle", movement: "pulse", depth: 2, size: [100, 160], x: [42, 58], y: [40, 55], color: "accent", details: "A core of light" },
    { type: "vector-icon", shape: "star", movement: "float", depth: 3, size: [40, 70], x: [20, 80], y: [20, 35], color: "light", details: "A wandering spark" },
  ],
};

export const MOTIF_IDS = [...MOTIFS.map((m) => m.id), DREAM.id];

function detectMotifs(idea: string): Motif[] {
  const words = idea.toLowerCase().match(/[a-z]+/g) ?? [];
  const scored = MOTIFS.map((m) => ({ m, score: words.filter((w) => m.keys.includes(w)).length })).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.length ? scored.slice(0, 2).map((s) => s.m) : [DREAM];
}

/* ---------- Story arc ---------- */

const STOPWORDS = new Set(
  "a an the of on in at to for from with and or but is are was were be by into onto over under about its it this that his her their our your my as who what when where while than then".split(" "),
);

function keyword(idea: string) {
  const words = (idea.match(/[A-Za-z']+/g) ?? []).filter((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 2);
  if (!words.length) return null;
  const w = words[0];
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

const BEATS = [
  {
    name: "Opening",
    titles: ["The {N}", "Before the {N}", "{N} at Rest", "First {N}"],
    lines: [
      "It begins quietly: {idea}.",
      "Nothing moves yet. Only {setting}, and {idea}.",
      "Here is where it starts — {idea}.",
    ],
    camera: { type: "zoom-in", speed: "slow", scaleStart: 1, scaleEnd: 1.15, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
  },
  {
    name: "Rising",
    titles: ["Into the {N}", "The {N} Stirs", "Following the {N}", "Signal from the {N}"],
    lines: [
      "Something stirs in {setting}, and it is getting closer.",
      "The first sign appears, small enough to miss.",
      "We follow it further than we meant to go.",
    ],
    camera: { type: "pan-right", speed: "medium", scaleStart: 1.05, scaleEnd: 1.05, xStart: -20, xEnd: 20, yStart: 0, yEnd: 0 },
  },
  {
    name: "Turn",
    titles: ["The {N} Breaks", "Heart of the {N}", "Against the {N}", "{N} Unbound"],
    lines: [
      "Then everything turns at once.",
      "The quiet breaks, and the light comes pouring through.",
      "For one held breath, the whole world tilts.",
    ],
    camera: { type: "parallax-tilt", speed: "fast", scaleStart: 1.1, scaleEnd: 1.25, xStart: 15, xEnd: -15, yStart: -10, yEnd: 10 },
  },
  {
    name: "Resolution",
    titles: ["After the {N}", "The {N} Returns", "A New {N}", "Last {N}"],
    lines: [
      "And when it settles, nothing is quite the same.",
      "The light fades slowly, leaving {setting} changed.",
      "We pull back, and see how far we came.",
    ],
    camera: { type: "zoom-out", speed: "slow", scaleStart: 1.2, scaleEnd: 1, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
  },
] as const;

// Which beat each scene uses for 3-6 scenes
const ARC: Record<number, number[]> = {
  3: [0, 2, 3],
  4: [0, 1, 2, 3],
  5: [0, 1, 1, 2, 3],
  6: [0, 1, 1, 2, 2, 3],
};

const MOOD_TIMING: Record<MusicPreset, { bpm: number; scale: Storyboard["scale"]; duration: [number, number] }> = {
  ambient: { bpm: 72, scale: "pentatonic", duration: [6, 7.5] },
  cinematic: { bpm: 90, scale: "minor", duration: [5, 6.5] },
  lofi: { bpm: 80, scale: "major", duration: [5, 6] },
  synthwave: { bpm: 118, scale: "phrygian", duration: [4, 5.5] },
  chiptune: { bpm: 132, scale: "major", duration: [3.5, 4.5] },
};

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w, offset: number) =>
    offset > 0 && STOPWORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1),
  );
}

/** The idea itself if short, else its first seven words, never ending on "on", "a" and the like. */
function shortTitle(idea: string) {
  const all = idea.split(/\s+/);
  const words = all.length <= 9 ? all : all.slice(0, 7);
  while (words.length > 2 && STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  return titleCase(words.join(" "));
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function makeElement(t: ElementTemplate, r: Rng, colors: Record<ElementTemplate["color"], string>): ElementSpec {
  return {
    type: t.type,
    shape: t.shape,
    movement: t.movement,
    depth: t.depth,
    size: Math.round(r.range(t.size[0], t.size[1])),
    position: { x: Math.round(r.range(t.x[0], t.x[1])), y: Math.round(r.range(t.y[0], t.y[1])) },
    color: colors[t.color],
    details: t.details,
  };
}

/* ---------- Build ---------- */

export function buildStoryboard(opts: BuildOptions): Storyboard {
  const idea = opts.idea.trim().replace(/[.!?]+$/, "") || "A light that refuses to go out";
  const r = rng(hashString(idea) ^ opts.seed);
  const motifs = detectMotifs(idea);
  const primary = motifs[0];
  const palette = STYLE_PALETTES[opts.style] ?? STYLE_PALETTES.cinema;
  const timing = MOOD_TIMING[opts.mood] ?? MOOD_TIMING.ambient;
  const count = Math.min(6, Math.max(3, Math.round(opts.sceneCount)));
  const noun = keyword(idea);
  const nouns = noun ? [noun, ...primary.nouns] : primary.nouns;
  const lowerIdea = idea[0].toLowerCase() + idea.slice(1);
  const used = new Set<string>();

  const scenes: Scene[] = ARC[count].map((beatIndex, i) => {
    const beat = BEATS[beatIndex];
    const motif = motifs[i % motifs.length];
    // Opening and resolution sit darker; the turn is the brightest moment
    const lift = beatIndex === 2 ? 0.18 : beatIndex === 1 ? 0.08 : 0;
    const gradient = palette.bg.map((c, k) => mix(c, palette.accent, lift * (k / 2)));
    const colors = {
      accent: palette.accent,
      element: palette.element,
      dark: mix(palette.bg[0], "#000000", 0.4),
      light: mix(palette.element, "#ffffff", 0.5),
    };

    let title = "";
    for (let tries = 0; tries < 6 && (!title || used.has(title)); tries++) {
      title = fill(r.pick(beat.titles), { N: r.pick(nouns) });
    }
    used.add(title);

    const elements = motif.elements.map((t) => makeElement(t, r, colors));
    if (beatIndex === 2) {
      elements.push(makeElement(DREAM.elements[0], r, colors));
    }

    const camera: CameraMotion = { ...beat.camera };
    if (beatIndex === 1 && r.next() > 0.5) {
      camera.type = "pan-left";
      [camera.xStart, camera.xEnd] = [camera.xEnd, camera.xStart];
    }

    return {
      sceneNumber: i + 1,
      title,
      duration: Math.round(r.range(timing.duration[0], timing.duration[1]) * 2) / 2,
      narration: fill(r.pick(beat.lines), { idea: lowerIdea, setting: motif.setting }),
      visualDescription: `${beat.name}: ${motif.setting}. ${elements.map((e) => e.details).join(", ")}.`,
      backgroundColor: gradient[0],
      accentColor: palette.accent,
      gradientColors: gradient,
      cameraMotion: camera,
      // Soft dissolves, with a harder cut into the climax
      transition: i === 0 ? "cut" : beatIndex === 2 ? (opts.mood === "synthwave" || opts.mood === "chiptune" ? "flash" : "zoom") : "fade",
      elements,
      particles: {
        type: i === 0 ? motif.particle : r.next() > 0.3 ? motif.particle : palette.particle,
        count: Math.round(r.range(35, beatIndex === 2 ? 90 : 60)),
        color: beatIndex === 2 ? palette.accent : colors.light,
        speed: beatIndex === 2 ? 1.8 : 1,
        size: Math.round(r.range(2, 3.5) * 10) / 10,
      },
    };
  });

  return {
    title: shortTitle(idea),
    summary: `A ${count}-scene ${opts.style.replace("-", " ")} short about ${lowerIdea}.`,
    visualStyle: opts.style,
    musicVibe: opts.mood,
    tempoBpm: timing.bpm,
    scale: timing.scale,
    scenes,
  };
}

/** A fresh, editable blank scene that matches the storyboard's palette. */
export function blankScene(board: Storyboard | null, number: number): Scene {
  const palette = STYLE_PALETTES[(board?.visualStyle as VisualPreset) ?? "cinema"] ?? STYLE_PALETTES.cinema;
  return {
    sceneNumber: number,
    title: "New scene",
    duration: 5,
    narration: "",
    visualDescription: "",
    backgroundColor: palette.bg[0],
    accentColor: palette.accent,
    gradientColors: [...palette.bg],
    cameraMotion: { type: "drift", speed: "slow", scaleStart: 1, scaleEnd: 1.08, xStart: -8, xEnd: 8, yStart: 0, yEnd: 0 },
    elements: [],
    particles: { type: palette.particle, count: 40, color: palette.element, speed: 1, size: 2.5 },
  };
}

/* ---------- Recolouring ---------- */

export interface Palette {
  bg: [string, string, string];
  accent: string;
  element: string;
  particle?: ParticleSpec["type"];
}

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Recolour every scene with a new palette while keeping the layout: shapes,
 * camera, timing and text stay as they are. Middle scenes get a little more
 * light so the arc still builds.
 */
export function applyPalette(board: Storyboard, pal: Palette, style?: VisualPreset): Storyboard {
  const n = board.scenes.length;
  return {
    ...board,
    visualStyle: style ?? board.visualStyle,
    scenes: board.scenes.map((s, i) => {
      const mid = n > 2 && i > 0 && i < n - 1 ? 0.12 : 0;
      const gradient = pal.bg.map((c, k) => mix(c, pal.accent, mid * (k / 2)));
      const dark = mix(pal.bg[0], "#000000", 0.4);
      const light = mix(pal.element, "#ffffff", 0.5);
      return {
        ...s,
        backgroundColor: gradient[0],
        accentColor: pal.accent,
        gradientColors: gradient,
        elements: s.elements.map((el) => {
          const lum = luminance(el.color);
          const color =
            el.color.toLowerCase() === s.accentColor.toLowerCase() ? pal.accent : lum < 0.12 ? dark : lum > 0.8 ? light : pal.element;
          return { ...el, color };
        }),
        particles: {
          ...s.particles,
          type: pal.particle && s.particles.type !== "none" ? pal.particle : s.particles.type,
          color: s.particles.color.toLowerCase() === s.accentColor.toLowerCase() ? pal.accent : light,
        },
      };
    }),
  };
}
