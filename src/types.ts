export interface ElementSpec {
  type: 'layered-shape' | 'vector-icon' | 'abstract-mesh' | 'starfield' | 'landscape-silhouette' | 'geometric-grid';
  shape: 'circle' | 'rect' | 'polygon' | 'ring' | 'line' | 'spline' | 'star';
  color: string;
  size: number;
  position: { x: number; y: number }; // Percentage 0 - 100
  movement: 'float' | 'rotate' | 'pulse' | 'glide' | 'none';
  depth: number; // 1 = background, 2 = midground, 3 = foreground
  details?: string;
}

export interface CameraMotion {
  type: 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'orbit-left' | 'orbit-right' | 'parallax-tilt' | 'drift';
  speed: 'slow' | 'medium' | 'fast';
  scaleStart: number;
  scaleEnd: number;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

export interface ParticleSpec {
  type: 'stars' | 'sparks' | 'cherry-blossoms' | 'rain' | 'snow' | 'bubbles' | 'dust-motes' | 'none';
  count: number;
  color: string;
  speed: number;
  size: number;
}

export interface Scene {
  sceneNumber: number;
  title: string;
  duration: number; // in seconds
  narration: string;
  visualDescription: string;
  backgroundColor: string;
  accentColor: string;
  gradientColors: string[];
  cameraMotion: CameraMotion;
  elements: ElementSpec[];
  particles: ParticleSpec;
  /** Asset id of an uploaded backdrop image */
  backdrop?: string;
  /** Characters performing in this scene */
  cast?: CastMember[];
  /** How this scene arrives from the one before it; missing means a straight cut */
  transition?: TransitionKind;
}

export type TransitionKind = "cut" | "fade" | "wipe" | "zoom" | "flash";

/** A line of text on the timeline's text track. */
export interface TextClip {
  id: string;
  text: string;
  /** Seconds from the start of the film */
  start: number;
  duration: number;
  animation: "fade" | "pop" | "slide" | "typewriter";
  font: "display" | "serif" | "sans";
  position: "top" | "middle" | "bottom";
  size: "s" | "m" | "l";
  /** Dark box behind the text, for captions */
  box: boolean;
}

/** A song the user added. The audio itself lives in the asset store. */
export interface MusicTrack {
  assetId: string;
  name: string;
  /** Length of the song, seconds */
  duration: number;
  /** Seconds into the song where the film starts */
  offset: number;
  volume: number; // 0-1
  /** Detected tempo */
  bpm: number;
  /** Detected beat times, seconds into the song */
  beats: number[];
  /** Waveform overview, 0-1 per bucket */
  peaks: number[];
  /** Keep the generated score playing under the song */
  withScore: boolean;
}

/* ---------- Studio project ---------- */

/** A character designed in the Characters tab. */
export interface CharacterLook {
  id: string;
  name: string;
  skin: string;
  hair: string;
  eyes: string;
  costume: string;
  accent: string;
  hairStyle: "sleek" | "quantum" | "mech" | "ethereal";
  /** Full body design from the Forge. Characters without one are drawn as a plain humanoid. */
  build?: CharacterBuild;
}

/* ---------- Character forge ---------- */

export type PartSlot = "torso" | "head" | "face" | "hair" | "headgear" | "arms" | "legs" | "back" | "tail" | "prop";

export interface CharacterPalette {
  skin: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  hair: string;
}

export interface CharacterProportions {
  head: number; // 0.6-1.8
  shoulders: number; // 0.7-1.5
  arms: number; // 0.6-1.6
  legs: number; // 0.5-1.6
  bulk: number; // limb thickness 0.6-1.8
}

export type BodyPlan = "biped" | "quadruped" | "flyer" | "serpent" | "floater";

export interface CharacterBuild {
  /** The seed this design came from; the same seed and archetype give the same character. */
  seed: number;
  /** Skeleton type; missing means biped (characters made before body plans existed). */
  plan?: BodyPlan;
  archetype: string;
  parts: Record<PartSlot, string>;
  proportions: CharacterProportions;
  palette: CharacterPalette;
}

export type MotionId = "idle" | "run" | "float" | "strike" | "wave";

/** An animation made in the Motion rig tab. */
export interface RigClip {
  id: string;
  name: string;
  /** Rest pose the clip starts from: joint id -> position in the 400x500 rig space */
  pose: Record<string, { x: number; y: number }>;
  motion: MotionId | null;
  speed: number;
  intensity: number;
  /** Optional hand-made keyframes, played in a loop over the motion */
  keyframes: Record<string, { x: number; y: number }>[];
  keyframeSeconds: number;
}

/** A character placed in a scene, running a clip. */
export interface CastMember {
  characterId: string;
  clipId: string;
  x: number; // 0-100, feet position across the frame
  y: number; // 0-100, feet position down the frame
  scale: number; // fraction of frame height, 0.2-1
  flip?: boolean;
}

/** Colour grade from the Characters tab, applied to the whole film. */
export interface Grade {
  preset: "none" | "teal-orange" | "noir" | "violet" | "gold" | "vivid";
  contrast: number; // percent, 100 = neutral
  saturation: number; // percent, 100 = neutral
  vignette: number; // 0-100
  tint: string; // hex
  tintAmount: number; // 0-100
}

export interface Project {
  id: string;
  version: 1;
  prompt: string;
  board: Storyboard;
  characters: CharacterLook[];
  clips: RigClip[];
  grade: Grade;
  /** Text track */
  texts?: TextClip[];
  /** Music track */
  music?: MusicTrack | null;
  /** Show each scene's title and narration as a title card (default on) */
  titleCards?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CrewMessage {
  role: 'director' | 'cinematographer' | 'sound-designer';
  name: string;
  avatar: string;
  message: string;
}

export interface Storyboard {
  title: string;
  summary: string;
  visualStyle: string;
  musicVibe: 'ambient' | 'synthwave' | 'cinematic' | 'lofi' | 'chiptune';
  tempoBpm: number;
  scale: 'major' | 'minor' | 'pentatonic' | 'phrygian';
  scenes: Scene[];
  warning?: string;
  crewDialogue?: CrewMessage[];
}

export type VisualPreset = 'cinema' | 'cyberpunk' | 'anime' | 'watercolor' | 'oil-painting' | 'vaporwave' | 'line-art' | 'retro-pixel';

export interface VisualPresetDetails {
  id: VisualPreset;
  name: string;
  description: string;
  backgroundGradient: string;
  primaryColor: string;
}

export type MusicPreset = 'ambient' | 'synthwave' | 'cinematic' | 'lofi' | 'chiptune';

export interface MusicPresetDetails {
  id: MusicPreset;
  name: string;
  description: string;
  icon: string;
}

export interface VisualResearchResult {
  aestheticName: string;
  description: string;
  keyConcepts: string[];
  colorPalette: string[];
  prompts: string[];
  sources?: string[];
  warning?: string;
}

