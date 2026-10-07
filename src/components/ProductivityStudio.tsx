import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Clock, 
  Sparkles, 
  Layers, 
  Download, 
  Users, 
  MessageSquare, 
  Send, 
  Share2, 
  Grid, 
  Video, 
  UserPlus, 
  Globe, 
  Sliders, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  Volume2, 
  Film, 
  ArrowRight, 
  Monitor, 
  ExternalLink,
  Smartphone,
  Clapperboard,
  Tv,
  Heart,
  MessageCircle,
  FolderOpen
} from "lucide-react";
import { Storyboard, Scene, CameraMotion, ParticleSpec, ElementSpec, VisualPreset, MusicPreset } from "../types";
import { ExportPanel } from "../features/export/ExportPanel";

interface ProductivityStudioProps {
  storyboard: Storyboard | null;
  /** Replace the storyboard after an edit (keeps playback state) */
  setStoryboard: (board: Storyboard) => void;
  /** Load a whole new storyboard (resets playback, tempo and backdrops) */
  loadStoryboard: (board: Storyboard) => void;
  activeSceneIndex: number;
  setActiveSceneIndex: (index: number) => void;
  setSelectedStyle: (style: VisualPreset) => void;
  setSelectedMusic: (music: MusicPreset) => void;
  setPrompt: (prompt: string) => void;
  backdrops: Record<number, string>;
  bpm: number;
  scale: string;
  stopPlayback: () => void;
}

// Visual layout helper for prebuilt template cards
interface TemplatePreset {
  id: string;
  name: string;
  category: "cyber" | "fantasy" | "retro" | "cinematic";
  description: string;
  visualStyle: VisualPreset;
  musicVibe: MusicPreset;
  prompt: string;
  bgGradient: string;
  accent: string;
  scenesCount: number;
  scenes: Scene[];
}

export default function ProductivityStudio({
  storyboard,
  setStoryboard,
  activeSceneIndex,
  setActiveSceneIndex,
  setSelectedStyle,
  setSelectedMusic,
  setPrompt,
  loadStoryboard,
  backdrops,
  bpm,
  scale,
  stopPlayback,
}: ProductivityStudioProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sequence" | "templates" | "export">("sequence");
  const [statusMessage, setStatusMessage] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // --- 3. Templates Library Definitions ---
  const TEMPLATES: TemplatePreset[] = [
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

  // Apply a template library selection to the main storyboard
  const applyTemplate = (tpl: TemplatePreset) => {
    setSelectedStyle(tpl.visualStyle);
    setSelectedMusic(tpl.musicVibe);
    setPrompt(tpl.scenes[0].narration);

    const newStoryboard: Storyboard = {
      title: tpl.name,
      summary: tpl.description,
      visualStyle: tpl.visualStyle,
      musicVibe: tpl.musicVibe,
      tempoBpm: tpl.musicVibe === "synthwave" ? 120 : tpl.musicVibe === "chiptune" ? 140 : 80,
      scale: tpl.musicVibe === "synthwave" ? "minor" : tpl.musicVibe === "chiptune" ? "phrygian" : "pentatonic",
      scenes: tpl.scenes,
      crewDialogue: [],
    };

    loadStoryboard(newStoryboard);
    triggerAlert(`Loaded template: ${tpl.name}.`);
  };

  const triggerAlert = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 4000);
  };

  // --- 4. Drag & Drop HTML5 Handler ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    const sourceIndex = parseInt(sourceIndexStr, 10);
    
    if (isNaN(sourceIndex) || !storyboard || sourceIndex === targetIndex) return;

    const scenes = [...storyboard.scenes];
    const [movedScene] = scenes.splice(sourceIndex, 1);
    scenes.splice(targetIndex, 0, movedScene);

    // Renumber scenes sequentially
    const updatedScenes = scenes.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1
    }));

    setStoryboard({
      ...storyboard,
      scenes: updatedScenes
    });

    // Match index to moved item
    if (activeSceneIndex === sourceIndex) {
      setActiveSceneIndex(targetIndex);
    } else if (activeSceneIndex > sourceIndex && activeSceneIndex <= targetIndex) {
      setActiveSceneIndex(activeSceneIndex - 1);
    } else if (activeSceneIndex < sourceIndex && activeSceneIndex >= targetIndex) {
      setActiveSceneIndex(activeSceneIndex + 1);
    }

    triggerAlert(`Reordered Scene: Moved Scene ${sourceIndex + 1} to position ${targetIndex + 1}.`);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
  };

  // --- 5. Timeline Modifiers (Add, Clone, Delete) ---
  const addBlankScene = () => {
    if (!storyboard) return;
    const newNum = storyboard.scenes.length + 1;
    const newScene: Scene = {
      sceneNumber: newNum,
      title: `Scene ${newNum}: New Cinematic Segment`,
      duration: 4,
      narration: "A newly created sequential segment waiting for cinematic AI synthesis or procedural design.",
      visualDescription: "Floating dust particles in a dark minimalist chamber, subtle light flare from the corner.",
      backgroundColor: "#0d0e12",
      accentColor: "#06b6d4",
      gradientColors: ["#040508", "#0d0e15", "#181b28"],
      cameraMotion: { type: "drift", speed: "slow", scaleStart: 1.0, scaleEnd: 1.1, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 },
      elements: [
        { type: "layered-shape", shape: "ring", color: "#06b6d4", size: 30, position: { x: 50, y: 50 }, movement: "float", depth: 2 }
      ],
      particles: { type: "dust-motes", count: 80, color: "#06b6d4", speed: 1, size: 2 }
    };

    setStoryboard({
      ...storyboard,
      scenes: [...storyboard.scenes, newScene]
    });
    setActiveSceneIndex(storyboard.scenes.length);
    triggerAlert(`Added Scene ${newNum} to sequencing timeline.`);
  };

  const cloneScene = (index: number) => {
    if (!storyboard) return;
    const sourceScene = storyboard.scenes[index];
    const cloned: Scene = {
      ...JSON.parse(JSON.stringify(sourceScene)), // Deep clone elements
      title: `${sourceScene.title} (Copy)`,
      sceneNumber: storyboard.scenes.length + 1
    };

    const newScenes = [...storyboard.scenes];
    newScenes.splice(index + 1, 0, cloned);

    // Renumber
    const renumbered = newScenes.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1
    }));

    setStoryboard({
      ...storyboard,
      scenes: renumbered
    });
    setActiveSceneIndex(index + 1);
    triggerAlert(`Cloned Scene ${index + 1} to position ${index + 2}.`);
  };

  const deleteScene = (index: number) => {
    if (!storyboard) return;
    if (storyboard.scenes.length <= 1) {
      triggerAlert("Cannot delete the only scene! Maintain at least one scene block.");
      return;
    }

    const newScenes = [...storyboard.scenes];
    newScenes.splice(index, 1);

    // Renumber
    const renumbered = newScenes.map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1
    }));

    setStoryboard({
      ...storyboard,
      scenes: renumbered
    });

    const nextActive = Math.max(0, index - 1);
    setActiveSceneIndex(nextActive);
    triggerAlert(`Deleted Scene ${index + 1}. Sequencing restructured.`);
  };

  const updateSceneDuration = (index: number, sec: number) => {
    if (!storyboard) return;
    const val = Math.max(1, Math.min(30, sec));
    const newScenes = [...storyboard.scenes];
    newScenes[index].duration = val;
    setStoryboard({
      ...storyboard,
      scenes: newScenes
    });
  };

  if (!storyboard) {
    return (
      <div id="productivity-studio-empty" className="bg-surface border border-line rounded-sm p-12 text-center flex flex-col items-center justify-center gap-4">
        <Sliders className="w-12 h-12 text-faint animate-pulse" />
        <h3 className="text-sm font-mono uppercase tracking-widest text-fg/70">Awaiting Storyboard Sequence</h3>
        <p className="text-xs text-muted max-w-sm leading-relaxed">
          Please input a text prompt in the main generator panel to synthesize a multi-scene storyboard sequence first. This productivity workspace will automatically unlock.
        </p>
      </div>
    );
  }

  return (
    <div id="productivity-studio-root" className="w-full flex flex-col gap-5">
      
      {/* Dynamic Status Bar alert */}
      {statusMessage && (
        <div className="bg-fg/[0.05] border border-fg/60 text-fg font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-sm shadow-md animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping"></span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Productivity Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-sm border border-line">
          <button
            onClick={() => setActiveSubTab("sequence")}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "sequence"
                ? "bg-fg/[0.05] text-fg border border-fg/60 font-bold"
                : "text-fg/40 hover:text-fg/80"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Drag-and-Drop Timeline</span>
          </button>

          <button
            onClick={() => setActiveSubTab("templates")}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "templates"
                ? "bg-fg/[0.05] text-fg border border-fg/60 font-bold"
                : "text-fg/40 hover:text-fg/80"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>2. Cinematic Templates</span>
          </button>

          <button
            onClick={() => setActiveSubTab("export")}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "export"
                ? "bg-fg/[0.05] text-fg border border-fg/60 font-bold"
                : "text-fg/40 hover:text-fg/80"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>3. Export video</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-fg/30 uppercase">
          <span>ACTIVE PROJECT:</span>
          <span className="text-fg/80 font-bold max-w-[160px] truncate">{storyboard.title}</span>
        </div>
      </div>

      {/* Sub-Tab Panels */}
      
      {/* --- PANEL 1: DRAG & DROP SEQUENCE TIMELINE --- */}
      {activeSubTab === "sequence" && (
        <div className="flex flex-col gap-4">
          
          <div className="flex justify-between items-center bg-black/20 border border-line p-4 rounded-sm">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs uppercase font-bold tracking-widest text-fg/90">Multi-Scene Drag-and-Drop Sequencer</h3>
              <p className="text-[11px] text-fg/50 leading-relaxed font-sans">
                Rearrange chronological scene order seamlessly using mouse drag or touch. Clone to branch alternate visual concepts, adjust durations dynamically, or delete blocks to restructure your cinematic flow.
              </p>
            </div>
            <button
              onClick={addBlankScene}
              className="shrink-0 bg-accent hover:bg-accent text-fg font-bold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Insert Scene Block</span>
            </button>
          </div>

          {/* Timeline Sequence list */}
          <div className="flex flex-col gap-3">
            {storyboard.scenes.map((scene, idx) => {
              const isActive = idx === activeSceneIndex;
              const isDragOver = idx === dragOverIndex;
              
              return (
                <div
                  key={`scene-drag-${idx}-${scene.sceneNumber}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setActiveSceneIndex(idx)}
                  className={`border rounded-sm transition-all duration-300 cursor-grab active:cursor-grabbing p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive 
                      ? "bg-fg/[0.05] border-fg/60 shadow-lg scale-[1.002]" 
                      : "bg-surface border-line hover:border-line-strong hover:scale-[1.005] hover:bg-[#151517] hover:shadow-md"
                  } ${
                    isDragOver ? "border-dashed border-fg/60 bg-fg/[0.05] scale-[1.01]" : ""
                  }`}
                >
                  {/* Left Column: Drag Handle & Scene Info */}
                  <div className="flex items-center gap-3.5 flex-grow">
                    <div className="flex flex-col items-center justify-center text-fg/20 select-none">
                      <span className="text-[11px] font-mono leading-none">☰</span>
                      <span className="text-[7px] font-mono uppercase tracking-wider mt-1 text-fg/30">DRAG</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono bg-surface border border-line px-2 py-0.5 rounded-sm text-fg font-extrabold">
                          SCENE {scene.sceneNumber}
                        </span>
                        <h4 className="text-xs font-semibold text-fg/90">{scene.title}</h4>
                      </div>
                      <p className="text-[11px] text-fg/50 italic leading-relaxed max-w-xl line-clamp-1">
                        &quot;{scene.narration}&quot;
                      </p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-fg/30 uppercase mt-0.5">
                        <span>VFX: <strong className="text-fg">{scene.particles.type}</strong></span>
                        <span>•</span>
                        <span>Camera: <strong className="text-fg">{scene.cameraMotion.type}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Duration and Scene Modifier Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-line pt-3 md:pt-0 shrink-0">
                    
                    {/* Duration Input */}
                    <div className="flex items-center gap-2 bg-black/40 border border-line px-2.5 py-1.5 rounded-sm">
                      <Clock className="w-3.5 h-3.5 text-fg/30" />
                      <span className="text-[11px] font-mono text-fg/40 uppercase">Duration:</span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={scene.duration}
                        onChange={(e) => updateSceneDuration(idx, parseInt(e.target.value, 10) || 4)}
                        onClick={(e) => e.stopPropagation()} // stop tab triggers
                        className="w-10 bg-transparent text-center text-fg font-mono text-xs focus:outline-none font-bold cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-fg/40">s</span>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => cloneScene(idx)}
                        title="Clone Scene"
                        className="p-1.5 bg-surface hover:bg-surface border border-line hover:border-line-strong rounded-sm text-muted hover:text-fg transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteScene(idx)}
                        title="Delete Scene"
                        className="p-1.5 bg-surface hover:bg-danger/10 border border-line hover:border-danger/20 rounded-sm text-muted hover:text-danger transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>

          {/* Quick Sequencing Guide */}
          <div className="bg-surface border border-line p-4 rounded-sm flex gap-3.5">
            <Sparkles className="w-5 h-5 text-fg shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-mono text-fg font-bold uppercase">Dynamic Synthesizer Integration</span>
              <p className="text-[11px] text-fg/50 leading-relaxed font-sans">
                The visual timeline duration perfectly matches our procedural audio synth loops. Rearranging elements dynamically schedules pitch transitions, visual particle resets, and camera track speed recalculations. Feel free to drag scenes around!
              </p>
            </div>
          </div>

        </div>
      )}

      {/* --- PANEL 2: PRE-BUILT CINEMATIC TEMPLATE LIBRARY --- */}
      {activeSubTab === "templates" && (
        <div className="flex flex-col gap-5">
          
          <div className="bg-surface border border-line p-4 rounded-sm flex flex-col gap-1.5">
            <h3 className="text-xs uppercase font-bold tracking-widest text-fg/90">Cinematic Template Library</h3>
            <p className="text-[11px] text-fg/50 leading-relaxed font-sans">
              Instantly bootstrap high-quality creative works. These presets come complete with multi-scene sequences, stylized color palettes, interactive particle emitters, customized vector rigs, and mapped synthesizer tempo layers.
            </p>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-surface border border-line rounded-sm overflow-hidden flex flex-col justify-between group hover:border-line transition-all duration-300"
              >
                
                {/* Visual Top Header representing Gradient */}
                <div className={`h-24 bg-gradient-to-br ${tpl.bgGradient} relative p-4 flex flex-col justify-between overflow-hidden`}>
                  {/* Subtle Grid overlay */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                  
                  <span className={`text-[11px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm border w-fit font-bold z-10 ${tpl.accent}`}>
                    {tpl.category}
                  </span>

                  <div className="z-10">
                    <h4 className="text-sm font-extrabold text-fg group-hover:text-fg transition-all font-sans leading-tight">
                      {tpl.name}
                    </h4>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-4 flex flex-col gap-4">
                  <p className="text-[11px] text-fg/50 leading-relaxed font-sans min-h-[48px]">
                    {tpl.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-black/40 border border-line p-2 rounded-xs text-[11px] font-mono text-fg/40">
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-[11px] uppercase text-fg/20">Scenes</span>
                      <strong className="text-fg/80">{tpl.scenesCount} Units</strong>
                    </div>
                    <div className="flex flex-col gap-0.5 text-center border-x border-line">
                      <span className="text-[11px] uppercase text-fg/20">Style</span>
                      <strong className="text-fg uppercase">{tpl.visualStyle}</strong>
                    </div>
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-[11px] uppercase text-fg/20">Audio Vibe</span>
                      <strong className="text-fg uppercase">{tpl.musicVibe}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => applyTemplate(tpl)}
                    className="w-full bg-surface hover:bg-raised border border-line hover:border-fg/60 text-fg hover:text-fg font-bold text-[11px] uppercase tracking-wider py-2 rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Apply Preset Template</span>
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* --- PANEL 3: EXPORT --- */}
      {activeSubTab === "export" && (
        <ExportPanel storyboard={storyboard} backdrops={backdrops} bpm={bpm} scale={scale} stopPlayback={stopPlayback} />
      )}

    </div>
  );
}
