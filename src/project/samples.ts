import type { MusicPreset, Scene, Storyboard, VisualPreset } from "../types";

/** Hand-made sample films to start from, offered in the Build panel. */
export interface SampleFilm {
  id: string;
  name: string;
  category: string;
  description: string;
  visualStyle: VisualPreset;
  musicVibe: MusicPreset;
  prompt: string;
  bgGradient?: string;
  accent?: string;
  scenesCount: number;
  scenes: Scene[];
}

export const SAMPLE_FILMS: SampleFilm[] = [
  {
    id: "cyber_neon",
    name: "Cyberpunk Midnight Heist",
    category: "cyber",
    description: "Sleek cybernetic rain-slicked skyscrapers, neon grids, and futuristic hackers preparing for an orbital data breach.",
    visualStyle: "cyberpunk",
    musicVibe: "synthwave",
    prompt: "Neon heist hacker cyber matrix",
    bgGradient: "from-fg/[0.04] via-[#0e0a1a] to-black",
    accent: "text-fg border-fg/60 bg-fg/[0.05]",
    scenesCount: 3,
    scenes: [
      {
        sceneNumber: 1,
        title: "The Infiltration",
        duration: 4,
        narration: "Rain beats against the carbon-fiber roof as V5 unlocks the mainframe terminal.",
        visualDescription: "Sleek neon glowing cables tracing down dark terminal columns. Glowing cyber sparks floating around a holographic visor.",
        backgroundColor: "#0d0114",
        accentColor: "#ec4899",
        gradientColors: ["#02000a", "#120021", "#33003c"],
        cameraMotion: { type: "zoom-in", speed: "slow", scaleStart: 1.0, scaleEnd: 1.25, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
        elements: [
          { type: "layered-shape", shape: "ring", color: "#ec4899", size: 40, position: { x: 50, y: 40 }, movement: "pulse", depth: 2 },
          { type: "layered-shape", shape: "rect", color: "#06b6d4", size: 15, position: { x: 30, y: 70 }, movement: "float", depth: 3 }
        ],
        particles: { type: "sparks", count: 120, color: "#ec4899", speed: 2, size: 2 }
      },
      {
        sceneNumber: 2,
        title: "Decryption Wave",
        duration: 3,
        narration: "A wave of neon data pulses bursts outward, melting the security firewalls.",
        visualDescription: "A massive geometric grid structure pulsing rapidly in electric turquoise and magenta.",
        backgroundColor: "#010915",
        accentColor: "#06b6d4",
        gradientColors: ["#00030a", "#010f21", "#021c38"],
        cameraMotion: { type: "pan-right", speed: "medium", scaleStart: 1.1, scaleEnd: 1.1, xStart: -10, xEnd: 10, yStart: 0, yEnd: 0 },
        elements: [
          { type: "geometric-grid", shape: "line", color: "#06b6d4", size: 90, position: { x: 50, y: 50 }, movement: "rotate", depth: 1 },
          { type: "layered-shape", shape: "circle", color: "#ec4899", size: 25, position: { x: 75, y: 30 }, movement: "pulse", depth: 3 }
        ],
        particles: { type: "stars", count: 80, color: "#06b6d4", speed: 4, size: 1.5 }
      },
      {
        sceneNumber: 3,
        title: "Escape Protocol",
        duration: 5,
        narration: "Emergency sirens wail as the team flees into the neon twilight of Neo-Tokyo.",
        visualDescription: "Streaks of high-speed volumetric lights. Rain reflecting off slick urban alleyways as the target secures the quantum drive.",
        backgroundColor: "#0b001a",
        accentColor: "#a855f7",
        gradientColors: ["#02000c", "#0f011c", "#240138"],
        cameraMotion: { type: "zoom-out", speed: "fast", scaleStart: 1.3, scaleEnd: 1.0, xStart: 0, xEnd: 0, yStart: 5, yEnd: -5 },
        elements: [
          { type: "landscape-silhouette", shape: "polygon", color: "#111116", size: 100, position: { x: 50, y: 80 }, movement: "none", depth: 1 },
          { type: "layered-shape", shape: "star", color: "#a855f7", size: 15, position: { x: 80, y: 20 }, movement: "float", depth: 2 }
        ],
        particles: { type: "rain", count: 200, color: "#3b82f6", speed: 6, size: 1 }
      }
    ]
  },
  {
    id: "enchanted_forest",
    name: "Enchanted Whimsical Woodlands",
    category: "fantasy",
    description: "Pastel watercolor trees, glowing organic flowers, floating cherry blossoms, and a sense of magical discovery.",
    visualStyle: "anime",
    musicVibe: "ambient",
    prompt: "magical forest fantasy watercolor",
    bgGradient: "from-fg/[0.04] via-[#0a120e] to-black",
    accent: "text-ok border-ok/30 bg-ok/10",
    scenesCount: 2,
    scenes: [
      {
        sceneNumber: 1,
        title: "The Whispering Glen",
        duration: 5,
        narration: "A gentle breeze sweeps through the watercolor branches, scattering glowing fuchsia pollen.",
        visualDescription: "Soft, layered pastel silhouettes of ancient trees. Magical pink cherry blossoms floating through warm volumetric sunbeams.",
        backgroundColor: "#030f09",
        accentColor: "#10b981",
        gradientColors: ["#000502", "#02140b", "#0a2d1a"],
        cameraMotion: { type: "drift", speed: "slow", scaleStart: 1.02, scaleEnd: 1.08, xStart: 1, xEnd: -1, yStart: 1, yEnd: -1 },
        elements: [
          { type: "landscape-silhouette", shape: "polygon", color: "#021209", size: 110, position: { x: 50, y: 75 }, movement: "none", depth: 1 },
          { type: "layered-shape", shape: "circle", color: "#f472b6", size: 30, position: { x: 50, y: 35 }, movement: "pulse", depth: 3 }
        ],
        particles: { type: "cherry-blossoms", count: 110, color: "#f472b6", speed: 1.5, size: 2.5 }
      },
      {
        sceneNumber: 2,
        title: "Crystal Hollow",
        duration: 5,
        narration: "A hidden stream glows with luminous energy, revealing floating crystals of power.",
        visualDescription: "Brilliant emerald and sapphire light rays bouncing off jagged stone formations in a deep subterranean cave.",
        backgroundColor: "#010e14",
        accentColor: "#06b6d4",
        gradientColors: ["#000305", "#021018", "#08293d"],
        cameraMotion: { type: "orbit-left", speed: "slow", scaleStart: 1.1, scaleEnd: 1.15, xStart: 5, xEnd: -5, yStart: 2, yEnd: 2 },
        elements: [
          { type: "abstract-mesh", shape: "polygon", color: "#06b6d4", size: 50, position: { x: 50, y: 55 }, movement: "float", depth: 2 },
          { type: "layered-shape", shape: "star", color: "#10b981", size: 10, position: { x: 25, y: 25 }, movement: "pulse", depth: 3 }
        ],
        particles: { type: "dust-motes", count: 90, color: "#06b6d4", speed: 0.8, size: 2 }
      }
    ]
  },
  {
    id: "cinematic_nebula",
    name: "Cosmic Odyssey",
    category: "cinematic",
    description: "Deep space cinematic horizons, giant planetary rings, spinning starfields, and long atmospheric orchestral audio.",
    visualStyle: "cinema",
    musicVibe: "cinematic",
    prompt: "deep space galaxy ring nebula",
    bgGradient: "from-surface via-[#0a0f1d] to-black",
    accent: "text-fg border-fg/60 bg-fg/[0.05]",
    scenesCount: 3,
    scenes: [
      {
        sceneNumber: 1,
        title: "Orbital Dawn",
        duration: 5,
        narration: "A distant star breaks over the massive curved limb of a ringed gas giant.",
        visualDescription: "A glowing amber solar flare halo. Thick planetary ring shadows casting across a vast stellar field.",
        backgroundColor: "#03050d",
        accentColor: "#f59e0b",
        gradientColors: ["#000103", "#010412", "#0c122b"],
        cameraMotion: { type: "zoom-in", speed: "slow", scaleStart: 1.0, scaleEnd: 1.15, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
        elements: [
          { type: "layered-shape", shape: "circle", color: "#f59e0b", size: 60, position: { x: 30, y: 50 }, movement: "none", depth: 1 },
          { type: "layered-shape", shape: "ring", color: "#3b82f6", size: 100, position: { x: 30, y: 50 }, movement: "rotate", depth: 2 }
        ],
        particles: { type: "stars", count: 180, color: "#ffffff", speed: 0.5, size: 1 }
      },
      {
        sceneNumber: 2,
        title: "The Void Passage",
        duration: 4,
        narration: "The vessel maneuvers through the swirling space dust of the Orion Nebula.",
        visualDescription: "Wisps of indigo and cosmic purple volumetric dust layers drifting gracefully. Star highlights twinkiling.",
        backgroundColor: "#070212",
        accentColor: "#8b5cf6",
        gradientColors: ["#010003", "#080214", "#1e0b3b"],
        cameraMotion: { type: "pan-left", speed: "slow", scaleStart: 1.1, scaleEnd: 1.1, xStart: 10, xEnd: -10, yStart: 0, yEnd: 0 },
        elements: [
          { type: "abstract-mesh", shape: "circle", color: "#8b5cf6", size: 45, position: { x: 50, y: 40 }, movement: "float", depth: 1 },
          { type: "layered-shape", shape: "star", color: "#f59e0b", size: 8, position: { x: 75, y: 20 }, movement: "pulse", depth: 3 }
        ],
        particles: { type: "dust-motes", count: 120, color: "#8b5cf6", speed: 1.2, size: 1.8 }
      },
      {
        sceneNumber: 3,
        title: "Event Horizon",
        duration: 6,
        narration: "Time warps as the singularity pulls the celestial dust into a spinning swirl.",
        visualDescription: "A gorgeous spinning spiral vortex in gold and purple, framed by deep black negative space.",
        backgroundColor: "#000000",
        accentColor: "#d97706",
        gradientColors: ["#000000", "#050201", "#170a01"],
        cameraMotion: { type: "orbit-right", speed: "medium", scaleStart: 1.0, scaleEnd: 1.3, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
        elements: [
          { type: "layered-shape", shape: "ring", color: "#d97706", size: 50, position: { x: 50, y: 50 }, movement: "rotate", depth: 2 },
          { type: "layered-shape", shape: "circle", color: "#000000", size: 18, position: { x: 50, y: 50 }, movement: "none", depth: 3 }
        ],
        particles: { type: "stars", count: 200, color: "#fcd34d", speed: 5, size: 1 }
      }
    ]
  },
  {
    id: "retro_pixel",
    name: "Chiptune Arcade Run",
    category: "retro",
    description: "Nostalgic 8-bit aesthetic, grid-based cyber planes, flying glowing pixels, and rapid chiptune synthesizer notes.",
    visualStyle: "retro-pixel",
    musicVibe: "chiptune",
    prompt: "8bit retro game pixel city",
    bgGradient: "from-danger/10 via-[#120505] to-black",
    accent: "text-danger border-danger/30 bg-danger/10",
    scenesCount: 2,
    scenes: [
      {
        sceneNumber: 1,
        title: "Level 1: The Grid",
        duration: 3,
        narration: "Insert Coin. The 8-bit cyber ship boots up along the perspective neon runway.",
        visualDescription: "Flat, high-contrast block shapes. Bright crimson and neon-emerald scanlines running horizontally.",
        backgroundColor: "#0f0002",
        accentColor: "#ef4444",
        gradientColors: ["#050000", "#150004", "#300109"],
        cameraMotion: { type: "drift", speed: "fast", scaleStart: 1.0, scaleEnd: 1.1, xStart: 0, xEnd: 0, yStart: 5, yEnd: -5 },
        elements: [
          { type: "geometric-grid", shape: "rect", color: "#ef4444", size: 80, position: { x: 50, y: 60 }, movement: "pulse", depth: 1 },
          { type: "layered-shape", shape: "rect", color: "#10b981", size: 12, position: { x: 20, y: 40 }, movement: "float", depth: 3 }
        ],
        particles: { type: "sparks", count: 140, color: "#ef4444", speed: 5, size: 3 }
      },
      {
        sceneNumber: 2,
        title: "Boss Castle Core",
        duration: 4,
        narration: "A spinning glitch vortex appears at the center of the mechanical fortress.",
        visualDescription: "Heavy pixelated square rings pulsing outwards rapidly. Glowing core elements spinning on the timeline.",
        backgroundColor: "#070012",
        accentColor: "#10b981",
        gradientColors: ["#020006", "#0a011a", "#15023a"],
        cameraMotion: { type: "zoom-in", speed: "fast", scaleStart: 0.9, scaleEnd: 1.25, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
        elements: [
          { type: "layered-shape", shape: "ring", color: "#10b981", size: 35, position: { x: 50, y: 50 }, movement: "rotate", depth: 2 },
          { type: "layered-shape", shape: "rect", color: "#ef4444", size: 10, position: { x: 50, y: 50 }, movement: "pulse", depth: 3 }
        ],
        particles: { type: "sparks", count: 150, color: "#10b981", speed: 6, size: 2 }
      }
    ]
  }
];

export function sampleBoard(film: SampleFilm): Storyboard {
  const v = film.musicVibe;
  return {
    title: film.name,
    summary: film.description,
    visualStyle: film.visualStyle,
    musicVibe: v,
    tempoBpm: v === "synthwave" ? 120 : v === "chiptune" ? 140 : 80,
    scale: v === "synthwave" ? "minor" : v === "chiptune" ? "phrygian" : "pentatonic",
    scenes: film.scenes.map((s, i) => ({ ...s, sceneNumber: i + 1, transition: i === 0 ? "cut" : "fade" })),
  };
}
