import type { MusicPreset, ParticleSpec, VisualPreset } from "../types";
import type { Palette } from "./builder";

export interface Look {
  id: string;
  name: string;
  description: string;
  style: VisualPreset;
  mood: MusicPreset;
  palette: Palette;
  motifs: string[];
  tags: string[];
}

const p = (bg: [string, string, string], accent: string, element: string, particle: ParticleSpec["type"]): Palette => ({ bg, accent, element, particle });

/** A hand-curated library of looks: palette, particles, score and motifs. */
export const LOOKS: Look[] = [
  {
    id: "neon-grid",
    name: "Neon grid retro-futurism",
    description: "Early-80s synth nights: saturated fuchsia and cyan on matte black, wireframe horizons, scanline glow.",
    style: "vaporwave",
    mood: "synthwave",
    palette: p(["#0a0014", "#1a0033", "#3a0a52"], "#ff007f", "#00ffff", "stars"),
    motifs: ["wireframe horizon", "low-poly sun", "CRT scanlines", "chrome lettering"],
    tags: ["retro", "neon", "80s", "synth", "night"],
  },
  {
    id: "rain-noir",
    name: "Rain-slick noir",
    description: "Wet asphalt, one cold streetlight, long shadows. Almost monochrome, with a single warm sign.",
    style: "cyberpunk",
    mood: "cinematic",
    palette: p(["#05070a", "#10161d", "#1d2731"], "#ff5a3c", "#9fb4c7", "rain"),
    motifs: ["streetlight cone", "reflections in puddles", "trench coat silhouette", "neon sign"],
    tags: ["city", "noir", "rain", "night", "detective"],
  },
  {
    id: "celestial",
    name: "Celestial dream",
    description: "Ink-dark sky bleeding into violet, a crescent moon, stars like spilled sugar.",
    style: "anime",
    mood: "ambient",
    palette: p(["#0f0c20", "#2b1b4d", "#5a3a7a"], "#e0aa3e", "#ffffff", "stars"),
    motifs: ["crescent moon", "fishing line of light", "floating islands", "constellations"],
    tags: ["space", "moon", "stars", "dream", "night"],
  },
  {
    id: "golden-hour",
    name: "Golden-hour realism",
    description: "Low amber sun, warm dust in the air, deep teal shadows. The look of the last good hour of the day.",
    style: "cinema",
    mood: "cinematic",
    palette: p(["#14181f", "#3a2a1a", "#8a5a24"], "#ffb703", "#f2e6d0", "dust-motes"),
    motifs: ["rim-lit silhouette", "lens flare", "long shadows", "dust in sunbeams"],
    tags: ["warm", "sunset", "film", "nature"],
  },
  {
    id: "deep-sea",
    name: "Bioluminescent deep",
    description: "Black water lit from within: cyan jellyfish glow, slow bubbles, a sense of enormous depth.",
    style: "cinema",
    mood: "ambient",
    palette: p(["#00070d", "#002233", "#004a5e"], "#3ef0d8", "#7fb8ff", "bubbles"),
    motifs: ["glowing jellyfish", "light shafts from above", "drifting particles", "silhouette of a whale"],
    tags: ["ocean", "water", "underwater", "glow"],
  },
  {
    id: "storybook-forest",
    name: "Storybook forest",
    description: "Soft watercolour greens and creams, petals on the wind, light pooling in a clearing.",
    style: "watercolor",
    mood: "lofi",
    palette: p(["#f4efe1", "#d9e2c4", "#9fb48a"], "#d9667b", "#3f6b4a", "cherry-blossoms"),
    motifs: ["mossy stones", "paper lanterns", "a fox in the ferns", "a clearing of light"],
    tags: ["forest", "nature", "spring", "gentle", "watercolour"],
  },
  {
    id: "forge",
    name: "Forge and ember",
    description: "Black rock, molten orange, sparks rising into smoke. Heat you can see.",
    style: "oil-painting",
    mood: "cinematic",
    palette: p(["#0d0604", "#2b0f06", "#5a1e08"], "#ff6a00", "#ffcf8a", "sparks"),
    motifs: ["anvil sparks", "lava cracks", "phoenix wings", "smoke columns"],
    tags: ["fire", "heat", "dragon", "epic"],
  },
  {
    id: "arctic",
    name: "Arctic silence",
    description: "Pale blue snowfields under a white sun. Very little colour, a lot of air.",
    style: "line-art",
    mood: "ambient",
    palette: p(["#c9d6e3", "#8fa6bd", "#4f6a85"], "#ffffff", "#203040", "snow"),
    motifs: ["lone figure in snow", "ice ridges", "breath in cold air", "aurora edge"],
    tags: ["snow", "winter", "cold", "minimal", "mountain"],
  },
  {
    id: "arcade",
    name: "8-bit arcade",
    description: "Hard primary colours on deep navy, pixel stars, a high-score glow.",
    style: "retro-pixel",
    mood: "chiptune",
    palette: p(["#05020c", "#0d1440", "#1a1a6e"], "#ffbc00", "#00ff66", "stars"),
    motifs: ["pixel hero", "power-up", "scrolling stars", "boss silhouette"],
    tags: ["game", "pixel", "retro", "arcade"],
  },
  {
    id: "desert-mirage",
    name: "Desert mirage",
    description: "Bleached sand, a vast pale-orange sun, heat shimmer and wind-blown dust.",
    style: "cinema",
    mood: "cinematic",
    palette: p(["#3a2414", "#8a5a30", "#d9a066"], "#ffe2a8", "#5a3418", "dust-motes"),
    motifs: ["caravan on the ridge", "heat shimmer", "ruined arch", "lone well"],
    tags: ["desert", "sand", "heat", "journey"],
  },
  {
    id: "brutalist",
    name: "Concrete brutalism",
    description: "Raw grey slabs, one red signal light, hard architectural shadows.",
    style: "line-art",
    mood: "synthwave",
    palette: p(["#1a1a1a", "#2e2e2e", "#4a4a4a"], "#ff3b30", "#bdbdbd", "dust-motes"),
    motifs: ["monolith", "stairwell", "red warning light", "empty plaza"],
    tags: ["city", "architecture", "minimal", "dystopia"],
  },
  {
    id: "pastel-pop",
    name: "Pastel pop",
    description: "Candy pinks and mint on a soft lilac sky, bouncy shapes, everything a little too cheerful.",
    style: "anime",
    mood: "lofi",
    palette: p(["#3b2a5a", "#7a5a9e", "#c9a3d9"], "#ff9ec7", "#a8f0d0", "bubbles"),
    motifs: ["floating balloons", "candy clouds", "sparkles", "round mascots"],
    tags: ["cute", "pastel", "pop", "playful"],
  },
];

export function searchLooks(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return LOOKS;
  const words = q.split(/\s+/);
  return LOOKS.map((look) => {
    const hay = `${look.name} ${look.description} ${look.tags.join(" ")} ${look.motifs.join(" ")}`.toLowerCase();
    return { look, score: words.filter((w) => hay.includes(w)).length };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.look);
}
