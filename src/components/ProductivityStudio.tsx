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

interface ProductivityStudioProps {
  storyboard: Storyboard | null;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  activeSceneIndex: number;
  setActiveSceneIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedStyle: (style: VisualPreset) => void;
  setSelectedMusic: (music: MusicPreset) => void;
  setPrompt: (prompt: string) => void;
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
  setPrompt
}: ProductivityStudioProps) {
  // Current active sub-tab inside Productivity Studio
  const renderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
  }, []);

  const [activeSubTab, setActiveSubTab] = useState<"sequence" | "templates" | "collab" | "export">("sequence");
  const [statusMessage, setStatusMessage] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // --- 1. Export States ---
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm" | "gif">("mp4");
  const [exportResolution, setExportResolution] = useState<"1080p" | "4k" | "vertical" | "square">("1080p");
  const [exportFps, setExportFps] = useState<24 | 30 | 60>(24);
  const [exportBitrate, setExportBitrate] = useState<number>(12); // Mbps
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStep, setRenderStep] = useState("");
  const [renderedFile, setRenderedFile] = useState<{ name: string; size: string; url: string } | null>(null);

  // --- 2. Collaboration States ---
  const [comments, setComments] = useState<Array<{
    id: string;
    sceneNum: number;
    user: string;
    avatar: string;
    role: "director" | "cinematographer" | "sound-designer" | "editor" | "client";
    text: string;
    time: string;
    timestamp: number;
    likes: number;
  }>>([
    {
      id: "c1",
      sceneNum: 1,
      user: "Sarah Jenkins",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
      role: "director",
      text: "The opening framing is spot on! Can we make the camera motion drift slightly slower to build tension?",
      time: "10m ago",
      timestamp: Date.now() - 10 * 60 * 1000,
      likes: 3
    },
    {
      id: "c2",
      sceneNum: 2,
      user: "Marcus Vance",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
      role: "cinematographer",
      text: "Lighting looks stunning here. The neon pink highlights perfectly complement the character silhouette.",
      time: "25m ago",
      timestamp: Date.now() - 25 * 60 * 1000,
      likes: 5
    },
    {
      id: "c3",
      sceneNum: 1,
      user: "Elena Rostov",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80",
      role: "sound-designer",
      text: "The synthesizer chord timing is synced with the neon flash perfectly. Sounds immersive!",
      time: "1h ago",
      timestamp: Date.now() - 60 * 60 * 1000,
      likes: 2
    }
  ]);
  const [newCommentText, setNewCommentText] = useState("");
  const [selectedCommentFilter, setSelectedCommentFilter] = useState<number | "all">("all");
  const [mockActiveUsers, setMockActiveUsers] = useState([
    { name: "Sarah Jenkins", role: "Director", scene: 1, active: true, color: "border-red-500 bg-red-500" },
    { name: "Marcus Vance", role: "Cinematographer", scene: 2, active: true, color: "border-emerald-500 bg-emerald-500" },
    { name: "Elena Rostov", role: "Sound Designer", scene: 1, active: false, color: "border-cyan-500 bg-cyan-500" },
    { name: "Julian Gray", role: "VFX Editor", scene: 3, active: true, color: "border-purple-500 bg-purple-500" }
  ]);

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
      bgGradient: "from-fuchsia-950/40 via-[#0e0a1a] to-black",
      accent: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10",
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
      bgGradient: "from-emerald-950/30 via-[#0a120e] to-black",
      accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
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
      bgGradient: "from-slate-950/40 via-[#0a0f1d] to-black",
      accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
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
      bgGradient: "from-red-950/30 via-[#120505] to-black",
      accent: "text-red-400 border-red-500/30 bg-red-500/10",
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
      crewDialogue: [
        {
          role: "director",
          name: "System Blueprint",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
          message: `Successfully initialized project based on the cinematic template: "${tpl.name}".`
        }
      ]
    };

    setStoryboard(newStoryboard);
    setActiveSceneIndex(0);
    triggerAlert(`Loaded Template: ${tpl.name}! Synthesizer patterns, VFX parameters, and scenes updated.`);
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

  // --- 6. Comments & Note submission ---
  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !storyboard) return;

    const targetSceneNum = activeSceneIndex + 1;
    const newC = {
      id: "comment_" + Date.now(),
      sceneNum: targetSceneNum,
      user: "You (Lead Artist)",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
      role: "editor" as const,
      text: newCommentText,
      time: "Just now",
      timestamp: Date.now(),
      likes: 0
    };

    setComments([newC, ...comments]);
    setNewCommentText("");
    triggerAlert(`Submitted live workspace comment on Scene ${targetSceneNum}.`);

    // Trigger mock real-time reaction chat from Director after 3 seconds
    setTimeout(() => {
      const responseMessages = [
        "Acknowledge that. Looks good from my side as well, let's keep going!",
        "Brilliant idea! I will adjust the color grade values in the next pass.",
        "Synced. Let's make sure our Sound Designer Elena can cross-check this beat alignment.",
        "Perfect note. Ready to lock down this sequence segment."
      ];
      const randomMsg = responseMessages[Math.floor(Math.random() * responseMessages.length)];
      
      const responseComment = {
        id: "resp_" + Date.now(),
        sceneNum: targetSceneNum,
        user: "Sarah Jenkins",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
        role: "director" as const,
        text: `@Lead Artist: ${randomMsg}`,
        time: "1s ago",
        timestamp: Date.now(),
        likes: 1
      };
      setComments(prev => [responseComment, ...prev]);
    }, 3000);
  };

  const handleLikeComment = (id: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, likes: c.likes + 1 } : c));
  };

  // --- 7. Simulated Exporter Pipeline ---
  const handleStartRender = () => {
    if (!storyboard) return;
    setIsRendering(true);
    setRenderProgress(0);
    setRenderedFile(null);

    const steps = [
      { prg: 10, text: "Allocating container render buffer & verifying vector models..." },
      { prg: 25, text: "Interpolating skeletal character rigs & tracking timeline keyframes..." },
      { prg: 45, text: "Baking procedural audio wave synth layers into master stems..." },
      { prg: 65, text: "Compositing color grading matrix filters and SVG particle overlays..." },
      { prg: 85, text: "Compiling frames & matching target codec stream properties..." },
      { prg: 100, text: "Muxing video & audio channels into optimized delivery container!" }
    ];

    // Keep the counters outside React state so the updater stays pure
    // (StrictMode runs state updaters twice in development).
    let progress = 0;
    let currentStepIdx = 0;
    if (renderIntervalRef.current) clearInterval(renderIntervalRef.current);
    const interval = setInterval(() => {
      if (progress >= steps[currentStepIdx].prg) {
        currentStepIdx++;
      }

      if (currentStepIdx >= steps.length) {
        clearInterval(interval);
        renderIntervalRef.current = null;
        setIsRendering(false);
        setRenderProgress(100);

        // Generate actual downloaded mock file profile
        const timestampStr = new Date().toISOString().slice(0, 10);
        const sanitizedTitle = storyboard.title.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const ext = exportFormat === "gif" ? "gif" : exportFormat === "webm" ? "webm" : "mp4";
        const resLabel = exportResolution === "4k" ? "4K_UHD" : exportResolution === "vertical" ? "9_16_vertical" : exportResolution === "square" ? "1_1_square" : "1080p_FHD";
        const totalDuration = storyboard.scenes.reduce((acc, s) => acc + s.duration, 0);
        const computedSizeVal = ((totalDuration * exportFps * exportBitrate) / 8) * (exportFormat === "gif" ? 0.35 : 0.85);
        const finalSizeStr = computedSizeVal.toFixed(1) + " MB";

        setRenderedFile({
          name: `${sanitizedTitle}_${resLabel}_${exportFps}fps_${timestampStr}.${ext}`,
          size: finalSizeStr,
          url: "#"
        });
        triggerAlert(`Cinematic Render complete! File compiled successfully as ${ext.toUpperCase()}.`);
        return;
      }

      progress++;
      setRenderStep(steps[currentStepIdx].text);
      setRenderProgress(progress);
    }, 120);
    renderIntervalRef.current = interval;
  };

  const triggerMockDownload = () => {
    if (!renderedFile) return;
    
    // Create a dummy text file blob of 100 bytes to simulate a real browser file download
    const dummyContent = `Cinematic Studio Build Render Output\nFile: ${renderedFile.name}\nSize: ${renderedFile.size}\nResolution: ${exportResolution}\nFPS: ${exportFps}\nThank you for using Google AI Studio Build.`;
    const blob = new Blob([dummyContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = renderedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    triggerAlert(`Initiated download for: ${renderedFile.name}`);
  };

  if (!storyboard) {
    return (
      <div id="productivity-studio-empty" className="bg-[#111112] border border-white/5 rounded-sm p-12 text-center flex flex-col items-center justify-center gap-4">
        <Sliders className="w-12 h-12 text-neutral-600 animate-pulse" />
        <h3 className="text-sm font-mono uppercase tracking-widest text-white/70">Awaiting Storyboard Sequence</h3>
        <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
          Please input a text prompt in the main generator panel to synthesize a multi-scene storyboard sequence first. This productivity workspace will automatically unlock.
        </p>
      </div>
    );
  }

  const filteredComments = selectedCommentFilter === "all" 
    ? comments 
    : comments.filter(c => c.sceneNum === selectedCommentFilter);

  return (
    <div id="productivity-studio-root" className="w-full flex flex-col gap-5">
      
      {/* Dynamic Status Bar alert */}
      {statusMessage && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-sm shadow-md animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Productivity Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-sm border border-white/5">
          <button
            onClick={() => setActiveSubTab("sequence")}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "sequence"
                ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-bold"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Drag-and-Drop Timeline</span>
          </button>

          <button
            onClick={() => setActiveSubTab("templates")}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "templates"
                ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-bold"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>2. Cinematic Templates</span>
          </button>

          <button
            onClick={() => setActiveSubTab("collab")}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "collab"
                ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-bold"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>3. Cloud Collaboration</span>
          </button>

          <button
            onClick={() => setActiveSubTab("export")}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "export"
                ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-bold"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>4. Flexible Export</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[9px] font-mono text-white/30 uppercase">
          <span>ACTIVE PROJECT:</span>
          <span className="text-white/80 font-bold max-w-[160px] truncate">{storyboard.title}</span>
        </div>
      </div>

      {/* Sub-Tab Panels */}
      
      {/* --- PANEL 1: DRAG & DROP SEQUENCE TIMELINE --- */}
      {activeSubTab === "sequence" && (
        <div className="flex flex-col gap-4">
          
          <div className="flex justify-between items-center bg-black/20 border border-white/5 p-4 rounded-sm">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs uppercase font-bold tracking-widest text-white/90">Multi-Scene Drag-and-Drop Sequencer</h3>
              <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                Rearrange chronological scene order seamlessly using mouse drag or touch. Clone to branch alternate visual concepts, adjust durations dynamically, or delete blocks to restructure your cinematic flow.
              </p>
            </div>
            <button
              onClick={addBlankScene}
              className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[9px] uppercase tracking-wider px-4 py-2.5 rounded-xs flex items-center gap-1.5 transition-all cursor-pointer"
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
                      ? "bg-cyan-950/20 border-cyan-500/40 shadow-lg shadow-cyan-500/5 scale-[1.002]" 
                      : "bg-[#111112] border-white/5 hover:border-white/25 hover:scale-[1.005] hover:bg-[#151517] hover:shadow-md hover:shadow-cyan-500/2"
                  } ${
                    isDragOver ? "border-dashed border-cyan-400 bg-cyan-950/30 scale-[1.01]" : ""
                  }`}
                >
                  {/* Left Column: Drag Handle & Scene Info */}
                  <div className="flex items-center gap-3.5 flex-grow">
                    <div className="flex flex-col items-center justify-center text-white/20 select-none">
                      <span className="text-[11px] font-mono leading-none">☰</span>
                      <span className="text-[7px] font-mono uppercase tracking-wider mt-1 text-white/30">DRAG</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono bg-neutral-900 border border-white/10 px-2 py-0.5 rounded-sm text-cyan-400 font-extrabold">
                          SCENE {scene.sceneNumber}
                        </span>
                        <h4 className="text-xs font-semibold text-white/90">{scene.title}</h4>
                      </div>
                      <p className="text-[10px] text-white/50 italic leading-relaxed max-w-xl line-clamp-1">
                        &quot;{scene.narration}&quot;
                      </p>
                      <div className="flex items-center gap-3 text-[8px] font-mono text-white/30 uppercase mt-0.5">
                        <span>VFX: <strong className="text-purple-400">{scene.particles.type}</strong></span>
                        <span>•</span>
                        <span>Camera: <strong className="text-cyan-400">{scene.cameraMotion.type}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Duration and Scene Modifier Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/5 pt-3 md:pt-0 shrink-0">
                    
                    {/* Duration Input */}
                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-sm">
                      <Clock className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-[9px] font-mono text-white/40 uppercase">Duration:</span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={scene.duration}
                        onChange={(e) => updateSceneDuration(idx, parseInt(e.target.value, 10) || 4)}
                        onClick={(e) => e.stopPropagation()} // stop tab triggers
                        className="w-10 bg-transparent text-center text-white font-mono text-xs focus:outline-none font-bold cursor-pointer"
                      />
                      <span className="text-[9px] font-mono text-white/40">s</span>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => cloneScene(idx)}
                        title="Clone Scene"
                        className="p-1.5 bg-neutral-950 hover:bg-neutral-900 border border-white/10 hover:border-white/20 rounded-sm text-neutral-400 hover:text-white transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteScene(idx)}
                        title="Delete Scene"
                        className="p-1.5 bg-neutral-950 hover:bg-red-950/20 border border-white/10 hover:border-red-500/20 rounded-sm text-neutral-400 hover:text-red-400 transition-all cursor-pointer"
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
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex gap-3.5">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Dynamic Synthesizer Integration</span>
              <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                The visual timeline duration perfectly matches our procedural audio synth loops. Rearranging elements dynamically schedules pitch transitions, visual particle resets, and camera track speed recalculations. Feel free to drag scenes around!
              </p>
            </div>
          </div>

        </div>
      )}

      {/* --- PANEL 2: PRE-BUILT CINEMATIC TEMPLATE LIBRARY --- */}
      {activeSubTab === "templates" && (
        <div className="flex flex-col gap-5">
          
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col gap-1.5">
            <h3 className="text-xs uppercase font-bold tracking-widest text-white/90">Cinematic Template Library</h3>
            <p className="text-[10px] text-white/50 leading-relaxed font-sans">
              Instantly bootstrap high-quality creative works. These presets come complete with multi-scene sequences, stylized color palettes, interactive particle emitters, customized vector rigs, and mapped synthesizer tempo layers.
            </p>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-[#111112] border border-white/5 rounded-sm overflow-hidden flex flex-col justify-between group hover:border-white/10 transition-all duration-300"
              >
                
                {/* Visual Top Header representing Gradient */}
                <div className={`h-24 bg-gradient-to-br ${tpl.bgGradient} relative p-4 flex flex-col justify-between overflow-hidden`}>
                  {/* Subtle Grid overlay */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                  
                  <span className={`text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm border w-fit font-bold z-10 ${tpl.accent}`}>
                    {tpl.category}
                  </span>

                  <div className="z-10">
                    <h4 className="text-sm font-extrabold text-white group-hover:text-cyan-400 transition-all font-sans leading-tight">
                      {tpl.name}
                    </h4>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-4 flex flex-col gap-4">
                  <p className="text-[10px] text-white/50 leading-relaxed font-sans min-h-[48px]">
                    {tpl.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/5 p-2 rounded-xs text-[9px] font-mono text-white/40">
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] uppercase text-white/20">Scenes</span>
                      <strong className="text-white/80">{tpl.scenesCount} Units</strong>
                    </div>
                    <div className="flex flex-col gap-0.5 text-center border-x border-white/5">
                      <span className="text-[8px] uppercase text-white/20">Style</span>
                      <strong className="text-cyan-400 uppercase">{tpl.visualStyle}</strong>
                    </div>
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-[8px] uppercase text-white/20">Audio Vibe</span>
                      <strong className="text-purple-400 uppercase">{tpl.musicVibe}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => applyTemplate(tpl)}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-cyan-500/30 text-neutral-300 hover:text-cyan-400 font-bold text-[9px] uppercase tracking-wider py-2 rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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

      {/* --- PANEL 3: CLOUD COLLABORATION SUITE --- */}
      {activeSubTab === "collab" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Active users status panel - 4 cols */}
          <div className="lg:col-span-4 bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Workspace Crew</span>
              <span className="text-[8px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-sm">
                Live Session
              </span>
            </div>

            <p className="text-[10px] text-white/40 font-sans leading-relaxed">
              Real-time multi-user editing status. Track active coordinates and comment threads instantly.
            </p>

            <div className="flex flex-col gap-3.5 mt-2">
              {mockActiveUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 p-3 rounded-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      {/* Placeholder avatar circle with user initials */}
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 text-[10px] font-bold text-white flex items-center justify-center">
                        {user.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${user.active ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white/90 leading-tight">{user.name}</span>
                      <span className="text-[9px] font-mono text-white/40 uppercase">{user.role}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[8px] font-mono text-white/30 uppercase">Viewing</span>
                    <span className="text-[9px] font-mono bg-cyan-950/30 text-cyan-400 border border-cyan-500/10 px-1.5 py-0.5 rounded-xs font-bold">
                      Scene {user.scene}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => triggerAlert("Copied live session workspace sharing link to clipboard!")}
              className="mt-2 w-full bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 font-bold text-[9px] uppercase tracking-wider py-2 rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Invite Collaborators</span>
            </button>
          </div>

          {/* Comments and review thread panel - 8 cols */}
          <div className="lg:col-span-8 bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Cinematic Notes &amp; Comments Feed</span>
              </span>

              {/* Filtering */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-white/30 uppercase">Filter:</span>
                <select
                  value={selectedCommentFilter}
                  onChange={(e) => setSelectedCommentFilter(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}
                  className="bg-black border border-white/10 rounded-sm p-1 text-[9px] text-white/70 font-mono"
                >
                  <option value="all">All Scenes</option>
                  {storyboard.scenes.map((s, idx) => (
                    <option key={idx} value={idx + 1}>Scene {idx + 1}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comment Submission Form */}
            <form onSubmit={submitComment} className="flex gap-2.5">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={`Type visual feedback note on Scene ${activeSceneIndex + 1}...`}
                className="flex-grow bg-[#080809] border border-white/10 rounded-sm px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-cyan-500 font-sans"
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-[9px] uppercase tracking-wider px-4 py-2.5 rounded-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Post Note</span>
              </button>
            </form>

            {/* Live Comments Stream */}
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredComments.length === 0 ? (
                <div className="text-center py-8 text-[10px] font-mono text-white/30 uppercase">
                  No commentary logs on this scene block. Add your feedback above!
                </div>
              ) : (
                filteredComments.map((comment) => (
                  <div key={comment.id} className="bg-black/20 border border-white/5 p-3.5 rounded-xs flex gap-3 animate-fade-in">
                    <img
                      src={comment.avatar}
                      alt={comment.user}
                      className="w-8 h-8 rounded-full border border-white/5 object-cover shrink-0"
                    />
                    <div className="flex flex-col gap-1.5 flex-grow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-white/90">{comment.user}</span>
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-xs uppercase ${
                            comment.role === "director" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            comment.role === "cinematographer" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            comment.role === "sound-designer" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                            "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            {comment.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono bg-neutral-900 px-1.5 py-0.5 rounded-xs text-white/40">
                            Scene {comment.sceneNum}
                          </span>
                          <span className="text-[8px] font-mono text-white/30">{comment.time}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-white/70 font-sans leading-relaxed">
                        {comment.text}
                      </p>

                      <div className="flex justify-between items-center text-[8px] font-mono text-white/30 mt-1">
                        <span>REVISION COMPLIANCE APPROVED</span>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className="flex items-center gap-1 text-white/40 hover:text-cyan-400 transition-all cursor-pointer"
                        >
                          <Heart className="w-3 h-3 fill-transparent hover:fill-current" />
                          <span>Agree ({comment.likes})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>
      )}

      {/* --- PANEL 4: EXPORT FLEXIBILITY EXPORT CENTER --- */}
      {activeSubTab === "export" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Settings Column - 6 cols */}
          <div className="lg:col-span-6 bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
            <div className="border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Export Configurations</span>
            </div>

            <div className="flex flex-col gap-4">
              
              {/* Export Format Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono uppercase tracking-wider text-white/40">A. Output Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["mp4", "webm", "gif"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => { setExportFormat(fmt); setRenderedFile(null); }}
                      className={`py-2 text-[10px] font-mono uppercase rounded-xs border transition-all cursor-pointer ${
                        exportFormat === fmt
                          ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                          : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                      }`}
                    >
                      {fmt === "mp4" ? "🎬 MP4 (H.264)" : fmt === "webm" ? "🕸️ WebM (VP9)" : "🖼️ Anim GIF"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution selection */}
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                <label className="text-[9px] font-mono uppercase tracking-wider text-white/40">B. Frame Resolution (Social &amp; Film Presets)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  
                  <button
                    onClick={() => { setExportResolution("1080p"); setRenderedFile(null); }}
                    className={`py-2 text-[9px] font-mono uppercase rounded-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      exportResolution === "1080p"
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                        : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>FHD 1080p</span>
                    <span className="text-[7px] text-white/20">1920x1080</span>
                  </button>

                  <button
                    onClick={() => { setExportResolution("4k"); setRenderedFile(null); }}
                    className={`py-2 text-[9px] font-mono uppercase rounded-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      exportResolution === "4k"
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                        : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                    }`}
                  >
                    <Clapperboard className="w-4 h-4" />
                    <span>Cinema 4K</span>
                    <span className="text-[7px] text-white/20">3840x2160</span>
                  </button>

                  <button
                    onClick={() => { setExportResolution("vertical"); setRenderedFile(null); }}
                    className={`py-2 text-[9px] font-mono uppercase rounded-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      exportResolution === "vertical"
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                        : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Social 9:16</span>
                    <span className="text-[7px] text-white/20">1080x1920</span>
                  </button>

                  <button
                    onClick={() => { setExportResolution("square"); setRenderedFile(null); }}
                    className={`py-2 text-[9px] font-mono uppercase rounded-xs border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      exportResolution === "square"
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                        : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                    <span>Square 1:1</span>
                    <span className="text-[7px] text-white/20">1080x1080</span>
                  </button>

                </div>
              </div>

              {/* Framerate Selection */}
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                <label className="text-[9px] font-mono uppercase tracking-wider text-white/40">C. Frame Rate (FPS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {([24, 30, 60] as const).map((fps) => (
                    <button
                      key={fps}
                      onClick={() => { setExportFps(fps); setRenderedFile(null); }}
                      className={`py-1.5 text-[10px] font-mono uppercase rounded-xs border transition-all cursor-pointer ${
                        exportFps === fps
                          ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                          : "border-white/5 bg-black/20 text-white/40 hover:text-white"
                      }`}
                    >
                      {fps === 24 ? "🎬 24 (Cinema)" : fps === 30 ? "📺 30 (Broadcast)" : "⚡ 60 (Ultra Smooth)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bitrate slide limit */}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                <div className="flex justify-between text-[9px] font-mono text-white/40 uppercase">
                  <span>D. Render Encoding Bitrate</span>
                  <span className="text-white/80">{exportBitrate} Mbps</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="45"
                  step="1"
                  value={exportBitrate}
                  onChange={(e) => { setExportBitrate(Number(e.target.value)); setRenderedFile(null); }}
                  className="accent-cyan-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
                />
                <span className="text-[7.5px] font-mono text-white/30 leading-normal">
                  Higher bitrates yield stunning details but increase file package sizes. Mapped to local storage disk caches procedurally.
                </span>
              </div>

            </div>
          </div>

          {/* Rendering Progress and Download Column - 6 cols */}
          <div className="lg:col-span-6 bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col justify-between gap-4">
            
            <div className="border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Production Pipelines</span>
            </div>

            {/* Simulated Stage or Progress bar */}
            <div className="bg-black/50 border border-white/5 p-5 rounded-sm flex flex-col gap-4 items-center justify-center min-h-[180px] relative text-center">
              
              {!isRendering && !renderedFile && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Video className="w-10 h-10 text-white/20 animate-pulse" />
                  <h4 className="text-xs font-mono uppercase text-white/70">Renderer Cold State</h4>
                  <p className="text-[10px] text-white/40 font-sans max-w-xs leading-relaxed">
                    Set up your resolutions and formats on the left column, then trigger our high-fidelity procedural pipeline to compile vectors and audio channels.
                  </p>
                </div>
              )}

              {isRendering && (
                <div className="w-full flex flex-col gap-4 px-2">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                      Compiling Vector frames...
                    </span>
                    <span className="text-[9px] font-mono text-white/50 leading-relaxed italic min-h-[24px]">
                      {renderStep}
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-100 shadow-md shadow-cyan-500/50"
                      style={{ width: `${renderProgress}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[8px] font-mono text-white/30 uppercase">
                    <span>Target format: {exportFormat.toUpperCase()}</span>
                    <span>{renderProgress}% Complete</span>
                  </div>
                </div>
              )}

              {renderedFile && (
                <div className="w-full flex flex-col gap-3.5 animate-fade-in p-2">
                  <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
                  
                  <div className="flex flex-col gap-1 text-center">
                    <h4 className="text-[11px] font-mono uppercase text-emerald-400 font-extrabold tracking-wider">
                      Cinematic Render Succeeded!
                    </h4>
                    <span className="text-xs font-sans text-neutral-300 font-bold truncate max-w-xs mx-auto">
                      {renderedFile.name}
                    </span>
                    <span className="text-[9px] font-mono text-white/40 uppercase">
                      File Size: {renderedFile.size} // Codec: {exportFormat === "gif" ? "LZW" : exportFormat === "webm" ? "VP9" : "H.264/AAC"}
                    </span>
                  </div>

                  <button
                    onClick={triggerMockDownload}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Production File</span>
                  </button>
                </div>
              )}

            </div>

            {/* Execute Render button */}
            {!isRendering && (
              <button
                onClick={handleStartRender}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 rounded-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/5 cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>Execute Production Render</span>
              </button>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
