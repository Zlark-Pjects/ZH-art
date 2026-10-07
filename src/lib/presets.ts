import type { MusicPreset, VisualPreset } from "../types";

export const VISUAL_PRESETS: { id: VisualPreset; name: string; desc: string; swatch: string[] }[] = [
  { id: "cinema", name: "Cinema", desc: "Golden-hour, high-contrast shadows", swatch: ["#121b2d", "#ffaa00"] },
  { id: "cyberpunk", name: "Cyberpunk", desc: "Neon pink and electric cyan", swatch: ["#ff007f", "#00ffff"] },
  { id: "anime", name: "Anime sky", desc: "Pastel skies and drifting petals", swatch: ["#875e9c", "#ff8da1"] },
  { id: "watercolor", name: "Watercolor", desc: "Soft, bleeding paper tones", swatch: ["#ebdcb9", "#db7b7b"] },
  { id: "oil-painting", name: "Oil canvas", desc: "Thick layers, deep warm tones", swatch: ["#402312", "#df7f2e"] },
  { id: "vaporwave", name: "Vaporwave", desc: "Magenta sunsets, wireframe seas", swatch: ["#8c2e6b", "#00f0ff"] },
  { id: "line-art", name: "Line art", desc: "Monochrome wireframes", swatch: ["#1a1a1a", "#ffffff"] },
  { id: "retro-pixel", name: "Retro pixel", desc: "Saturated arcade palette", swatch: ["#ffbc00", "#00ff66"] },
];

export const MUSIC_PRESETS: { id: MusicPreset; name: string; desc: string }[] = [
  { id: "ambient", name: "Ambient", desc: "Long drones and space echoes" },
  { id: "synthwave", name: "Synthwave", desc: "Driving 80s bass and arpeggios" },
  { id: "cinematic", name: "Cinematic", desc: "Grand chords and bells" },
  { id: "lofi", name: "Lo-fi", desc: "Lazy jazz chords" },
  { id: "chiptune", name: "Chiptune", desc: "8-bit arcade arpeggios" },
];

export const SCALES = [
  { value: "pentatonic", label: "Pentatonic" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "phrygian", label: "Phrygian" },
] as const;

export type ScaleName = (typeof SCALES)[number]["value"];
