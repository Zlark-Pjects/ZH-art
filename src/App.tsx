import { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Film, 
  Sliders, 
  Download, 
  RefreshCw, 
  Music, 
  Layers, 
  Video, 
  ArrowRight, 
  ArrowLeft,
  ChevronRight,
  MonitorPlay,
  Flame,
  HelpCircle,
  Eye,
  Settings,
  Grid,
  Upload,
  Image,
  Compass,
  Globe,
  Wand2,
  Bone,
  Palette
} from "lucide-react";
import { synth } from "./lib/synth";
import { useVideoRender } from "./lib/useVideoRender";
import { Storyboard, Scene, VisualPreset, MusicPreset, VisualResearchResult } from "./types";
import RiggingMoCap from "./components/RiggingMoCap";
import CreativeSuite from "./components/CreativeSuite";
import ProductivityStudio from "./components/ProductivityStudio";
import { motion, AnimatePresence } from "motion/react";

// Static UI style presets matching the user's Editorial aesthetic
const VISUAL_PRESETS: { id: VisualPreset; name: string; desc: string; sampleGradient: string }[] = [
  { id: "cinema", name: "Cinema Classic", desc: "Golden hour high-contrast shadows", sampleGradient: "from-amber-950/40 to-slate-900/40" },
  { id: "cyberpunk", name: "Cyberpunk Noir", desc: "Neon pink & electric cyan grids", sampleGradient: "from-fuchsia-950/40 to-cyan-950/40" },
  { id: "anime", name: "Anime Sky", desc: "Pastel dream skies & floral wind", sampleGradient: "from-pink-950/30 to-purple-900/30" },
  { id: "watercolor", name: "Watercolor Bleed", desc: "Soft organic paint gradients", sampleGradient: "from-orange-950/20 to-stone-900/40" },
  { id: "oil-painting", name: "Oil Canvas", desc: "Thick layers & deep saturated tones", sampleGradient: "from-amber-900/30 to-yellow-950/30" },
  { id: "vaporwave", name: "Vaporwave Sunset", desc: "Retro-fi magenta solar horizons", sampleGradient: "from-pink-900/40 to-indigo-950/40" },
  { id: "line-art", name: "Monochrome Grid", desc: "High-key wireframe configurations", sampleGradient: "from-neutral-900/50 to-neutral-950/50" },
  { id: "retro-pixel", name: "Retro Pixel", desc: "High-contrast saturated arcade palette", sampleGradient: "from-red-950/40 to-emerald-950/40" },
];

const MUSIC_PRESETS: { id: MusicPreset; name: string; desc: string }[] = [
  { id: "ambient", name: "Cosmic Ambient", desc: "Long atmospheric drones & space echoes" },
  { id: "synthwave", name: "Cyberpunk Beat", desc: "Driving 80s synth bass & neon arpeggios" },
  { id: "cinematic", name: "Epic Cinematic", desc: "Grand chord progressions & acoustic bells" },
  { id: "lofi", name: "Lounge Lofi", desc: "Lazy jazz notes & vinyl rain noise" },
  { id: "chiptune", name: "Retro Chiptune", desc: "Hyper-speed 8-bit arcade arpeggiators" },
];

// Fallback storyboard default for startup
const INITIAL_PROMPT = "Astronaut fishing for stars on a cosmic crescent moon";

export default function App() {
  // Main states
  const [activeTab, setActiveTab] = useState<"storyboard" | "animate" | "text-to-animation" | "research" | "mocap" | "creative-suite" | "productivity">("storyboard");
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [selectedStyle, setSelectedStyle] = useState<VisualPreset>("cinema");
  const [selectedMusic, setSelectedMusic] = useState<MusicPreset>("ambient");
  
  // Visual Research states (Internet Surfing Grounding Agent)
  const [researchQuery, setResearchQuery] = useState("Cyberpunk arcade at dusk");
  const [researchResult, setResearchResult] = useState<VisualResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatusMessage, setResearchStatusMessage] = useState("");
  const [researchHistory, setResearchHistory] = useState<string[]>([
    "Cyberpunk arcade at dusk",
    "Astronaut on celestial crescent moon",
    "Watercolor mystical dark forest",
    "Surreal underwater glowing city"
  ]);

  // Text to Animation state variables (NEW!)
  const [textAnimationPrompt, setTextAnimationPrompt] = useState("A majestic glowing crystal phoenix rising from dark obsidian ashes, fuchsia embers drifting");
  const [textAnimationAspectRatio, setTextAnimationAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [textAnimationMotion, setTextAnimationMotion] = useState("zoom-in");
  const [textAnimationVibe, setTextAnimationVibe] = useState<VisualPreset>("cinema");
  const textRender = useVideoRender();
  const { status: textAnimatingStatus, progress: textAnimatingProgress, url: textAnimatedVideoUrl } = textRender;
  const [textAnimationInputError, setTextAnimationError] = useState("");
  const textAnimationError = textAnimationInputError || textRender.error;
  
  // Generation & playback states
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBpm, setCustomBpm] = useState(100);
  const [customScale, setCustomScale] = useState<"major" | "minor" | "pentatonic" | "phrygian">("pentatonic");
  
  // Real Veo AI Video generation state
  const veoRender = useVideoRender();
  const { status: veoStatus, progress: veoProgress, url: veoVideoUrl, error: veoError } = veoRender;
  const [veoPrompt, setVeoPrompt] = useState("");

  // Hugging Face state variables
  const [hfImages, setHfImages] = useState<Record<number, string>>({});
  const [hfModelId, setHfModelId] = useState("black-forest-labs/FLUX.1-schnell");
  const [hfPrompt, setHfPrompt] = useState("");
  const [isHfGenerating, setIsHfGenerating] = useState(false);
  const [hfStatusMessage, setHfStatusMessage] = useState("");

  // Image animation state variables
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageMime, setUploadedImageMime] = useState<string | null>(null);
  const [animationPrompt, setAnimationPrompt] = useState("");
  const [animationAspectRatio, setAnimationAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const animateRender = useVideoRender();
  const { status: animatingStatus, progress: animatingProgress, url: animatedVideoUrl } = animateRender;
  const [animationInputError, setAnimationError] = useState("");
  const animationError = animationInputError || animateRender.error;

  // Canvas and playback animation timeline trackers
  const [sceneElapsedTime, setSceneElapsedTime] = useState(0);
  const [generationHistory, setGenerationHistory] = useState<Storyboard[]>([]);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  // Entrance Animation / Loader states
  const [isIntroPlaying, setIsIntroPlaying] = useState(true);
  const [introProgress, setIntroProgress] = useState(0);

  // Audio Analyser State for Live visualizer in Editorial side panel
  const [analyserData, setAnalyserData] = useState<number[]>(new Array(16).fill(0));
  const [analyserPeaks, setAnalyserPeaks] = useState<number[]>(new Array(16).fill(0));
  const [frequencyLevels, setFrequencyLevels] = useState({ bass: 0, mid: 0, treble: 0 });

  // Refs
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const analyserIntervalRef = useRef<any>(null);

  // Initialize with a default storyboard on mount & run intro progress timer
  useEffect(() => {
    triggerGenerateStoryboard(true);

    const progressTimer = setInterval(() => {
      setIntroProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        const inc = Math.floor(Math.random() * 8) + 4;
        return Math.min(100, prev + inc);
      });
    }, 60);

    const autoTransitionTimer = setTimeout(() => {
      setIsIntroPlaying(false);
    }, 2200);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(autoTransitionTimer);
    };
  }, []);

  // Apply the tempo and scale controls live, without restarting playback
  useEffect(() => {
    synth.updateBpm(customBpm);
  }, [customBpm]);

  useEffect(() => {
    synth.setScale(customScale);
  }, [customScale]);

  // The animation loop reads these through refs so it always sees the current scene
  const storyboardRef = useRef(storyboard);
  storyboardRef.current = storyboard;
  const activeSceneIndexRef = useRef(activeSceneIndex);
  activeSceneIndexRef.current = activeSceneIndex;

  // Handle Play / Pause sequence toggle
  const togglePlay = () => {
    if (!storyboard) return;
    
    if (isPlaying) {
      setIsPlaying(false);
      synth.stop();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      clearInterval(analyserIntervalRef.current);
    } else {
      setIsPlaying(true);
      startTimeRef.current = null;
      synth.start(storyboard.musicVibe, customScale, customBpm);
      synth.setMute(isAudioMuted);
      
      // Setup live visualizer sampler
      const analyser = synth.getAnalyser();
      if (analyser) {
        // Boost responsiveness by updating every 30ms (approx 33fps)
        analyserIntervalRef.current = setInterval(() => {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          const points: number[] = [];
          
          for (let i = 0; i < 16; i++) {
            let sum = 0;
            let count = 0;
            let startBin = 0;
            let endBin = 0;
            
            // Logarithmic mapping allocating more bins/precision to Lows/Mids
            if (i < 4) {
              // Bass: bins 1 to 4
              startBin = i + 1;
              endBin = startBin + 1;
            } else if (i < 9) {
              // Low-Mids / Mids: bins 5 to 14
              startBin = 5 + (i - 4) * 2;
              endBin = startBin + 2;
            } else if (i < 13) {
              // High-Mids: bins 15 to 38
              startBin = 15 + (i - 9) * 6;
              endBin = startBin + 6;
            } else {
              // Treble: bins 39 to 110 (compresses high frequency noise)
              startBin = 39 + (i - 13) * 23;
              endBin = Math.min(bufferLength - 1, startBin + 23);
            }
            
            for (let bin = startBin; bin < endBin; bin++) {
              if (dataArray[bin] !== undefined) {
                sum += dataArray[bin];
                count++;
              }
            }
            
            let avgVal = count > 0 ? sum / count : 0;
            
            // Equalization / Weighting to make higher frequencies bouncy and dynamic
            let boost = 1.0;
            if (i < 4) {
              boost = 1.25; // Punchy low-end
            } else if (i < 9) {
              boost = 1.0; // Warm middle range
            } else if (i < 13) {
              boost = 1.45; // Clear vocals / instruments
            } else {
              boost = 1.95; // Compensate for treble roll-off
            }
            
            points.push(Math.min(255, Math.max(0, avgVal * boost)));
          }
          
          // Compute overall level averages for interactive UI effects
          // Bass Level (average of bars 0 to 4, scaled 0 to 1)
          const rawBass = points.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
          const bass = Math.min(1.0, rawBass / 220);
          
          // Mid Level (average of bars 5 to 10, scaled 0 to 1)
          const rawMid = points.slice(5, 11).reduce((a, b) => a + b, 0) / 6;
          const mid = Math.min(1.0, rawMid / 180);
          
          // Treble Level (average of bars 11 to 15, scaled 0 to 1)
          const rawTreble = points.slice(11, 16).reduce((a, b) => a + b, 0) / 5;
          const treble = Math.min(1.0, rawTreble / 140);
          
          setAnalyserData(points);
          setFrequencyLevels({ bass, mid, treble });
          
          // Update peaks with smooth gravitational decay
          setAnalyserPeaks((prevPeaks) => {
            const nextPeaks = [...prevPeaks];
            for (let i = 0; i < 16; i++) {
              const currentVal = points[i];
              const prevPeak = prevPeaks[i] || 0;
              if (currentVal >= prevPeak) {
                // Peak is pushed up instantly
                nextPeaks[i] = currentVal;
              } else {
                // Peak decays slowly via gravity
                nextPeaks[i] = Math.max(0, prevPeak - 4.5);
              }
            }
            return nextPeaks;
          });
        }, 30);
      }

      // Animation loop
      const runTimeline = (timestamp: number) => {
        const board = storyboardRef.current;
        if (!board) return;
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const safeIdx = Math.min(activeSceneIndexRef.current, board.scenes.length - 1);
        const currentScene = board.scenes[safeIdx];
        
        const elapsed = (timestamp - startTimeRef.current) / 1000;
        setSceneElapsedTime(elapsed);

        if (elapsed >= currentScene.duration) {
          // Progress to next scene
          startTimeRef.current = timestamp;
          setSceneElapsedTime(0);
          setActiveSceneIndex((prev) => {
            const nextIdx = prev + 1;
            if (nextIdx >= board.scenes.length) {
              return 0; // Loop storyboard back
            }
            return nextIdx;
          });
        }
        requestRef.current = requestAnimationFrame(runTimeline);
      };
      requestRef.current = requestAnimationFrame(runTimeline);
    }
  };

  // Set Mute
  const handleToggleMute = () => {
    const newMute = !isAudioMuted;
    setIsAudioMuted(newMute);
    synth.setMute(newMute);
  };

  // Generate Storyboard using Gemini model endpoint
  const triggerGenerateStoryboard = async (isFirst = false) => {
    setIsGenerating(true);
    // Reset video player in case old video exists
    veoRender.reset();

    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: isFirst ? INITIAL_PROMPT : prompt,
          style: selectedStyle,
          musicVibe: selectedMusic,
          skipAI: isFirst,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to contact backend engine");
      }

      const data: Storyboard = await response.json();
      setStoryboard(data);
      setCustomBpm(data.tempoBpm || 100);
      setCustomScale(data.scale || "pentatonic");
      setActiveSceneIndex(0);
      setSceneElapsedTime(0);
      
      // Stop old audio player on transition
      if (isPlaying) {
        setIsPlaying(false);
        synth.stop();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        clearInterval(analyserIntervalRef.current);
      }

      // Store in generation history
      setGenerationHistory(prev => {
        // avoid duplicating same title
        if (prev.some(p => p.title === data.title)) return prev;
        return [data, ...prev].slice(0, 4);
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate background via Hugging Face Models
  const triggerGenerateHF = async (customPrompt?: string) => {
    const promptToUse = customPrompt || hfPrompt || (storyboard ? (storyboard.scenes[safeActiveSceneIndex]?.visualDescription || "") : "");
    if (!promptToUse) {
      setHfStatusMessage("Please enter or copy a visual prompt first.");
      return;
    }
    setIsHfGenerating(true);
    setHfStatusMessage("Invoking Hugging Face inference pipeline...");

    try {
      const response = await fetch("/api/generate-hf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToUse,
          modelId: hfModelId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Hugging Face endpoint returned an error.");
      }

      const data = await response.json();
      if (data.imageUrl) {
        setHfImages(prev => ({
          ...prev,
          [safeActiveSceneIndex]: data.imageUrl
        }));
        setHfStatusMessage(data.isFallback 
          ? "Demo placeholder loaded! Add HF_TOKEN in secrets for real models."
          : "Successfully rendered backdrop via Hugging Face!"
        );
      } else {
        throw new Error("No image URL returned from server.");
      }
    } catch (err: any) {
      console.error(err);
      setHfStatusMessage(`Error: ${err.message || "Failed to call Hugging Face model"}`);
    } finally {
      setIsHfGenerating(false);
    }
  };

  // Visual research web-grounded surfing handler
  const triggerVisualResearch = async (customQuery?: string) => {
    const queryToUse = customQuery || researchQuery;
    if (!queryToUse.trim()) {
      setResearchStatusMessage("Please enter a research topic.");
      return;
    }
    setIsResearching(true);
    setResearchStatusMessage("Spinning up visual research agent... Surfing web trends...");

    try {
      const response = await fetch("/api/research-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToUse,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to contact research server");
      }

      const data: VisualResearchResult = await response.json();
      setResearchResult(data);
      setResearchStatusMessage("");
      
      // Add to search history if not duplicate
      setResearchHistory(prev => {
        if (prev.includes(queryToUse)) return prev;
        return [queryToUse, ...prev].slice(0, 6);
      });
    } catch (error: any) {
      console.error(error);
      setResearchStatusMessage(`Research limit reached. Serviced visual concept profile.`);
    } finally {
      setIsResearching(false);
    }
  };

  // Start real Veo AI video generation
  const startVeoVideoRender = () => {
    if (!storyboard) return;
    const finalRenderPrompt = `${prompt}. Style: ${selectedStyle} digital cinematography, gorgeous background of ${storyboard.scenes[0].backgroundColor}, dramatic parallax layout.`;
    setVeoPrompt(finalRenderPrompt);
    veoRender.start("/api/generate-video", {
      prompt: finalRenderPrompt,
      aspectRatio: "16:9",
      resolution: "720p",
    });
  };

  // Image-to-video animation of the uploaded image
  const triggerAnimateImage = () => {
    if (!uploadedImage) {
      setAnimationError("Please upload a photo first.");
      return;
    }
    setAnimationError("");
    animateRender.start("/api/animate-image", {
      image: uploadedImage,
      prompt: animationPrompt,
      aspectRatio: animationAspectRatio,
    });
  };

  // Direct text-to-video
  const triggerTextToVideo = () => {
    if (!textAnimationPrompt.trim()) {
      setTextAnimationError("Please enter a text prompt.");
      return;
    }
    setTextAnimationError("");
    textRender.start("/api/text-to-video", {
      prompt: textAnimationPrompt,
      aspectRatio: textAnimationAspectRatio,
      motionStyle: textAnimationMotion,
      vibe: textAnimationVibe,
    });
  };

  // Visual Renderer math for canvas elements: Parallax offsets
  const getCameraOffset = (scene: Scene) => {
    const motion = scene.cameraMotion;
    const progress = Math.min(1, sceneElapsedTime / scene.duration);
    
    // Scale interpolate
    const scale = motion.scaleStart + (motion.scaleEnd - motion.scaleStart) * progress;
    // Position interpolate
    const x = motion.xStart + (motion.xEnd - motion.xStart) * progress;
    const y = motion.yStart + (motion.yEnd - motion.yStart) * progress;

    return { scale, x, y };
  };

  const safeActiveSceneIndex = storyboard && storyboard.scenes && storyboard.scenes.length > 0
    ? Math.min(activeSceneIndex, storyboard.scenes.length - 1)
    : 0;

  return (
    <div id="app-root" className="bg-[#0A0A0B] text-[#E5E5E5] min-h-screen w-full flex flex-col p-4 md:p-8 font-sans antialiased border border-white/10 selection:bg-white selection:text-black">
      
      <AnimatePresence>
        {isIntroPlaying && (
          <motion.div
            key="intro-screen"
            initial={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              filter: "blur(12px)",
              scale: 1.02,
              transition: { duration: 0.8, ease: "easeInOut" }
            }}
            className="fixed inset-0 z-50 bg-[#070708] text-white flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none"
          >
            {/* Ambient glows behind the content */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] animate-pulse duration-[6000ms]"></div>
              <div className="absolute bottom-1/4 right-1/3 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] animate-pulse duration-[8000ms]"></div>
              
              {/* Technical subtle digital grid */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70"></div>
            </div>

            {/* Top metadata row */}
            <div className="z-10 flex justify-between items-center">
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 0.5, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="font-mono text-[9px] uppercase tracking-[0.25em]"
              >
                STATION: SYSTEM_BOOT_STAGE_1
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 0.5, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="font-mono text-[9px] uppercase tracking-[0.25em] text-right"
              >
                PROT. V.2.5 // CREATIVE WORKSPACE
              </motion.div>
            </div>

            {/* Central elegant branding */}
            <div className="z-10 flex flex-col items-center justify-center text-center my-auto max-w-xl mx-auto">
              {/* Sparkles icon animate */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="mb-6 p-3 rounded-full bg-white/5 border border-white/10"
              >
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </motion.div>

              <motion.h1 
                initial={{ letterSpacing: "0.2em", opacity: 0, scale: 0.95 }}
                animate={{ letterSpacing: "-0.04em", opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-6xl md:text-8xl font-serif italic font-black text-white leading-none tracking-tighter"
              >
                ZH-art
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-xs md:text-sm font-light uppercase tracking-[0.4em] text-cyan-200/90 mt-4"
              >
                Generative Video Engine
              </motion.p>

              {/* Progress bar and tech lines */}
              <div className="w-64 md:w-80 mt-10 space-y-3">
                <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${introProgress}%` }}
                    transition={{ ease: "easeInOut" }}
                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-indigo-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                  />
                </div>
                
                <div className="flex justify-between items-center text-[10px] font-mono text-white/40">
                  <span>
                    {introProgress < 30 ? "SYNTHESIZING SOUNDSCAPE..." :
                     introProgress < 65 ? "MAPPING GRADIENT ARRAYS..." :
                     introProgress < 90 ? "RIGGING VECTOR ANCHORS..." : "SYSTEM READY"}
                  </span>
                  <span>{introProgress}%</span>
                </div>
              </div>
            </div>

            {/* Bottom info and skip trigger */}
            <div className="z-10 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-white/5 pt-6">
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="font-mono text-[9px] uppercase tracking-wider text-center md:text-left leading-relaxed max-w-md"
              >
                procedural canvas rendering active. ambient oscillator synth initialized at 100bpm. hf pipelines synced.
              </motion.p>
              
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                onClick={() => setIsIntroPlaying(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white hover:text-black text-white rounded-sm text-[10px] font-mono uppercase tracking-[0.2em] transition-all duration-300 shadow-md hover:shadow-cyan-500/10 cursor-pointer"
              >
                Skip Intro & Enter Workspace
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-baseline mb-8 md:mb-12 border-b border-white/10 pb-6 gap-4">
        <div className="flex flex-col md:flex-row items-baseline gap-4">
          <h1 className="text-5xl md:text-6xl font-serif font-black tracking-tighter italic text-white">ZH-art</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.3em] uppercase opacity-50 bg-white/5 px-2 py-0.5 border border-white/10">Generative Video Engine v.2.5</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" title="System Ready"></span>
          </div>
        </div>
        <nav className="flex items-center gap-6 text-[10px] uppercase tracking-widest font-medium opacity-70">
          <span className="text-white border-b border-white pb-1">Video Workspace</span>
          <button 
            onClick={() => setShowConfigHelp(!showConfigHelp)} 
            className="hover:text-white cursor-pointer transition-colors"
          >
            Guide & API Docs
          </button>
        </nav>
      </header>

      {/* Storyboard Demand / Fallback Warning Notice */}
      {storyboard?.warning && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 rounded-sm flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 animate-pulse shrink-0"></div>
          <div>
            <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-400 block mb-0.5">High API Traffic Fallback</span>
            {storyboard.warning}
          </div>
        </div>
      )}

      {/* Creative Studio Workspace Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-7 bg-[#111112] border border-white/5 p-1 rounded-sm gap-1 sm:gap-0 mb-6">
        <button
          onClick={() => setActiveTab("storyboard")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "storyboard"
              ? "bg-white text-black font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Storyboard</span>
        </button>
        <button
          onClick={() => setActiveTab("animate")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "animate"
              ? "bg-amber-500 text-black font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Animate</span>
        </button>
        <button
          onClick={() => setActiveTab("text-to-animation")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "text-to-animation"
              ? "bg-purple-600 text-white font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Text To Video</span>
        </button>
        <button
          onClick={() => setActiveTab("research")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "research"
              ? "bg-indigo-600 text-white font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Visual Surf</span>
        </button>
        <button
          onClick={() => setActiveTab("mocap")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "mocap"
              ? "bg-cyan-500 text-black font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Bone className="w-3.5 h-3.5" />
          <span>MoCap Rig</span>
        </button>
        <button
          onClick={() => setActiveTab("creative-suite")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 ${
            activeTab === "creative-suite"
              ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Creative Suite</span>
        </button>
        <button
          onClick={() => setActiveTab("productivity")}
          className={`py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xs flex items-center justify-center gap-1 col-span-2 sm:col-span-1 ${
            activeTab === "productivity"
              ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Productivity</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <main className="grid grid-cols-12 gap-6 lg:gap-10 flex-grow">
        
        {activeTab === "mocap" ? (
          <div className="col-span-12">
            <RiggingMoCap />
          </div>
        ) : activeTab === "creative-suite" ? (
          <div className="col-span-12">
            <CreativeSuite />
          </div>
        ) : activeTab === "productivity" ? (
          <div className="col-span-12">
            <ProductivityStudio
              storyboard={storyboard}
              setStoryboard={setStoryboard}
              activeSceneIndex={activeSceneIndex}
              setActiveSceneIndex={setActiveSceneIndex}
              setSelectedStyle={setSelectedStyle}
              setSelectedMusic={setSelectedMusic}
              setPrompt={setPrompt}
            />
          </div>
        ) : (
          <>
            {/* Left Control Column: 5 Cols */}
            <section id="control-panel" className="col-span-12 lg:col-span-5 flex flex-col gap-6">

          {activeTab === "storyboard" && (
            <>
              {/* SECTION 01: Prompt Manifesto */}
          <div className="bg-[#111112] border border-white/5 p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none"></div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40">01</span>
                <h2 className="text-xs uppercase tracking-widest font-semibold text-white/80">Manifesto / Cinematic Prompt</h2>
              </div>
              <span className="text-[9px] font-mono bg-white/10 text-white px-1.5 py-0.5 rounded-sm">ZH-Generator</span>
            </div>
            
            <div className="relative">
              <span className="absolute -left-3 -top-3 text-4xl font-serif text-white/10 select-none">“</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe your cinematic universe in rich artistic prose..."
                className="w-full bg-transparent text-xl font-serif italic leading-snug text-white border-none outline-none resize-none focus:ring-0 placeholder:text-neutral-700"
              />
            </div>
            <div className="mt-3 h-[1px] w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent"></div>
          </div>

          {/* SECTION 02: Visual Style Preset Grid */}
          <div className="bg-[#111112] border border-white/5 p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40">02</span>
                <h2 className="text-xs uppercase tracking-widest font-semibold text-white/80">Atmospheric Visual Preset</h2>
              </div>
              <span className="text-[9px] font-mono opacity-50">{VISUAL_PRESETS.length} presets loaded</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {VISUAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedStyle(preset.id)}
                  className={`text-left p-2.5 rounded-sm border transition-all relative ${
                    selectedStyle === preset.id
                      ? "bg-white/5 border-white text-white font-medium"
                      : "bg-transparent border-white/5 hover:border-white/20 hover:bg-white/5 text-neutral-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${preset.sampleGradient}`}></span>
                    <span className="text-xs uppercase tracking-wider">{preset.name}</span>
                  </div>
                  <p className="text-[9px] opacity-40 mt-1 truncate">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 03: Synthesizer & Audio Sequencer Layer */}
          <div className="bg-[#111112] border border-white/5 p-5 relative">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40">03</span>
                <h2 className="text-xs uppercase tracking-widest font-semibold text-white/80">Procedural Auditory Synth</h2>
              </div>
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-white/40 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Web Audio API</span>
              </div>
            </div>

            {/* Custom Synth Presets */}
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {MUSIC_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedMusic(p.id)}
                  className={`py-2 text-[10px] uppercase font-bold tracking-wider rounded-sm transition-all border ${
                    selectedMusic === p.id
                      ? "bg-white text-black border-white"
                      : "bg-black/40 text-neutral-400 border-white/10 hover:bg-white/5"
                  }`}
                  title={p.desc}
                >
                  {p.id}
                </button>
              ))}
            </div>            {/* Live Audio Spectrum Visualizer */}
            <div 
              className="p-4 bg-black/40 border border-white/10 rounded-sm mb-4 transition-all duration-300"
              style={{
                boxShadow: isPlaying 
                  ? `0 0 ${15 + frequencyLevels.bass * 25}px rgba(244, 63, 94, ${0.05 + frequencyLevels.bass * 0.25}), inset 0 0 ${10 + frequencyLevels.treble * 15}px rgba(168, 85, 247, ${frequencyLevels.treble * 0.15})`
                  : 'none',
                borderColor: isPlaying 
                  ? `rgba(255, 255, 255, ${0.1 + frequencyLevels.bass * 0.15})` 
                  : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-[9px] font-mono opacity-50 uppercase tracking-wider">Dynamic Mix Spectrum</span>
                <span className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase flex items-center gap-1">
                  {isPlaying ? (
                    <>
                      <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                      LIVE AUDIO_STREAM
                    </>
                  ) : "STANDBY"}
                </span>
              </div>
              
              <div className="flex gap-1 h-14 items-end justify-center px-1 overflow-hidden">
                {analyserData.map((val, idx) => {
                  const heightPercent = Math.max(8, Math.floor((val / 255) * 100));
                  const peakPercent = Math.max(8, Math.min(95, Math.floor((analyserPeaks[idx] / 255) * 100)));
                  
                  // Color styling based on specific frequency bands (Bass vs. Mids vs. Treble)
                  let barColor = "bg-white/10";
                  if (isPlaying) {
                    if (idx < 5) {
                      // Bass frequencies (0-4): Neon Rose/Amber
                      barColor = "bg-gradient-to-t from-rose-600 via-orange-500 to-amber-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]";
                    } else if (idx < 11) {
                      // Mids/Voice frequencies (5-10): Neon Emerald/Cyan
                      barColor = "bg-gradient-to-t from-teal-600 via-emerald-500 to-cyan-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
                    } else {
                      // Treble frequencies (11-15): Violet/Indigo/Fuchsia
                      barColor = "bg-gradient-to-t from-blue-600 via-indigo-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]";
                    }
                  }
                  
                  return (
                    <div key={idx} className="relative w-full h-full flex flex-col justify-end">
                      {/* Real-time drop peak indicators */}
                      {isPlaying && (
                        <div 
                          style={{ bottom: `${peakPercent}%` }}
                          className="absolute left-0 right-0 h-[1.5px] bg-white rounded-full transition-all duration-75 z-10 opacity-70"
                        />
                      )}
                      
                      {/* Spectrum Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full transition-all duration-75 rounded-t-sm ${barColor}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Band Activity Monitors */}
              <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-white/5 text-[9px] font-mono">
                <div className="flex items-center gap-1.5">
                  <div 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isPlaying ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-neutral-800'}`}
                    style={{ opacity: isPlaying ? 0.3 + frequencyLevels.bass * 0.7 : 0.2 }}
                  />
                  <span className="text-neutral-500 uppercase">Bass {isPlaying && `(${Math.floor(frequencyLevels.bass * 100)}%)`}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isPlaying ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-neutral-800'}`}
                    style={{ opacity: isPlaying ? 0.3 + frequencyLevels.mid * 0.7 : 0.2 }}
                  />
                  <span className="text-neutral-500 uppercase">Mids {isPlaying && `(${Math.floor(frequencyLevels.mid * 100)}%)`}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isPlaying ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]' : 'bg-neutral-800'}`}
                    style={{ opacity: isPlaying ? 0.3 + frequencyLevels.treble * 0.7 : 0.2 }}
                  />
                  <span className="text-neutral-500 uppercase">Treble {isPlaying && `(${Math.floor(frequencyLevels.treble * 100)}%)`}</span>
                </div>
              </div>
            </div>

            {/* Sequencer Live Config */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1">
                  Tempo: {customBpm} BPM
                </label>
                <input
                  type="range"
                  min="60"
                  max="160"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(Number(e.target.value))}
                  className="w-full accent-white bg-white/10 h-1 rounded-sm appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1">
                  Musical Harmony
                </label>
                <select
                  value={customScale}
                  onChange={(e: any) => setCustomScale(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-sm p-1 text-xs text-white"
                >
                  <option value="major">Major Scale</option>
                  <option value="minor">Natural Minor</option>
                  <option value="pentatonic">Pentatonic Starfield</option>
                  <option value="phrygian">Phrygian Cyberpunk</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Trigger Row */}
          <button
            onClick={() => triggerGenerateStoryboard()}
            disabled={isGenerating}
            className="w-full py-4.5 bg-white text-black font-bold uppercase tracking-[0.25em] text-xs hover:bg-neutral-200 transition-all cursor-pointer flex items-center justify-center gap-2 relative shadow-lg active:scale-[0.99] disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Assembling Creative Storyboard...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>Initialize AI Storyboard</span>
              </>
            )}
          </button>

          {/* Render real Veo AI Video generator if storyboard is generated */}
          {storyboard && (
            <div className="bg-[#111112] border border-dashed border-white/20 p-4 rounded-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-amber-400" />
                    Full AI Cinematic Video Render
                  </h3>
                  <p className="text-[10px] opacity-50 mt-1">
                    Convert this multi-scene storyboard layout into a single, cohesive AI cinematic masterwork using Google's professional video models.
                  </p>
                </div>
              </div>

              {veoStatus === "idle" && (
                <button
                  onClick={startVeoVideoRender}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase tracking-wider text-[10px] rounded-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  Request Full AI Video Render
                </button>
              )}

              {veoStatus === "requesting" && (
                <div className="text-center py-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-1" />
                  <p className="text-[10px] font-mono text-amber-400">CONTACTING GOOGLE VEO CLUSTERS...</p>
                </div>
              )}

              {veoStatus === "rendering" && (
                <div className="bg-black/40 p-3 border border-white/10 rounded-sm">
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-amber-400 uppercase animate-pulse">Veo Render in Progress...</span>
                    <span>{veoProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-sm overflow-hidden">
                    <div 
                      style={{ width: `${veoProgress}%` }} 
                      className="bg-amber-400 h-full transition-all duration-1000"
                    ></div>
                  </div>
                  <p className="text-[9px] opacity-40 mt-1.5 font-mono truncate">Prompt: {veoPrompt}</p>
                </div>
              )}

              {veoStatus === "completed" && (
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-sm flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase">AI Video Generation Completed!</p>
                    <p className="text-[9px] opacity-50">High-fidelity mp4 rendering successfully loaded into player.</p>
                  </div>
                  <button 
                    onClick={() => {
                      // Trigger native browser download helper for the video file
                      if (veoVideoUrl) {
                        const a = document.createElement("a");
                        a.href = veoVideoUrl;
                        a.download = `ZH-art-render-${Date.now()}.mp4`;
                        a.click();
                      }
                    }}
                    className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-sm transition-all"
                    title="Download Generated Video"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {veoStatus === "error" && (
                <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-sm">
                  <p className="text-[10px] font-bold text-rose-400">VIDEO RENDER UNAVAILABLE</p>
                  <p className="text-[9px] opacity-60 mt-1">
                    {veoError || "The render failed."} The live storyboard preview above still works without it.
                  </p>
                  <button
                    onClick={veoRender.reset}
                    className="mt-2 text-[9px] uppercase tracking-wider underline opacity-80 hover:opacity-100 block"
                  >
                    Reset Pipeline
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hugging Face Model Studio Block */}
          {storyboard && (
            <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-3.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/40">04</span>
                  <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                    Hugging Face Model Studio
                  </h3>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 tracking-wider uppercase">Inference API</span>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1">
                  Active Generation Model
                </label>
                <select
                  value={hfModelId}
                  onChange={(e) => setHfModelId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-sm p-2 text-xs text-white outline-none focus:border-white/30 transition-all font-mono cursor-pointer"
                >
                  <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell (Ultra fast 12-step HF Recommended)</option>
                  <option value="stabilityai/stable-diffusion-3.5-large">Stable Diffusion 3.5 Large (Photorealistic Detail)</option>
                  <option value="stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL Base (Classic Artistic)</option>
                  <option value="prompthero/openjourney">OpenJourney (Midjourney v4 Artistic Style)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-[10px] uppercase tracking-wider opacity-50">
                    Visual Backdrop Prompt
                  </label>
                  <button
                    onClick={() => setHfPrompt(storyboard.scenes[safeActiveSceneIndex].visualDescription)}
                    className="text-[9px] uppercase tracking-wider text-cyan-400 hover:text-white underline cursor-pointer"
                  >
                    Copy active scene description
                  </button>
                </div>
                <textarea
                  value={hfPrompt}
                  onChange={(e) => setHfPrompt(e.target.value)}
                  placeholder="Describe your scene backdrop in exquisite detail... e.g., 'A gorgeous photorealistic neon cyberpunk city alleyway at dusk, high fidelity digital art'"
                  rows={2}
                  className="w-full bg-black/60 border border-white/10 rounded-sm p-2 text-xs text-white outline-none focus:border-white/30 resize-none placeholder:text-neutral-700"
                />
              </div>

              {hfStatusMessage && (
                <div className="p-2.5 bg-black/40 border border-white/5 text-[10px] font-mono text-white/80 rounded-sm leading-relaxed flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                  {hfStatusMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerGenerateHF()}
                  disabled={isHfGenerating}
                  className="py-2.5 px-3 bg-cyan-500 hover:bg-cyan-600 text-black font-bold uppercase tracking-wider text-[10px] rounded-sm transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isHfGenerating ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>Generate Backdrop</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setHfImages(prev => {
                      const updated = { ...prev };
                      delete updated[safeActiveSceneIndex];
                      return updated;
                    });
                    setHfStatusMessage("Reverted scene background to procedural atmospheric gradient.");
                  }}
                  disabled={!hfImages[safeActiveSceneIndex]}
                  className="py-2.5 px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-sm transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                >
                  <span>Reset Backdrop</span>
                </button>
              </div>
            </div>
          )}
            </>
          )}

          {/* SECTION: Animate Photo to Video (Veo) */}
          {activeTab === "animate" && (
            <div className="flex flex-col gap-5">
              {/* Photo Upload Area with Drag-and-Drop and File Dialog support */}
              <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">01</span>
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                      Source Image / Master Artwork
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 border border-amber-500/20 uppercase">
                    Veo Input
                  </span>
                </div>

                <div 
                  className="border-2 border-dashed border-white/10 hover:border-white/30 rounded-xs p-8 text-center transition-all cursor-pointer bg-black/40 flex flex-col items-center justify-center gap-3 relative min-h-[180px]"
                  onClick={() => document.getElementById("photo-upload-input")?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      const file = files[0];
                      if (file.type.startsWith("image/")) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setUploadedImage(reader.result as string);
                          setUploadedImageMime(file.type);
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                  }}
                >
                  <input
                    id="photo-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setUploadedImage(reader.result as string);
                          setUploadedImageMime(file.type);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {uploadedImage ? (
                    <div className="absolute inset-0 w-full h-full p-2 flex items-center justify-center bg-black/80 rounded-xs group/img">
                      <img 
                        src={uploadedImage} 
                        alt="Uploaded artwork" 
                        className="max-w-full max-h-full object-contain border border-white/10 shadow-lg rounded-xs"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-2">
                        <span className="text-xs font-mono uppercase bg-white text-black px-2.5 py-1 text-[10px] font-bold">
                          Change Artwork
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImage(null);
                            setUploadedImageMime(null);
                            animateRender.reset();
                          }}
                          className="text-[10px] uppercase font-mono bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 font-bold rounded-xs cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-white/5 rounded-full border border-white/10 group-hover:bg-white/10 transition-colors">
                        <Upload className="w-5 h-5 text-white/60" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-white/80">
                          Drag & drop image here, or browse
                        </span>
                        <span className="text-[10px] text-white/40 font-mono">
                          Supports PNG, JPEG, WEBP (Max 25MB)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Animation settings & Prompt guiding */}
              <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">02</span>
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                      Animation Prompt Guide
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono opacity-50 uppercase">Motion Path</span>
                </div>

                <div>
                  <textarea
                    value={animationPrompt}
                    onChange={(e) => setAnimationPrompt(e.target.value)}
                    placeholder="Describe how the photo should animate... e.g., 'A slow dynamic zoom into the face, cosmic sparks drift around, soft cinematic ambient lighting.'"
                    rows={3}
                    className="w-full bg-black/60 border border-white/10 rounded-sm p-3 text-xs text-white outline-none focus:border-white/30 resize-none placeholder:text-neutral-700 font-sans"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1">
                    <span>Guidance for motion vector</span>
                    <span>Optional</span>
                  </div>
                </div>

                {/* Aspect Ratio choice */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1.5 font-mono">
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAnimationAspectRatio("16:9")}
                        className={`py-2 text-[10px] font-bold uppercase border cursor-pointer rounded-xs transition-all ${
                          animationAspectRatio === "16:9"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        16:9 Landscape
                      </button>
                      <button
                        onClick={() => setAnimationAspectRatio("9:16")}
                        className={`py-2 text-[10px] font-bold uppercase border cursor-pointer rounded-xs transition-all ${
                          animationAspectRatio === "9:16"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        9:16 Portrait
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1.5 font-mono">
                      Target Engine Model
                    </label>
                    <div className="py-2 px-3 bg-black/60 border border-white/10 rounded-xs text-[10px] font-mono text-amber-400">
                      veo-3.1-fast-generate-preview
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Progress indicators */}
              {animatingStatus !== "idle" && (
                <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="uppercase text-amber-400 flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {animatingStatus === "requesting" && "Contacting Veo Server..."}
                      {animatingStatus === "rendering" && "Veo Animation in progress..."}
                      {animatingStatus === "completed" && "Animation Render Completed!"}
                      {animatingStatus === "error" && "Animation pipeline error"}
                    </span>
                    <span>{animatingProgress}%</span>
                  </div>

                  <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
                    <div 
                      style={{ width: `${animatingProgress}%` }} 
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-1000"
                    ></div>
                  </div>

                  {animatingStatus === "rendering" && (
                    <div className="text-[10px] font-mono leading-relaxed opacity-60 text-white/80 p-2.5 bg-black/50 border border-white/5 rounded-xs mt-1">
                      <p>✨ Step 1: Parsing master artwork features</p>
                      <p className="animate-pulse">🌌 Step 2: Running temporal flow vectors using Veo-3.1-Fast...</p>
                    </div>
                  )}

                  {animationError && (
                    <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-xs text-[10px] leading-relaxed text-rose-200">
                      <p className="font-bold uppercase tracking-wider text-[11px] text-rose-400 mb-1">
                        Render failed
                      </p>
                      {animationError}
                    </div>
                  )}
                </div>
              )}

              {/* Trigger Buttons */}
              {animatingStatus !== "rendering" && animatingStatus !== "requesting" && (
                <button
                  onClick={triggerAnimateImage}
                  disabled={!uploadedImage}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-800 text-black font-bold uppercase tracking-[0.2em] text-xs transition-all cursor-pointer flex items-center justify-center gap-2 relative shadow-lg active:scale-[0.99] disabled:text-white/30 disabled:pointer-events-none"
                >
                  <Film className="w-4 h-4 text-black" />
                  <span>Animate Artwork with Veo</span>
                </button>
              )}
            </div>
          )}

          {/* SECTION: Direct Text-to-Animation Conversion (Veo) */}
          {activeTab === "text-to-animation" && (
            <div className="flex flex-col gap-5">
              {/* Concept Prompt input */}
              <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">01</span>
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                      Animation Concept Prompt
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 border border-purple-500/20 uppercase">
                    Veo Text Input
                  </span>
                </div>

                <div>
                  <textarea
                    value={textAnimationPrompt}
                    onChange={(e) => setTextAnimationPrompt(e.target.value)}
                    placeholder="Describe your visual concept in rich detail... e.g., 'A majestic glowing crystal phoenix rising from dark obsidian ashes, fuchsia embers drifting, 8k cinematic, volumetric fog.'"
                    rows={3}
                    className="w-full bg-black/60 border border-white/10 rounded-sm p-3 text-xs text-white outline-none focus:border-purple-500/30 resize-none placeholder:text-neutral-700 font-sans"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1">
                    <span>Guidance for physical simulation</span>
                    <span>100 words max recommended</span>
                  </div>
                </div>
              </div>

              {/* Vibe and Camera Motion Configuration */}
              <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">02</span>
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                      Aesthetic Preset Vibe
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono opacity-50 uppercase">Art Style</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {VISUAL_PRESETS.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setTextAnimationVibe(v.id)}
                      className={`p-2.5 text-left border cursor-pointer rounded-xs transition-all relative overflow-hidden flex flex-col gap-0.5 ${
                        textAnimationVibe === v.id
                          ? "bg-purple-950/20 text-purple-200 border-purple-500"
                          : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider block">{v.name}</span>
                      <span className="text-[9px] opacity-50 line-clamp-1">{v.desc}</span>
                      {textAnimationVibe === v.id && (
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Camera Motion Vector selection */}
                <div className="mt-2">
                  <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1.5 font-mono">
                    Camera Motion Directional Vector
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "zoom-in", label: "Slow Zoom In" },
                      { id: "pan-left", label: "Pan Left" },
                      { id: "pan-right", label: "Pan Right" },
                      { id: "tilt-up", label: "Tilt Up" },
                      { id: "tilt-down", label: "Tilt Down" },
                      { id: "orbit", label: "Orbit Rotation" }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setTextAnimationMotion(m.id)}
                        className={`py-1.5 text-[9px] font-bold uppercase border cursor-pointer rounded-xs transition-all text-center ${
                          textAnimationMotion === m.id
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-black/40 text-white/50 border-white/10 hover:border-white/20"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio choice */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1.5 font-mono">
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTextAnimationAspectRatio("16:9")}
                        className={`py-2 text-[10px] font-bold uppercase border cursor-pointer rounded-xs transition-all ${
                          textAnimationAspectRatio === "16:9"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        16:9 Landscape
                      </button>
                      <button
                        onClick={() => setTextAnimationAspectRatio("9:16")}
                        className={`py-2 text-[10px] font-bold uppercase border cursor-pointer rounded-xs transition-all ${
                          textAnimationAspectRatio === "9:16"
                            ? "bg-white text-black border-white"
                            : "bg-black/40 text-white/60 border-white/10 hover:border-white/20"
                        }`}
                      >
                        9:16 Portrait
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider opacity-50 block mb-1.5 font-mono">
                      Target Engine Model
                    </label>
                    <div className="py-2 px-3 bg-black/60 border border-white/10 rounded-xs text-[10px] font-mono text-purple-400">
                      veo-3.1-fast-generate-preview
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Progress indicators */}
              {textAnimatingStatus !== "idle" && (
                <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="uppercase text-purple-400 flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {textAnimatingStatus === "requesting" && "Contacting Veo Text Engine..."}
                      {textAnimatingStatus === "rendering" && "Veo Text-to-Video in progress..."}
                      {textAnimatingStatus === "completed" && "Video Render Completed!"}
                      {textAnimatingStatus === "error" && "Text-to-Video pipeline error"}
                    </span>
                    <span>{textAnimatingProgress}%</span>
                  </div>

                  <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
                    <div 
                      style={{ width: `${textAnimatingProgress}%` }} 
                      className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-1000"
                    ></div>
                  </div>

                  {textAnimatingStatus === "rendering" && (
                    <div className="text-[10px] font-mono leading-relaxed opacity-60 text-white/80 p-2.5 bg-black/50 border border-white/5 rounded-xs mt-1">
                      <p>✨ Step 1: Synthesizing concept prompts and spatial coordinates</p>
                      <p className="animate-pulse">🌌 Step 2: Generating text-to-video frames with Veo-3.1-Fast...</p>
                    </div>
                  )}

                  {textAnimationError && (
                    <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-xs text-[10px] leading-relaxed text-rose-200">
                      <p className="font-bold uppercase tracking-wider text-[11px] text-rose-400 mb-1">
                        Render failed
                      </p>
                      {textAnimationError}
                    </div>
                  )}
                </div>
              )}

              {/* Trigger Buttons */}
              {textAnimatingStatus !== "rendering" && textAnimatingStatus !== "requesting" && (
                <button
                  onClick={triggerTextToVideo}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 text-white font-bold uppercase tracking-[0.2em] text-xs transition-all cursor-pointer flex items-center justify-center gap-2 relative shadow-lg active:scale-[0.99] disabled:pointer-events-none"
                >
                  <Wand2 className="w-4 h-4 text-white animate-pulse" />
                  <span>Convert Text to Animation</span>
                </button>
              )}
            </div>
          )}

          {/* SECTION: Visual Search & Surf (Research) */}
          {activeTab === "research" && (
            <div className="flex flex-col gap-5">
              
              {/* Query Selection and Search */}
              <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">01</span>
                    <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">
                      Visual Aesthetic Grounding Agent
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 border border-indigo-500/20 uppercase flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" />
                    Web Search
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={researchQuery}
                      onChange={(e) => setResearchQuery(e.target.value)}
                      placeholder="Enter a visual concept (e.g., Neon retro arcade)..."
                      className="w-full bg-black/60 border border-white/10 rounded-sm p-3 pr-10 text-xs text-white outline-none focus:border-indigo-500/50 font-sans"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") triggerVisualResearch();
                      }}
                    />
                    <button
                      onClick={() => triggerVisualResearch()}
                      disabled={isResearching}
                      className="absolute right-2 top-2 text-white/40 hover:text-white cursor-pointer disabled:opacity-35"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                    </button>
                  </div>

                  {/* Pre-filled Suggestions */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[9px] text-white/30 self-center uppercase font-mono mr-1">Trending:</span>
                    {["Cyberpunk arcade at dusk", "Astronaut crescent moon", "Watercolor mystical forest", "Glowing underwater city"].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setResearchQuery(suggestion);
                          triggerVisualResearch(suggestion);
                        }}
                        className="text-[9px] font-mono bg-white/5 border border-white/10 hover:border-white/30 text-white/70 hover:text-white px-2 py-0.5 rounded-xs transition-all cursor-pointer"
                      >
                        {suggestion.split(" ").slice(0, 3).join(" ")}...
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                {!isResearching && (
                  <button
                    onClick={() => triggerVisualResearch()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-[0.15em] text-[10px] transition-all cursor-pointer rounded-xs"
                  >
                    Surf Internet & Research Visuals
                  </button>
                )}
              </div>

              {/* Status Indicator */}
              {isResearching && (
                <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="uppercase text-indigo-400 flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {researchStatusMessage || "Surfing the internet..."}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-sm overflow-hidden">
                    <div className="bg-indigo-500 h-full w-2/3 animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Result Panel */}
              {researchResult && !isResearching && (
                <div className="flex flex-col gap-5">
                  {/* Summary Block */}
                  <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4 relative overflow-hidden">
                    {researchResult.warning && (
                      <div className="text-[10px] text-amber-400 font-mono bg-amber-500/10 p-2 border border-amber-500/20 rounded-xs mb-2">
                        ⚠️ {researchResult.warning}
                      </div>
                    )}
                    
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400">Aesthetic Vibe</span>
                      <h4 className="text-xl font-serif font-black italic text-white mt-1 leading-tight">
                        {researchResult.aestheticName}
                      </h4>
                    </div>

                    <p className="text-xs leading-relaxed text-white/70 italic font-serif">
                      "{researchResult.description}"
                    </p>

                    {/* Color Palette visualizer */}
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block mb-2">Researched Color Palette</span>
                      <div className="grid grid-cols-4 gap-2">
                        {researchResult.colorPalette.map((colorStr, idx) => {
                          // Try to extract color code
                          const hexMatch = colorStr.match(/#[0-9a-fA-F]{6}/);
                          const colorHex = hexMatch ? hexMatch[0] : "#333333";
                          const label = colorStr.split("(")[0].trim();
                          return (
                            <div key={idx} className="flex flex-col gap-1">
                              <div 
                                className="h-8 w-full rounded-xs border border-white/10 shadow-sm" 
                                style={{ backgroundColor: colorHex }}
                                title={colorStr}
                              ></div>
                              <span className="text-[8px] font-mono text-white/50 truncate" title={colorStr}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Concept Tags */}
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block mb-2">Key Visual Anchors (Click to append)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {researchResult.keyConcepts.map((concept, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setPrompt(prev => prev ? `${prev}, ${concept}` : concept);
                            }}
                            className="text-[9px] font-mono bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-indigo-300 hover:text-white px-2 py-1 rounded-sm transition-all cursor-pointer flex items-center gap-1"
                            title="Click to append to main prompt"
                          >
                            <span># {concept}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Production Ready Prompts Section */}
                  <div className="bg-[#111112] border border-white/5 p-5 flex flex-col gap-4">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">Curated Prompts from Internet Research</span>
                    
                    <div className="flex flex-col gap-3.5">
                      {researchResult.prompts.map((pText, pIdx) => (
                        <div key={pIdx} className="bg-black/50 border border-white/5 p-3 rounded-xs flex flex-col gap-2.5">
                          <p className="text-[11px] leading-relaxed text-white/80 font-serif italic">
                            "{pText}"
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setPrompt(pText);
                                setActiveTab("storyboard");
                              }}
                              className="py-1 px-2.5 bg-white text-black hover:bg-neutral-200 text-[9px] font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              Storyboard Prompt
                            </button>
                            <button
                              onClick={() => {
                                setHfPrompt(pText);
                                setActiveTab("storyboard");
                                // Wait a moment then highlight the HF visual section
                                setTimeout(() => {
                                  const hfSec = document.getElementById("hf-backdrop-section");
                                  if (hfSec) hfSec.scrollIntoView({ behavior: "smooth" });
                                }, 100);
                              }}
                              className="py-1 px-2.5 bg-indigo-900 border border-indigo-700/50 text-indigo-200 hover:text-white hover:bg-indigo-800 text-[9px] font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Image className="w-2.5 h-2.5" />
                              HF Backdrop
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grounding Sources */}
                  {researchResult.sources && researchResult.sources.length > 0 && (
                    <div className="bg-[#111112] border border-white/5 p-4 rounded-xs text-[9px] font-mono text-white/40 flex items-center justify-between gap-2">
                      <span className="uppercase tracking-wider">Search Sources Grounded:</span>
                      <span className="text-right text-indigo-300 truncate">
                        {researchResult.sources.join(" • ")}
                      </span>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

        </section>

        {/* Right Preview Column: 7 Cols */}
        <section id="preview-panel" className="col-span-12 lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Visual Cinematic Player */}
          <div className="relative aspect-video w-full bg-[#121214] border border-white/5 overflow-hidden group shadow-2xl flex flex-col">
            
            {/* Tab: Animate (Image to Video) */}
            {activeTab === "animate" && (
              animatedVideoUrl ? (
                /* Authenticated Animated Video Player */
                <div className="absolute inset-0 w-full h-full bg-black">
                  <video
                    src={animatedVideoUrl}
                    autoPlay
                    loop
                    controls
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none z-10">
                    <span className="bg-black/80 px-2 py-1 text-[9px] font-mono text-amber-400 uppercase tracking-widest border border-amber-500/20 rounded-sm">
                      ● VEO ANIME RENDER ACTIVE
                    </span>
                  </div>
                  {/* Download button */}
                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = animatedVideoUrl;
                        a.download = `ZH-art-animated-render-${Date.now()}.mp4`;
                        a.click();
                      }}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-bold font-mono uppercase rounded-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Video
                    </button>
                  </div>
                </div>
              ) : uploadedImage ? (
                /* Uploaded Image Preview */
                <div className="absolute inset-0 w-full h-full bg-black/40 flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/80 pointer-events-none"></div>
                  <img 
                    src={uploadedImage} 
                    alt="Active artwork" 
                    className="max-w-full max-h-full object-contain border border-white/10 shadow-2xl rounded-xs filter brightness-90"
                  />
                  <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none">
                    <span className="bg-black/80 px-2 py-1 text-[9px] font-mono text-white/60 uppercase tracking-widest border border-white/10 rounded-sm">
                      ● READY FOR VEO ANIMATION
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md p-3 border border-white/10 rounded-sm text-center">
                    <p className="text-[10px] font-mono text-white/50 uppercase">Motion Target</p>
                    <p className="text-xs text-white/90 italic font-serif mt-1">
                      {animationPrompt || "Procedural cosmic temporal flow will be generated"}
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty Animator State */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center animate-pulse bg-white/5">
                    <Image className="w-6 h-6 text-white/40" />
                  </div>
                  <div>
                    <h4 className="text-sm uppercase tracking-widest font-bold text-neutral-300">No Artwork Uploaded</h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Upload an image in the left panel to begin your Veo video animation workflow.
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Tab: Text to Animation */}
            {activeTab === "text-to-animation" && (
              textAnimatedVideoUrl ? (
                /* Text to Animation Video Player */
                <div className="absolute inset-0 w-full h-full bg-black">
                  <video
                    src={textAnimatedVideoUrl}
                    autoPlay
                    loop
                    controls
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none z-10">
                    <span className="bg-black/80 px-2 py-1 text-[9px] font-mono text-purple-400 uppercase tracking-widest border border-purple-500/20 rounded-sm">
                      ● VEO TEXT ANIMATION ACTIVE
                    </span>
                  </div>
                  {/* Download button */}
                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = textAnimatedVideoUrl;
                        a.download = `ZH-art-text-animation-${Date.now()}.mp4`;
                        a.click();
                      }}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-bold font-mono uppercase rounded-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Video
                    </button>
                  </div>
                </div>
              ) : textAnimatingStatus === "rendering" || textAnimatingStatus === "requesting" ? (
                /* Kinetic Rendering State */
                <div className="absolute inset-0 bg-[#0c0c0e] flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-950/20 via-black to-black opacity-80 pointer-events-none"></div>
                  <div className="w-20 h-20 relative flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"></div>
                    <Wand2 className="w-7 h-7 text-purple-400 animate-pulse" />
                  </div>
                  <div className="z-10">
                    <h4 className="text-sm uppercase tracking-widest font-bold text-purple-300 animate-pulse">Veo Engine Simulating Canvas</h4>
                    <p className="text-xs text-neutral-400 mt-2 max-w-xs font-mono">
                      Generating high-fidelity frames: {textAnimatingProgress}%
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty Text Animator State */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center bg-purple-950/20 shadow-[0_0_15px_rgba(147,51,234,0.1)]">
                    <Wand2 className="w-6 h-6 text-purple-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm uppercase tracking-widest font-bold text-neutral-300">Generate Direct Animation</h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Write a physical motion description in the left panel to trigger the Veo-3.1 generative engine.
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Tab: Storyboard Studio */}
            {activeTab !== "animate" && activeTab !== "text-to-animation" && (
              storyboard ? (
                veoVideoUrl ? (
                  /* Authenticated AI Generated Video Stream */
                  <div className="absolute inset-0 w-full h-full bg-black">
                    <video
                      src={veoVideoUrl}
                      autoPlay
                      loop
                      muted={isAudioMuted}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none">
                      <span className="bg-black/80 px-2 py-1 text-[9px] font-mono text-emerald-400 uppercase tracking-widest border border-emerald-500/20 rounded-sm">
                        ● VEO AI VIDEO STREAM
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Procedural Storyboard Parallax Sandbox */
                  <div 
                    className="absolute inset-0 w-full h-full overflow-hidden flex flex-col justify-between transition-all duration-700"
                    style={{
                      background: hfImages[safeActiveSceneIndex]
                        ? `url(${hfImages[safeActiveSceneIndex]}) center/cover no-repeat`
                        : `linear-gradient(135deg, ${storyboard.scenes[safeActiveSceneIndex].gradientColors.join(', ')})`
                    }}
                  >
                    {/* Subtle Cinematic Vignette */}
                    <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60 pointer-events-none mix-blend-multiply"></div>
  
                    {/* Parallax elements loop */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Scene Background Depth (Depth 1) */}
                      <div 
                        className="absolute inset-0 transition-transform duration-75 ease-out"
                        style={{
                          transform: `scale(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).scale * 0.96}) translate(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).x * 0.4}px, ${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).y * 0.4}px)`
                        }}
                      >
                        {/* Depth-1 elements */}
                        {storyboard.scenes[safeActiveSceneIndex].elements
                          .filter(el => el.depth === 1)
                          .map((el, idx) => (
                            <div
                              key={idx}
                              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                              style={{
                                left: `${el.position.x}%`,
                                top: `${el.position.y}%`,
                                transform: `translate(-50%, -50%) scale(${1 + (isPlaying ? frequencyLevels.bass * 0.15 : 0)})`,
                              }}
                            >
                              <svg width={el.size} height={el.size} viewBox="0 0 100 100" style={{ opacity: 0.15 }}>
                                {el.shape === "circle" && <circle cx="50" cy="50" r="40" fill={el.color} />}
                                {el.shape === "ring" && <circle cx="50" cy="50" r="35" stroke={el.color} strokeWidth="6" fill="none" />}
                                {el.shape === "star" && <path d="M50 15 L62 38 L88 40 L68 57 L74 83 L50 69 L26 83 L32 57 L12 40 L38 38 Z" fill={el.color} />}
                                {el.shape === "polygon" && <polygon points="50,15 85,75 15,75" fill={el.color} />}
                                {el.shape === "rect" && <rect x="15" y="15" width="70" height="70" fill={el.color} />}
                                {el.shape === "line" && <line x1="10" y1="50" x2="90" y2="50" stroke={el.color} strokeWidth="3" />}
                                {el.shape === "spline" && <path d="M10,50 Q30,20 50,50 T90,50" fill="none" stroke={el.color} strokeWidth="3" />}
                              </svg>
                            </div>
                        ))}
                      </div>
  
                      {/* Scene Midground Depth (Depth 2) */}
                      <div 
                        className="absolute inset-0 transition-transform duration-75 ease-out"
                        style={{
                          transform: `scale(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).scale * 1.05}) translate(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).x * 0.8}px, ${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).y * 0.8}px)`
                        }}
                      >
                        {/* Depth-2 elements */}
                        {storyboard.scenes[safeActiveSceneIndex].elements
                          .filter(el => el.depth === 2)
                          .map((el, idx) => {
                            const pulseClass = el.movement === "pulse" ? "animate-pulse" : "";
                            const spinClass = el.movement === "rotate" ? "animate-spin" : "";
                            const floatClass = el.movement === "float" ? "animate-bounce" : "";
                            
                            return (
                              <div
                                key={idx}
                                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${pulseClass} ${spinClass} ${floatClass}`}
                                style={{
                                  left: `${el.position.x}%`,
                                  top: `${el.position.y}%`,
                                  transform: `translate(-50%, -50%) scale(${1 + (isPlaying ? frequencyLevels.mid * 0.20 : 0)})`,
                                  transition: "left 0.5s ease, top 0.5s ease, transform 0.05s ease"
                                }}
                              >
                                <svg width={el.size} height={el.size} viewBox="0 0 100 100">
                                  {el.shape === "circle" && <circle cx="50" cy="50" r="40" fill={el.color} />}
                                  {el.shape === "ring" && <circle cx="50" cy="50" r="35" stroke={el.color} strokeWidth="5" fill="none" />}
                                  {el.shape === "star" && <path d="M50 15 L62 38 L88 40 L68 57 L74 83 L50 69 L26 83 L32 57 L12 40 L38 38 Z" fill={el.color} />}
                                  {el.shape === "polygon" && <polygon points="50,15 85,75 15,75" fill={el.color} />}
                                  {el.shape === "rect" && <rect x="20" y="20" width="60" height="60" fill={el.color} />}
                                  {el.shape === "line" && <line x1="10" y1="50" x2="90" y2="50" stroke={el.color} strokeWidth="4" />}
                                  {el.shape === "spline" && <path d="M10,50 Q30,10 50,50 T90,50" fill="none" stroke={el.color} strokeWidth="4" />}
                                </svg>
                              </div>
                            );
                        })}
                      </div>
  
                      {/* Foreground Depth (Depth 3) */}
                      <div 
                        className="absolute inset-0 transition-transform duration-75 ease-out"
                        style={{
                          transform: `scale(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).scale * 1.15}) translate(${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).x * 1.3}px, ${getCameraOffset(storyboard.scenes[safeActiveSceneIndex]).y * 1.3}px)`
                        }}
                      >
                        {/* Depth-3 elements */}
                        {storyboard.scenes[safeActiveSceneIndex].elements
                          .filter(el => el.depth === 3)
                          .map((el, idx) => (
                            <div
                              key={idx}
                              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                              style={{
                                left: `${el.position.x}%`,
                                top: `${el.position.y}%`,
                                transform: `translate(-50%, -50%) scale(${1 + (isPlaying ? frequencyLevels.treble * 0.25 : 0)})`,
                              }}
                            >
                              <svg width={el.size} height={el.size} viewBox="0 0 100 100">
                                {el.shape === "circle" && <circle cx="50" cy="50" r="42" fill={el.color} />}
                                {el.shape === "ring" && <circle cx="50" cy="50" r="38" stroke={el.color} strokeWidth="8" fill="none" />}
                                {el.shape === "star" && <path d="M50 15 L62 38 L88 40 L68 57 L74 83 L50 69 L26 83 L32 57 L12 40 L38 38 Z" fill={el.color} />}
                                {el.shape === "polygon" && <polygon points="50,10 90,80 10,80" fill={el.color} />}
                                {el.shape === "rect" && <rect x="10" y="10" width="80" height="80" fill={el.color} />}
                                {el.shape === "line" && <line x1="5" y1="50" x2="95" y2="50" stroke={el.color} strokeWidth="6" />}
                                {el.shape === "spline" && <path d="M5,50 Q30,5 50,50 T95,50" fill="none" stroke={el.color} strokeWidth="6" />}
                              </svg>
                            </div>
                        ))}
                      </div>
  
                      {/* Particle Atmosphere Layer overlay */}
                      {storyboard.scenes[safeActiveSceneIndex].particles?.type !== "none" && (
                        <div 
                          className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                          style={{ opacity: 0.4 + (isPlaying ? frequencyLevels.treble * 0.5 : 0.2) }}
                        >
                          {/* Static CSS simulated particle floaters */}
                          <div className="absolute inset-0 overflow-hidden">
                            {Array.from({ length: Math.min(30, storyboard.scenes[safeActiveSceneIndex].particles?.count || 15) }).map((_, i) => {
                              const size = (storyboard.scenes[safeActiveSceneIndex].particles?.size || 3) * (0.6 + Math.random());
                              const top = Math.random() * 100;
                              const left = Math.random() * 100;
                              const animDuration = 10 + Math.random() * 15;
                              const animDelay = -Math.random() * 12;
                              return (
                                <div
                                  key={i}
                                  className="absolute rounded-full bg-white animate-pulse"
                                  style={{
                                    width: `${size}px`,
                                    height: `${size}px`,
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    backgroundColor: storyboard.scenes[safeActiveSceneIndex].particles?.color || "#fff",
                                    boxShadow: `0 0 8px ${storyboard.scenes[safeActiveSceneIndex].particles?.color || "#fff"}`,
                                    animation: `float ${animDuration}s infinite ease-in-out`,
                                    animationDelay: `${animDelay}s`
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
  
                    {/* Narration Overlay Card */}
                    <div className="z-10 bg-black/80 backdrop-blur-md p-4 mx-6 my-4 border border-white/10 rounded-sm">
                      <p className="text-[10px] uppercase font-mono text-white/40 mb-1">
                        Scene {storyboard.scenes[safeActiveSceneIndex].sceneNumber} // {storyboard.scenes[safeActiveSceneIndex].title}
                      </p>
                      <p className="text-sm font-serif italic text-white leading-relaxed">
                        {storyboard.scenes[safeActiveSceneIndex].narration}
                      </p>
                    </div>
                  </div>
                )
              ) : (
                /* Playback Placeholder Empty State */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                  <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center animate-pulse">
                    <Film className="w-6 h-6 text-white/40" />
                  </div>
                  <div>
                    <h4 className="text-sm uppercase tracking-widest font-bold">Workspace Empty</h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Enter a prompt on the left menu and trigger compilation to see custom animations.
                    </p>
                  </div>
                </div>
              )
            )}
 
            {/* Live Video Controls Overlay */}
            {activeTab === "storyboard" && storyboard && (
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-auto z-20">
                <div className="flex gap-2">
                  <button
                    onClick={togglePlay}
                    className="bg-black/80 hover:bg-white hover:text-black text-white px-3.5 py-1.5 text-[10px] font-mono border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer rounded-sm"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {isPlaying ? "PAUSE" : "PLAY VIDEO"}
                  </button>
 
                  <button
                    onClick={handleToggleMute}
                    className="bg-black/80 hover:bg-white hover:text-black text-white p-1.5 border border-white/20 transition-all cursor-pointer rounded-sm"
                    title={isAudioMuted ? "Unmute Synthesizer" : "Mute Synthesizer"}
                  >
                    {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
 
                <div className="flex gap-1.5">
                  <span className="bg-black/80 px-2 py-1 text-[9px] font-mono border border-white/10">
                    STYLE: {storyboard.visualStyle.toUpperCase()}
                  </span>
                  <span className="bg-black/80 px-2 py-1 text-[9px] font-mono border border-white/10 text-white">
                    {safeActiveSceneIndex + 1} / {storyboard.scenes.length}
                  </span>
                </div>
              </div>
            )}
 
            {/* Progress line indicator */}
            {activeTab === "storyboard" && storyboard && (
              <div className="absolute top-0 left-0 w-full h-[3px] bg-white/10 z-20">
                <div
                  style={{
                    width: `${((safeActiveSceneIndex + (sceneElapsedTime / storyboard.scenes[safeActiveSceneIndex].duration)) / storyboard.scenes.length) * 100}%`
                  }}
                  className="bg-white h-full transition-all duration-75"
                ></div>
              </div>
            )}
          </div>

          {/* Timeline / Scenes Switcher Thumbnails */}
          {activeTab === "storyboard" && storyboard && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] uppercase tracking-widest font-mono text-neutral-400">
                  Storyboard Sequence Grid
                </span>
                <span className="text-[9px] font-mono text-neutral-500">
                  Total Duration: {storyboard.scenes.reduce((acc, s) => acc + s.duration, 0)}s
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {storyboard.scenes.map((scene, index) => {
                  const isActive = activeSceneIndex === index;
                  return (
                    <button
                      key={scene.sceneNumber}
                      onClick={() => {
                        setActiveSceneIndex(index);
                        setSceneElapsedTime(0);
                      }}
                      className={`h-24 rounded-sm border relative overflow-hidden transition-all duration-300 text-left p-3 flex flex-col justify-between cursor-pointer ${
                        isActive
                          ? "border-white bg-white/5 shadow-md scale-[1.02] ring-1 ring-white/10"
                          : "border-white/10 bg-[#141416] opacity-60 hover:opacity-100 hover:scale-[1.02] hover:border-white/40 hover:shadow-lg hover:shadow-cyan-500/5"
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${scene.gradientColors[0]}aa, ${scene.gradientColors[1]}55)`
                      }}
                    >
                      <span className="text-[9px] font-mono text-white opacity-40 block">0{scene.sceneNumber}</span>
                      <div>
                        <span className="text-[10px] font-serif font-black italic text-white line-clamp-1">
                          {scene.title}
                        </span>
                        <p className="text-[8px] opacity-50 truncate mt-0.5 uppercase tracking-wide">
                          {scene.cameraMotion.type}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Production Crew Collaborative Dialogue Log */}
          {activeTab === "storyboard" && storyboard && storyboard.crewDialogue && (
            <div className="bg-[#111112] border border-white/5 p-5 mt-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/40">05</span>
                  <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80 flex items-center gap-1.5">
                    <span className="inline-flex gap-0.5">🎬🎥🎹</span>
                    AI Production Crew Co-Director Dialogue
                  </h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/20 uppercase tracking-widest">
                  Multi-Model Pipeline
                </span>
              </div>

              <div className="space-y-4 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                {storyboard.crewDialogue.map((msg, idx) => {
                  let roleColor = "border-rose-500/20 text-rose-400 bg-rose-500/5";
                  if (msg.role === "cinematographer") {
                    roleColor = "border-cyan-500/20 text-cyan-400 bg-cyan-500/5";
                  } else if (msg.role === "sound-designer") {
                    roleColor = "border-purple-500/20 text-purple-400 bg-purple-500/5";
                  }

                  return (
                    <div key={idx} className="flex gap-3 items-start text-xs border border-white/[0.02] p-3 rounded-sm bg-black/20">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-lg shadow-sm">
                        {msg.avatar}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-serif font-black italic text-white tracking-tight">{msg.name}</span>
                          <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.2 border rounded-full ${roleColor}`}>
                            {msg.role}
                          </span>
                        </div>
                        <p className="text-neutral-400 font-mono text-[11px] leading-relaxed italic">
                          "{msg.message}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Generations Gallery Row */}
          <div className="mt-4 border-t border-white/10 pt-5">
            <div className="flex justify-between items-center mb-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/70">
                Compositions Log
              </div>
              <span className="text-[9px] font-mono text-neutral-500">
                {generationHistory.length > 0 ? `01 / 0${generationHistory.length}` : "No history logs"}
              </span>
            </div>

            {generationHistory.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {generationHistory.map((hist, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setStoryboard(hist);
                      setActiveSceneIndex(0);
                      setSceneElapsedTime(0);
                    }}
                    className="p-3 bg-[#111112] hover:bg-[#1A1A1C] border border-white/5 rounded-sm text-left group transition-all cursor-pointer"
                  >
                    <p className="text-[9px] font-mono text-neutral-500 mb-1">v.{2.4 - index / 10}</p>
                    <p className="text-[11px] font-serif font-bold italic text-white group-hover:underline truncate">
                      {hist.title}
                    </p>
                    <span className="text-[8px] opacity-40 uppercase tracking-widest mt-1 block">
                      {hist.visualStyle}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center border border-dashed border-white/5 rounded-sm">
                <span className="text-[9px] uppercase tracking-widest text-neutral-600 font-mono">
                  Composition gallery empty
                </span>
              </div>
            )}
          </div>

        </section>
          </>
        )}

      </main>

      {/* Guide & API Help Sidebar / Modal */}
      {showConfigHelp && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-white/10 p-6 md:p-8 rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-baseline border-b border-white/10 pb-4 mb-6">
              <h3 className="text-3xl font-serif italic text-white">ZH-art System Manifesto</h3>
              <button 
                onClick={() => setShowConfigHelp(false)}
                className="text-[10px] uppercase tracking-widest font-mono text-neutral-400 hover:text-white"
              >
                [ CLOSE ]
              </button>
            </div>

            <div className="space-y-6 text-sm text-neutral-400 leading-relaxed">
              <div>
                <h4 className="text-white font-bold uppercase tracking-wider text-xs mb-2">1. Cinematic Storyboards</h4>
                <p>
                  Each time you click <strong className="text-white">Initialize AI Storyboard</strong>, ZH-art leverages Gemini 3.5 models to synthesize 4 detailed graphic environments containing gradient scales, vector coordinates, dynamic speeds, camera scales, and custom floating particle filters.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-wider text-xs mb-2">2. Procedural Background Synthesizer</h4>
                <p>
                  To provide immediate offline-first artistic sensory stimulation, we utilize the HTML5 Web Audio API to procedurally program a full soundscape directly inside your web container:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Bass:</strong> low-pass filtered triangle waves giving rhythmic context.</li>
                  <li><strong>Pad:</strong> polyphonic detuned triangle waveforms establishing space atmospheres.</li>
                  <li><strong>Arpeggiator:</strong> retro-futuristic high-pass square waves for synthetic melodies.</li>
                  <li><strong>Drums:</strong> frequency-sweeping sine kicks paired with custom filtered white-noise snare snaps.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-wider text-xs mb-2">3. Genuine Video Renders (Veo-3.1-lite)</h4>
                <p>
                  By inputting a validated Gemini API secret, the server can connect to Google's professional <strong className="text-white">Veo-3.1-lite-generate-preview</strong> model to transform your storyboard dimensions into high-definition digital videos.
                </p>
              </div>

              <div className="bg-[#18181B] border border-white/5 p-4 rounded-sm">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">Workspace Secrets Guide</span>
                <p className="text-[11px] leading-relaxed">
                  You can configure your real API secrets directly in the AI Studio UI sidebar. The application will immediately activate premium rendering layers once configuration completes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Details */}
      <footer className="mt-8 flex justify-between items-end opacity-30 text-[9px] uppercase tracking-[0.2em] font-mono">
        <div>System Status: Operational // Latency 24ms</div>
        <div>©2026 ZH-art Labs / San Francisco</div>
      </footer>

      {/* Simple absolute CSS keyframes inject for float animation */}
      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
          100% {
            transform: translateY(0px) translateX(0px);
          }
        }
      `}</style>
    </div>
  );
}
