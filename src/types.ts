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

