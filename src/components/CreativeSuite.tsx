import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Palette,
  Sliders,
  Play,
  Volume2,
  RefreshCw,
  Camera,
  Layers,
  Smile,
  Shield,
  Sun,
  Flame,
  User,
  Check,
  ChevronRight,
  Eye,
  Settings,
  HelpCircle
} from "lucide-react";

// Types for the Creative Suite
interface SuggestionCard {
  sceneNumber: number;
  title: string;
  flowDescription: string;
  cameraAngle: string;
  cameraReason: string;
  transitionType: string;
  transitionReason: string;
  vfxNotes: string;
}

interface CreativeSuggestions {
  emotionalArc: string;
  cinematicVibe: string;
  suggestions: SuggestionCard[];
}

export default function CreativeSuite() {
  // --- Section 1: Storyboarding Assistance States ---
  const [sequencePrompt, setSequencePrompt] = useState("Quantum cybernetic gate opening inside a neon-lit cathedral, golden energy leaking");
  const [selectedStyle, setSelectedStyle] = useState("cyberpunk");
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionsResult, setSuggestionsResult] = useState<CreativeSuggestions | null>({
    emotionalArc: "Starting in high-contrast digital stillness, building to a dramatic neon-saturated crescendo, and resolving in massive electromagnetic emission.",
    cinematicVibe: "Anamorphic Cyberpunk Cathedral, utilizing dramatic vertical angles and rich crimson shadows.",
    suggestions: [
      {
        sceneNumber: 1,
        title: "The Quiet Sacred Terminal",
        flowDescription: "Establish a wide shot of the dark, cybernetic cathedral. Columns of steel and fiber optic bundles rise into shadowed vault arches. A tiny figure stands before an offline quantum gate, casting a long silhouette.",
        cameraAngle: "Extreme Low-Angle Wide Shot (24mm Lens)",
        cameraReason: "Emphasizes the massive spiritual scale of the tech cathedral, making the user feel dwarfed by the architecture and building immediate awe.",
        transitionType: "Bleed-in Cross Dissolve (2.0s)",
        transitionReason: "Enables the soft blue fiber optic column lights to seep into existence slowly, signifying power booting up.",
        vfxNotes: "Volumetric light shafts emitting from dark stained glass windows; gentle cyber sparks floating from columns."
      },
      {
        sceneNumber: 2,
        title: "Intimate Activation",
        flowDescription: "Zoom into the terminal console. The terminal screens flicker with complex code. The character's hand approaches, placing a high-contrast glowing crystal core into the mechanical slot. Sparks eject upon contact.",
        cameraAngle: "High-Contrast Macro Close-Up (90mm Lens)",
        cameraReason: "Forces the focus onto the tactical physical contact and the detailed electrical arcing, focusing all dramatic attention on the critical trigger event.",
        transitionType: "Anamorphic Focus Match Cut",
        transitionReason: "Instantly links the hand's pressure with the subsequent cosmic gate alignment in the background, maintaining psychological focus.",
        vfxNotes: "Bright lens flare across the frame; electric neon-blue sparks shooting in radial directions; chromatic aberration at frame edges."
      },
      {
        sceneNumber: 3,
        title: "Convergence & The Golden Rift",
        flowDescription: "The quantum gate rotates violently. Giant mechanical rings spin in opposing directions. The center of the gate tears open, revealing a bright golden nebula, with digital geometric grids shooting outward into the cathedral.",
        cameraAngle: "Sweeping Orbit Crane Shot with 15° Dutch Tilt",
        cameraReason: "Introduces dynamic, gravity-defying movement that underscores the tearing of space-time and the sheer triumph of the breach.",
        transitionType: "Kinetic Whip Pan",
        transitionReason: "Matches the intense physical rotation of the mechanical rings, pulling the camera back at warp speed to reveal the final masterpiece landscape.",
        vfxNotes: "Intense atmospheric bloom and light leaks; radial starfield streams converging at the center; heavy cinematic vignette."
      }
    ]
  });
  const [statusMsg, setStatusMsg] = useState("");

  // --- Section 2: Emotion & Expression Control States ---
  const [expression, setExpression] = useState<"joy" | "anger" | "sadness" | "fear" | "awe" | "neutral">("neutral");
  const [eyebrowRaise, setEyebrowRaise] = useState(20);
  const [eyebrowFurrow, setEyebrowFurrow] = useState(0);
  const [eyeSquint, setEyeSquint] = useState(10);
  const [eyeDilation, setEyeDilation] = useState(50);
  const [smileFactor, setSmileFactor] = useState(0); // -100 to 100
  const [mouthOpen, setMouthOpen] = useState(0);
  const [blushIntensity, setBlushIntensity] = useState(10);
  const [activeGesture, setActiveGesture] = useState<"welcoming" | "defensive" | "aggressive" | "triumphant" | "despondent" | "thoughtful">("thoughtful");
  const [gestureIntensity, setGestureIntensity] = useState(50);

  // Dialogue Auto-Sync States
  const [dialogueText, setDialogueText] = useState("We've breached the core mainframe. The system is finally ours!");
  const [dialogueMood, setDialogueMood] = useState<"triumphant" | "aggressive" | "sadness" | "fear" | "awe">("triumphant");
  const [isSyncingDialogue, setIsSyncingDialogue] = useState(false);
  const [waveAnimation, setWaveAnimation] = useState<number[]>(Array(15).fill(2));

  // --- Section 3: Customizable Assets States ---
  const [charClass, setCharClass] = useState<"astral" | "cyber" | "chrono" | "void" | "bio">("cyber");
  const [hairStyle, setHairStyle] = useState<"sleek" | "quantum" | "mech" | "ethereal">("quantum");
  const [hairColor, setHairColor] = useState("#00ffcc");
  const [eyeColor, setEyeColor] = useState("#ff0055");
  const [skinColor, setSkinColor] = useState("#d1dbed");

  const [costumeTheme, setCostumeTheme] = useState<"solar" | "trench" | "noble" | "mesh" | "runic">("trench");
  const [costumeAccentColor, setCostumeAccentColor] = useState("#ff007f");
  const [emissionBrightness, setEmissionBrightness] = useState(60);
  const [costumeDecal, setCostumeDecal] = useState<"star" | "grid" | "leaf" | "wing" | "none">("grid");

  const [backdrop, setBackdrop] = useState<"neon" | "nebula" | "forest" | "observatory" | "crystals">("neon");
  const [ambientIntensity, setAmbientIntensity] = useState(30);
  const [lightAngle, setLightAngle] = useState(135);

  // --- Section 4: Visual Effects Integration States ---
  const [lightingPreset, setLightingPreset] = useState<"rembrandt" | "rim" | "underglow" | "volumetric">("underglow");
  const [particleType, setParticleType] = useState<"sparks" | "embers" | "blossoms" | "grid" | "glyphs" | "dust">("sparks");
  const [particleSpeed, setParticleSpeed] = useState(2.0);
  const [particleCount, setParticleCount] = useState(60);
  const [particleSize, setParticleSize] = useState(3);
  const [colorGrade, setColorGrade] = useState<"teal-orange" | "noir" | "violet" | "gold" | "vivid">("violet");
  const [vfxContrast, setVfxContrast] = useState(110);
  const [vfxSaturation, setVfxSaturation] = useState(130);
  const [vfxVignette, setVfxVignette] = useState(40);
  const [vfxBloom, setVfxBloom] = useState(25);

  // Live Particle System Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trigger dialogue waveform animation + state morphing
  const runDialogueSync = () => {
    setIsSyncingDialogue(true);
    let count = 0;
    const interval = setInterval(() => {
      // Generate active waveform animation
      setWaveAnimation(Array.from({ length: 15 }, () => Math.floor(Math.random() * 28) + 4));
      count++;
      if (count > 12) {
        clearInterval(interval);
        setIsSyncingDialogue(false);
        setWaveAnimation(Array(15).fill(2));
        
        // Morph sliders based on selected mood
        if (dialogueMood === "triumphant") {
          setExpression("joy");
          setEyebrowRaise(45);
          setEyebrowFurrow(0);
          setEyeSquint(15);
          setEyeDilation(70);
          setSmileFactor(85);
          setMouthOpen(30);
          setBlushIntensity(40);
          setActiveGesture("triumphant");
          setGestureIntensity(90);
        } else if (dialogueMood === "aggressive") {
          setExpression("anger");
          setEyebrowRaise(10);
          setEyebrowFurrow(90);
          setEyeSquint(45);
          setEyeDilation(30);
          setSmileFactor(-60);
          setMouthOpen(20);
          setBlushIntensity(70);
          setActiveGesture("aggressive");
          setGestureIntensity(85);
        } else if (dialogueMood === "sadness") {
          setExpression("sadness");
          setEyebrowRaise(40);
          setEyebrowFurrow(50);
          setEyeSquint(10);
          setEyeDilation(55);
          setSmileFactor(-80);
          setMouthOpen(10);
          setBlushIntensity(20);
          setActiveGesture("despondent");
          setGestureIntensity(80);
        } else if (dialogueMood === "fear") {
          setExpression("fear");
          setEyebrowRaise(80);
          setEyebrowFurrow(30);
          setEyeSquint(5);
          setEyeDilation(85);
          setSmileFactor(-30);
          setMouthOpen(45);
          setBlushIntensity(35);
          setActiveGesture("defensive");
          setGestureIntensity(80);
        } else if (dialogueMood === "awe") {
          setExpression("awe");
          setEyebrowRaise(75);
          setEyebrowFurrow(0);
          setEyeSquint(0);
          setEyeDilation(90);
          setSmileFactor(30);
          setMouthOpen(60);
          setBlushIntensity(50);
          setActiveGesture("welcoming");
          setGestureIntensity(75);
        }
      }
    }, 120);
  };

  // Preset expressions morph
  const applyPresetExpression = (preset: typeof expression) => {
    setExpression(preset);
    if (preset === "joy") {
      setEyebrowRaise(30);
      setEyebrowFurrow(0);
      setEyeSquint(20);
      setEyeDilation(60);
      setSmileFactor(90);
      setMouthOpen(15);
      setBlushIntensity(35);
    } else if (preset === "anger") {
      setEyebrowRaise(0);
      setEyebrowFurrow(85);
      setEyeSquint(50);
      setEyeDilation(30);
      setSmileFactor(-70);
      setMouthOpen(15);
      setBlushIntensity(60);
    } else if (preset === "sadness") {
      setEyebrowRaise(50);
      setEyebrowFurrow(40);
      setEyeSquint(15);
      setEyeDilation(50);
      setSmileFactor(-80);
      setMouthOpen(5);
      setBlushIntensity(20);
    } else if (preset === "fear") {
      setEyebrowRaise(80);
      setEyebrowFurrow(20);
      setEyeSquint(0);
      setEyeDilation(80);
      setSmileFactor(-40);
      setMouthOpen(50);
      setBlushIntensity(30);
    } else if (preset === "awe") {
      setEyebrowRaise(70);
      setEyebrowFurrow(0);
      setEyeSquint(0);
      setEyeDilation(95);
      setSmileFactor(20);
      setMouthOpen(55);
      setBlushIntensity(45);
    } else {
      setEyebrowRaise(20);
      setEyebrowFurrow(0);
      setEyeSquint(10);
      setEyeDilation(50);
      setSmileFactor(0);
      setMouthOpen(0);
      setBlushIntensity(10);
    }
  };

  // Run AI layout consultant
  const consultAIDirector = async () => {
    setIsGeneratingSuggestions(true);
    setStatusMsg("Consulting Chloe (AI Creative Lead) & loading trends...");
    try {
      const response = await fetch("/api/artistic-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: sequencePrompt,
          style: selectedStyle,
          currentScene: `Backdrop is ${backdrop}, character theme is ${costumeTheme} with face expressing ${expression}.`
        })
      });

      if (!response.ok) {
        throw new Error("Suggestions endpoint returned error status");
      }

      const data: CreativeSuggestions & { warning?: string } = await response.json();
      setSuggestionsResult(data);
      if (data.warning) {
        setStatusMsg(data.warning);
      } else {
        setStatusMsg("Suggestions compiled successfully by AI!");
      }
    } catch (err: any) {
      console.warn("Creative suggestions failed: ", err.message || err);
      setStatusMsg("AI was busy; rendered premium local procedural storyboards.");
    } finally {
      setIsGeneratingSuggestions(false);
      setTimeout(() => setStatusMsg(""), 6000);
    }
  };

  // Particle System Canvas Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 400);
    let height = (canvas.height = canvas.offsetHeight || 300);

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        width = canvas.width = entry.contentRect.width || canvas.offsetWidth;
        height = canvas.height = entry.contentRect.height || canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas.parentElement || canvas);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      spin?: number;
      spinSpeed?: number;
      color: string;
      life: number;
      maxLife: number;
    }

    let particles: Particle[] = [];

    // Helper for generating custom theme colors
    const getParticleColor = () => {
      if (particleType === "embers") return `rgba(255, ${Math.floor(Math.random() * 80) + 40}, 0, `;
      if (particleType === "blossoms") return `rgba(255, ${Math.floor(Math.random() * 50) + 160}, 190, `;
      if (particleType === "grid") return `rgba(0, 255, 200, `;
      if (particleType === "glyphs") return `rgba(168, 85, 247, `;
      if (particleType === "dust") return `rgba(230, 235, 255, `;
      return `rgba(0, ${Math.floor(Math.random() * 100) + 155}, 255, `; // sparks default
    };

    const createParticle = (): Particle => {
      const isGlyph = particleType === "glyphs";
      const isGrid = particleType === "grid";
      const isEmbers = particleType === "embers";
      
      const px = Math.random() * width;
      const py = particleType === "dust" || isGrid ? Math.random() * height : height + 10;
      
      const speedFactor = particleSpeed * 0.4;
      return {
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * speedFactor * (isGrid ? 0.2 : 1),
        vy: isGrid 
          ? speedFactor * 0.1 
          : isEmbers || particleType === "sparks" || isGlyph
            ? - (Math.random() * 2 + 1) * speedFactor
            : (Math.random() * 1.5 + 0.5) * speedFactor * (particleType === "blossoms" ? 1 : -1),
        size: Math.random() * particleSize + 1,
        alpha: Math.random() * 0.5 + 0.4,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.05,
        color: getParticleColor(),
        life: 0,
        maxLife: Math.floor(Math.random() * 120) + 80
      };
    };

    // Populate initially
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
      // distribute vertical positions initially
      particles[i].y = Math.random() * height;
    }

    const glyphs = ["0", "1", "Ξ", "Ψ", "Φ", "Ω", "⚡", "⌁", "⚛", "◆", "◇", "⧉"];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle grid overlay if grid particles are active
      if (particleType === "grid") {
        ctx.strokeStyle = "rgba(0, 255, 200, 0.03)";
        ctx.lineWidth = 1;
        const spacing = 35;
        for (let x = 0; x < width; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Update & Draw Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.spin !== undefined && p.spinSpeed !== undefined) {
          p.spin += p.spinSpeed;
        }

        const lifeRatio = 1 - p.life / p.maxLife;
        const alpha = p.alpha * lifeRatio;

        if (p.life >= p.maxLife || p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) {
          particles[i] = createParticle();
          continue;
        }

        ctx.fillStyle = p.color + alpha + ")";

        if (particleType === "glyphs") {
          ctx.font = `${Math.floor(p.size * 3.5 + 6)}px monospace`;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin || 0);
          ctx.fillText(glyphs[Math.floor(p.x + p.y) % glyphs.length], 0, 0);
          ctx.restore();
        } else if (particleType === "blossoms") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin || 0);
          ctx.beginPath();
          // Draw simple organic petal shape
          ctx.ellipse(0, 0, p.size * 1.5, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (particleType === "grid") {
          // Draw tiny squares for digital mesh feel
          ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size * 1.8, p.size * 1.8);
        } else {
          // Draw circular glowing spark / ember / dust
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Double light glare for high brightness
          if (particleType === "sparks" && p.size > 2.5) {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Dynamic ambient lighting vignette edge glows depending on setup
      const grad = ctx.createRadialGradient(width/2, height/2, Math.min(width, height) * 0.2, width/2, height/2, Math.max(width, height) * 0.7);
      const glowColor = lightingPreset === "underglow" ? costumeAccentColor : hairColor;
      
      // Parse hex color safely to prevent Canvas addColorStop DOMException crashing the browser
      const cleanHex = (glowColor || "#000000").replace("#", "");
      const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
      const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
      const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
      const alphaVal = Math.min(1, Math.max(0, vfxVignette * 0.003));
      
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alphaVal})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [particleType, particleSpeed, particleCount, particleSize, lightingPreset, costumeAccentColor, hairColor, vfxVignette]);

  // Color theme generator for SVG backdrops
  const getBackdropGradients = () => {
    if (backdrop === "neon") return { from: "#0a0314", via: "#1f0535", to: "#021226", ambient: "#ff007f" };
    if (backdrop === "nebula") return { from: "#02020a", via: "#10092b", to: "#3d1052", ambient: "#ff8c00" };
    if (backdrop === "forest") return { from: "#030d0a", via: "#061e16", to: "#1c2e1f", ambient: "#00ffcc" };
    if (backdrop === "observatory") return { from: "#020712", via: "#0d1b2a", to: "#1b263b", ambient: "#e0aa3e" };
    return { from: "#14030d", via: "#2c0520", to: "#050212", ambient: "#a855f7" }; // crystals
  };

  const backdropGrads = getBackdropGradients();

  // Helper functions for drawing dynamic face SVG coordinates
  const getEyebrowYOffset = () => {
    // Joy/neutral raise up; Anger furrows down
    return (eyebrowRaise * 0.15) - (eyebrowFurrow * 0.12);
  };

  const getEyebrowAngle = (isLeft: boolean) => {
    // Anger tilts inward down, Sadness tilts outward down
    const dir = isLeft ? 1 : -1;
    return (eyebrowFurrow * 0.25 * dir) - (expression === "sadness" ? 15 * dir : 0);
  };

  const getEyeHeight = () => {
    // Squint reduces height, Awe opens extremely wide
    const baseHeight = 9;
    const squintMod = (eyeSquint * 0.07);
    const aweMod = expression === "awe" || expression === "fear" ? 4 : 0;
    return Math.max(2, baseHeight - squintMod + aweMod);
  };

  const getMouthPath = () => {
    // Smile Factor goes from -100 (frown) to 100 (smile)
    // Mouth open goes from 0 to 100 (vertical height)
    const centerX = 100;
    const centerY = 125;
    const width = 18;
    
    // Calculate control points for mouth path curve
    const smileDepth = smileFactor * 0.12; // positive for smile, negative for frown
    const leftX = centerX - width;
    const rightX = centerX + width;
    
    if (mouthOpen > 5) {
      // Draw an open loop shape representing speaking / gasping
      const openHeight = mouthOpen * 0.14;
      const topY = centerY - openHeight * 0.3;
      const bottomY = centerY + openHeight * 0.7;
      
      // Control points bend depending on smile
      const leftY = centerY + smileDepth * 0.2;
      const rightY = centerY + smileDepth * 0.2;
      
      return `M ${leftX} ${leftY} Q ${centerX} ${topY + smileDepth} ${rightX} ${rightY} Q ${centerX} ${bottomY + smileDepth * 0.5} ${leftX} ${leftY} Z`;
    } else {
      // Just a simple curved line stroke
      const destY = centerY + smileDepth;
      return `M ${leftX} ${centerY} Q ${centerX} ${destY} ${rightX} ${centerY}`;
    }
  };

  const getHeadRotation = () => {
    if (activeGesture === "thoughtful") return -4;
    if (activeGesture === "despondent") return 6;
    if (activeGesture === "aggressive") return -3;
    if (activeGesture === "triumphant") return -5;
    return 0;
  };

  // Helper to construct dynamic CSS Filter string
  const getCylinderFilterString = () => {
    let filter = `contrast(${vfxContrast}%) saturate(${vfxSaturation}%)`;
    if (colorGrade === "teal-orange") {
      // Teal and orange filter emulation
      filter += ` hue-rotate(-15deg)`;
    } else if (colorGrade === "noir") {
      filter += ` grayscale(100%) brightness(95%)`;
    } else if (colorGrade === "gold") {
      filter += ` sepia(35%) hue-rotate(10deg)`;
    } else if (colorGrade === "violet") {
      filter += ` hue-rotate(280deg) saturate(140%)`;
    }
    return filter;
  };

  // Quick preset loading helper for Visual Effects
  const loadVfxPreset = (grade: typeof colorGrade) => {
    setColorGrade(grade);
    if (grade === "teal-orange") {
      setVfxContrast(120);
      setVfxSaturation(140);
      setVfxBloom(35);
      setParticleType("embers");
    } else if (grade === "noir") {
      setVfxContrast(145);
      setVfxSaturation(0);
      setVfxBloom(15);
      setParticleType("dust");
    } else if (grade === "violet") {
      setVfxContrast(115);
      setVfxSaturation(160);
      setVfxBloom(30);
      setParticleType("sparks");
    } else if (grade === "gold") {
      setVfxContrast(105);
      setVfxSaturation(110);
      setVfxBloom(25);
      setParticleType("embers");
    } else if (grade === "vivid") {
      setVfxContrast(125);
      setVfxSaturation(190);
      setVfxBloom(40);
      setParticleType("glyphs");
    }
  };

  const loadLightingPreset = (preset: typeof lightingPreset) => {
    setLightingPreset(preset);
    if (preset === "rembrandt") {
      setLightAngle(45);
      setAmbientIntensity(20);
    } else if (preset === "rim") {
      setLightAngle(225);
      setAmbientIntensity(15);
      setEmissionBrightness(90);
    } else if (preset === "underglow") {
      setLightAngle(180);
      setAmbientIntensity(40);
    } else if (preset === "volumetric") {
      setLightAngle(135);
      setAmbientIntensity(55);
    }
  };

  return (
    <div id="creative-suite-workspace" className="bg-[#0b0b0c] border border-white/5 rounded-sm p-4 lg:p-6 text-white flex flex-col gap-8">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-purple-600 text-black font-extrabold rounded-sm shadow-md shadow-cyan-500/10">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-mono tracking-widest text-cyan-400 font-bold uppercase">Active Workshop Module</span>
            <h1 className="text-xl md:text-2xl font-serif font-medium tracking-tight mt-0.5 text-neutral-100">Creative &amp; Artistic Studio</h1>
          </div>
        </div>
        <p className="text-xs text-white/50 max-w-md font-sans leading-relaxed">
          Configure real-time scene flow, fine-tune facial gestures to sync with emotional dialogue subtext, customize secondary assets, and inject atmospheric VFX particles and light layers.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-[#121217] border border-cyan-500/20 text-cyan-400 text-xs font-mono rounded-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-ping"></span>
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg("")} className="text-white/40 hover:text-white">&times;</button>
        </div>
      )}

      {/* Main Two-Column Studio Layout */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* LEFT COLUMN: Controls Panel (Cols 12 -> 7) */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-6">

          {/* BLOCK 1: Storyboarding Assistance */}
          <div className="bg-[#111112] border border-white/5 p-5 rounded-sm relative overflow-hidden flex flex-col gap-4">
            <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none"></div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400">01</span>
                <h2 className="text-xs uppercase tracking-widest font-semibold text-white/80">Storyboarding Assistance</h2>
              </div>
              <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-sm">AI Layout Director</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Describe your narrative sequence idea</label>
              <textarea
                value={sequencePrompt}
                onChange={(e) => setSequencePrompt(e.target.value)}
                rows={2}
                placeholder="Describe your story arc, cinematic vision, or specific scene sequence..."
                className="w-full bg-[#080809] border border-white/10 rounded-sm p-3 font-serif italic text-sm text-neutral-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Cinematic Style Preset</label>
                <select
                  value={selectedStyle}
                  onChange={(e) => {
                    setSelectedStyle(e.target.value);
                    setBackdrop(e.target.value === "anime" ? "forest" : e.target.value === "cyberpunk" ? "neon" : "observatory");
                  }}
                  className="bg-[#080809] border border-white/10 rounded-sm p-2 text-xs text-white/80 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="cinema">Epic Cinematic</option>
                  <option value="cyberpunk">Neon Cyberpunk</option>
                  <option value="anime">Celestial Anime</option>
                  <option value="watercolor">Ethereal Watercolor</option>
                  <option value="line-art">Minimalist Line-Art</option>
                  <option value="retro-pixel">8-Bit Retro Pixel</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={consultAIDirector}
                  disabled={isGeneratingSuggestions}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-extrabold text-[11px] uppercase tracking-wider py-3.5 px-4 rounded-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/5 cursor-pointer"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing Sequence...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>Consult AI Director Chloe</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Suggestion Output (Grounded Content Display) */}
            {suggestionsResult && (
              <div className="mt-4 border-t border-white/5 pt-4 flex flex-col gap-4">
                <div className="p-3 bg-neutral-900/50 border border-white/5 rounded-xs">
                  <p className="text-[11px] font-mono text-cyan-400/80 mb-1">
                    <span className="font-bold">GEN-AI ASSESSMENT //</span> EST. EMOTIONAL ARC
                  </p>
                  <p className="text-xs font-serif italic text-white/70 leading-relaxed mb-2">
                    &ldquo;{suggestionsResult.emotionalArc}&rdquo;
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-white/40">
                    <span className="font-mono uppercase">Vibe preset:</span>
                    <span className="text-white/60 font-medium font-mono">{suggestionsResult.cinematicVibe}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50 font-bold">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span>Suggested Scene-by-Scene Flow &amp; Angles</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {suggestionsResult.suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#080809] border border-white/5 hover:border-cyan-500/20 rounded-sm flex flex-col gap-2 transition-all group/card relative"
                      >
                        <div className="absolute top-2 right-2 text-[9px] font-mono text-white/20 font-bold">
                          CH. {s.sceneNumber}
                        </div>
                        <h4 className="text-[11px] font-bold text-neutral-100 pr-6 uppercase tracking-wider truncate">
                          {s.title}
                        </h4>
                        
                        <p className="text-[10px] text-white/60 line-clamp-3 font-serif leading-relaxed italic border-l border-white/10 pl-2">
                          &ldquo;{s.flowDescription}&rdquo;
                        </p>

                        <div className="mt-1 flex flex-col gap-1.5 text-[9px]">
                          <div className="bg-cyan-950/20 p-1.5 rounded-xs border border-cyan-900/10">
                            <span className="text-cyan-400 font-mono font-bold block">🎥 ANGLE &amp; FOCUS:</span>
                            <span className="text-white/80 font-serif leading-tight mt-0.5 block">{s.cameraAngle}</span>
                            <span className="text-white/40 leading-tight mt-1 block">{s.cameraReason}</span>
                          </div>

                          <div className="bg-purple-950/20 p-1.5 rounded-xs border border-purple-900/10">
                            <span className="text-purple-400 font-mono font-bold block">⚡ TRANSITION:</span>
                            <span className="text-white/80 font-serif leading-tight mt-0.5 block">{s.transitionType}</span>
                            <span className="text-white/40 leading-tight mt-1 block">{s.transitionReason}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setDialogueText(`This is Scene ${s.sceneNumber}: ${s.title}`);
                            setStatusMsg(`Set context to: ${s.title}. Costume and camera notes adjusted Procedurally.`);
                            setBackdrop(selectedStyle === "anime" ? "forest" : "neon");
                            setTimeout(() => setStatusMsg(""), 3000);
                          }}
                          className="mt-2 text-center w-full py-1.5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-white/50 hover:text-cyan-400 text-[9px] font-mono uppercase tracking-wider rounded-xs transition-all cursor-pointer"
                        >
                          Adapt Rig Preset
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BLOCK 2: Emotion & Expression Control */}
          <div className="bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-5 relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-cyan-400">02</span>
                <h2 className="text-xs uppercase tracking-widest font-semibold text-white/80">Emotion &amp; Expression Control</h2>
              </div>
              <span className="text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-sm">Lip-Sync &amp; Posture Rig</span>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Quick Emotional Presets</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(["neutral", "joy", "anger", "sadness", "fear", "awe"] as const).map((expr) => (
                  <button
                    key={expr}
                    onClick={() => applyPresetExpression(expr)}
                    className={`py-1.5 text-[10px] font-mono uppercase rounded-xs transition-all border cursor-pointer ${
                      expression === expr
                        ? "bg-purple-600 text-white border-purple-500 font-bold"
                        : "bg-black/40 text-white/50 border-white/5 hover:border-white/10 hover:text-white"
                    }`}
                  >
                    {expr}
                  </button>
                ))}
              </div>
            </div>

            {/* Expression Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3 p-3.5 bg-black/40 border border-white/5 rounded-xs">
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Facial Muscle Controls</span>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Eyebrow Raise</span>
                    <span>{eyebrowRaise}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={eyebrowRaise}
                    onChange={(e) => setEyebrowRaise(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Eyebrow Furrow</span>
                    <span>{eyebrowFurrow}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={eyebrowFurrow}
                    onChange={(e) => setEyebrowFurrow(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Eye Squint</span>
                    <span>{eyeSquint}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={eyeSquint}
                    onChange={(e) => setEyeSquint(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Cheek Blush</span>
                    <span>{blushIntensity}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={blushIntensity}
                    onChange={(e) => setBlushIntensity(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3.5 bg-black/40 border border-white/5 rounded-xs">
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Mouth &amp; Dialogue Sync</span>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Smile Curve</span>
                    <span>{smileFactor}%</span>
                  </div>
                  <input
                    type="range" min="-100" max="100" value={smileFactor}
                    onChange={(e) => setSmileFactor(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Mouth Opening (Speech)</span>
                    <span>{mouthOpen}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" value={mouthOpen}
                    onChange={(e) => setMouthOpen(Number(e.target.value))}
                    className="accent-purple-500 bg-neutral-800 h-1 rounded"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/60">
                    <span>Active Posture Theme</span>
                    <span className="lowercase font-bold text-cyan-400">{activeGesture}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {(["thoughtful", "welcoming", "triumphant", "defensive", "aggressive", "despondent"] as const).map((gest) => (
                      <button
                        key={gest}
                        onClick={() => setActiveGesture(gest)}
                        className={`text-[9px] font-mono uppercase py-1 border transition-all rounded-xs cursor-pointer ${
                          activeGesture === gest
                            ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
                            : "border-white/5 text-white/40 hover:text-white"
                        }`}
                      >
                        {gest}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Dialogue Subtext Audio Sync */}
            <div className="p-4 bg-purple-950/10 border border-purple-500/20 rounded-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Subtext Emotional Dialogue Parser</span>
                </span>
                <span className="text-[8px] font-mono text-purple-400">Lip-Sync Simulator</span>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={dialogueText}
                  onChange={(e) => setDialogueText(e.target.value)}
                  placeholder="Enter character line to analyze subtext and sync lips/gestures..."
                  className="w-full bg-[#080809] border border-white/10 rounded-sm p-2 text-xs font-serif italic text-neutral-200 focus:outline-none focus:border-purple-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-white/40">Mood Subtext:</span>
                    <select
                      value={dialogueMood}
                      onChange={(e) => setDialogueMood(e.target.value as any)}
                      className="bg-black border border-white/5 p-1 rounded-sm text-[10px] text-purple-400 focus:outline-none font-mono"
                    >
                      <option value="triumphant">🏆 Triumphant Glory</option>
                      <option value="aggressive">🔥 Aggressive Threat</option>
                      <option value="sadness">💧 Desolate Grief</option>
                      <option value="fear">⚡ Terrified Shock</option>
                      <option value="awe">🌌 Cosmic Revelation</option>
                    </select>
                  </div>

                  <button
                    onClick={runDialogueSync}
                    disabled={isSyncingDialogue}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[9px] uppercase tracking-wider px-4 py-2 rounded-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSyncingDialogue ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Mapping Subtext...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Dialogue Auto-Sync</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Waveform Visualization */}
              <div className="h-10 bg-black/50 border border-white/5 rounded-sm flex items-center justify-center gap-1.5 px-4 overflow-hidden relative">
                {isSyncingDialogue ? (
                  waveAnimation.map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}px` }}
                      className="w-1 bg-purple-500 rounded-full transition-all duration-100 shadow-md shadow-purple-500/50"
                    ></span>
                  ))
                ) : (
                  <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">
                    Frequency Spectrum Ready // Awaiting Sync Trigger
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* BLOCK 3: Customizable Assets & VFX Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Asset Customization */}
            <div className="bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono text-cyan-400">03</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">Asset Configurator</h3>
              </div>

              <div className="flex flex-col gap-3">
                {/* Skin & Hair customization */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-mono text-white/40 uppercase">A. Character Class & Hair</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={charClass}
                      onChange={(e: any) => setCharClass(e.target.value)}
                      className="bg-[#080809] border border-white/10 rounded-sm p-1.5 text-[10px] text-white/80 focus:outline-none"
                    >
                      <option value="cyber">Cyber Hacker</option>
                      <option value="astral">Astral Explorer</option>
                      <option value="chrono">Chrono Weaver</option>
                      <option value="void">Void Knight</option>
                      <option value="bio">Bio Synthesizer</option>
                    </select>

                    <select
                      value={hairStyle}
                      onChange={(e: any) => setHairStyle(e.target.value)}
                      className="bg-[#080809] border border-white/10 rounded-sm p-1.5 text-[10px] text-white/80 focus:outline-none"
                    >
                      <option value="quantum">Quantum Flow</option>
                      <option value="sleek">Sleek Crop</option>
                      <option value="mech">Spiky Mech</option>
                      <option value="ethereal">Ethereal Locks</option>
                    </select>
                  </div>
                </div>

                {/* Color pickers */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase text-center">Hair Color</span>
                    <input
                      type="color" value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                      className="w-full h-8 bg-transparent border border-white/10 rounded-sm cursor-pointer p-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase text-center">Eye Glow</span>
                    <input
                      type="color" value={eyeColor}
                      onChange={(e) => setEyeColor(e.target.value)}
                      className="w-full h-8 bg-transparent border border-white/10 rounded-sm cursor-pointer p-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase text-center">Skin Tone</span>
                    <input
                      type="color" value={skinColor}
                      onChange={(e) => setSkinColor(e.target.value)}
                      className="w-full h-8 bg-transparent border border-white/10 rounded-sm cursor-pointer p-0"
                    />
                  </div>
                </div>

                {/* Costume Themes */}
                <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-3">
                  <span className="text-[9px] font-mono text-white/40 uppercase">B. Costume Theme & Decals</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={costumeTheme}
                      onChange={(e: any) => setCostumeTheme(e.target.value)}
                      className="bg-[#080809] border border-white/10 rounded-sm p-1.5 text-[10px] text-white/80 focus:outline-none"
                    >
                      <option value="trench">Duster Trenchcoat</option>
                      <option value="solar">Solar Exosuit</option>
                      <option value="noble">Noble Vestments</option>
                      <option value="mesh">Synthetic Mesh</option>
                      <option value="runic">Runic Armor</option>
                    </select>

                    <select
                      value={costumeDecal}
                      onChange={(e: any) => setCostumeDecal(e.target.value as any)}
                      className="bg-[#080809] border border-white/10 rounded-sm p-1.5 text-[10px] text-white/80 focus:outline-none"
                    >
                      <option value="grid">Grid Pattern Decal</option>
                      <option value="star">Star Crest Decal</option>
                      <option value="wing">Wing Flare Decal</option>
                      <option value="leaf">Bio Leaf Decal</option>
                      <option value="none">No Decal Graphic</option>
                    </select>
                  </div>
                </div>

                {/* Costume colors */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase">Costume Glow Color</span>
                    <input
                      type="color" value={costumeAccentColor}
                      onChange={(e) => setCostumeAccentColor(e.target.value)}
                      className="w-full h-7 bg-transparent border border-white/10 rounded-sm cursor-pointer p-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[8px] font-mono text-white/40">
                      <span className="uppercase">Emission Brightness</span>
                      <span>{emissionBrightness}</span>
                    </div>
                    <input
                      type="range" min="0" max="100" value={emissionBrightness}
                      onChange={(e) => setEmissionBrightness(Number(e.target.value))}
                      className="accent-cyan-500 bg-neutral-800 h-1 rounded mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Effects & Lighting */}
            <div className="bg-[#111112] border border-white/5 p-5 rounded-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono text-cyan-400">04</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-white/80">Visual Effects Integration</h3>
              </div>

              <div className="flex flex-col gap-3">
                {/* Lighting Presets */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-white/40 uppercase mb-1">A. Cinematic Lighting Presets</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["underglow", "rim", "rembrandt", "volumetric"] as const).map((lit) => (
                      <button
                        key={lit}
                        onClick={() => loadLightingPreset(lit)}
                        className={`py-1 text-[9px] font-mono uppercase rounded-xs border transition-all cursor-pointer ${
                          lightingPreset === lit
                            ? "border-cyan-500 text-cyan-400 bg-cyan-950/15 font-bold"
                            : "border-white/5 text-white/40 hover:text-white"
                        }`}
                      >
                        {lit === "underglow" ? "💡 Underglow" : lit === "rim" ? "⚡ Rim Light" : lit === "rembrandt" ? "🌗 Rembrandt" : "☁️ Volumetric"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Particle Systems */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                  <span className="text-[9px] font-mono text-white/40 uppercase">B. Interactive Particle Layers</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={particleType}
                      onChange={(e: any) => setParticleType(e.target.value)}
                      className="bg-[#080809] border border-white/10 rounded-sm p-1.5 text-[10px] text-white/80 focus:outline-none"
                    >
                      <option value="sparks">Cyber Sparks</option>
                      <option value="embers">Glowing Embers</option>
                      <option value="blossoms">Cherry Blossoms</option>
                      <option value="grid">Digital Matrix Grid</option>
                      <option value="glyphs">Holographic Glyphs</option>
                      <option value="dust">Volumetric Dust</option>
                    </select>

                    <div className="flex justify-between items-center bg-[#080809] border border-white/10 rounded-sm px-2 text-[10px]">
                      <span className="text-white/40 font-mono">COUNT:</span>
                      <input
                        type="number" min="10" max="250" step="10" value={particleCount}
                        onChange={(e) => setParticleCount(Math.min(250, Number(e.target.value)))}
                        className="w-12 bg-transparent text-right text-white font-mono focus:outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Color Grading Preset */}
                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
                  <span className="text-[9px] font-mono text-white/40 uppercase">C. Color Grading Filters</span>
                  <div className="grid grid-cols-5 gap-1 text-[9px] font-mono">
                    {(["teal-orange", "noir", "violet", "gold", "vivid"] as const).map((grade) => (
                      <button
                        key={grade}
                        onClick={() => loadVfxPreset(grade)}
                        className={`py-1 border transition-all rounded-xs uppercase cursor-pointer ${
                          colorGrade === grade
                            ? "border-purple-500 text-purple-400 bg-purple-950/20 font-bold"
                            : "border-white/5 text-white/40 hover:text-white"
                        }`}
                        title={grade}
                      >
                        {grade.substring(0, 4)}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-white/40">
                        <span>Contrast</span>
                        <span>{vfxContrast}%</span>
                      </div>
                      <input
                        type="range" min="60" max="160" value={vfxContrast}
                        onChange={(e) => setVfxContrast(Number(e.target.value))}
                        className="accent-purple-500 bg-neutral-800 h-1 rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-white/40">
                        <span>Bloom Glow</span>
                        <span>{vfxBloom}px</span>
                      </div>
                      <input
                        type="range" min="0" max="60" value={vfxBloom}
                        onChange={(e) => setVfxBloom(Number(e.target.value))}
                        className="accent-purple-500 bg-neutral-800 h-1 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Render Stage (Cols 12 -> 5) */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-4 sticky top-6">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-white/50 px-1">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>High-Fidelity Real-Time Render Stage</span>
          </div>

          {/* Render Stage Container */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col gap-4">
            
            {/* The SVG & Canvas Render Frame */}
            <div
              id="cinematic-render-stage"
              className="w-full aspect-[4/3] rounded-sm relative overflow-hidden flex items-center justify-center border border-white/5 shadow-inner"
              style={{
                background: `radial-gradient(circle at ${lightAngle === 185 ? '50% 100%' : lightAngle === 225 ? '80% 20%' : '50% 30%'}, ${backdropGrads.via} 0%, ${backdropGrads.from} 100%)`,
                boxShadow: `inset 0 0 40px ${backdropGrads.from}, 0 4px 30px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Dynamic Color Grading & CSS Filter Box */}
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-300"
                style={{
                  filter: getCylinderFilterString(),
                  boxShadow: `inset 0 0 ${vfxBloom * 1.5}px ${backdropGrads.ambient + "33"}`
                }}
              >
                {/* Vignette Layer */}
                <div
                  className="absolute inset-0 pointer-events-none transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${vfxVignette * 0.01}) 100%)`
                  }}
                ></div>
              </div>

              {/* VFX Particles Live Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none mix-blend-screen z-10"
              />

              {/* Interactive Vector Character SVG Layer */}
              <svg
                id="vector-asset-canvas"
                viewBox="0 0 200 200"
                className="w-[85%] h-[85%] relative z-20 transition-all duration-300 select-none drop-shadow-2xl"
                style={{
                  transform: `scale(1.05)`,
                  filter: `drop-shadow(0 0 ${emissionBrightness * 0.15}px ${costumeAccentColor + "bb"})`
                }}
              >
                {/* Lighting glow filters */}
                <defs>
                  <radialGradient id="rimLight" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor={hairColor} stopOpacity="0" />
                  </radialGradient>
                  
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={skinColor} />
                    <stop offset="100%" stopColor="#2c303f" />
                  </linearGradient>

                  <radialGradient id="eyeGlowGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="40%" stopColor={eyeColor} />
                    <stop offset="100%" stopColor={eyeColor} stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* --- BACKDROP DETAILS (Asset environment customizations) --- */}
                {backdrop === "forest" && (
                  <g opacity="0.15" transform="translate(0, 10)">
                    {/* Abstract forest silhouettes */}
                    <path d="M-10,180 L20,110 L50,180 Z" fill="#000000" />
                    <path d="M30,190 L70,80 L110,190 Z" fill="#000000" />
                    <path d="M120,180 L160,100 L200,180 Z" fill="#000000" />
                  </g>
                )}
                
                {backdrop === "neon" && (
                  <g opacity="0.12">
                    {/* Abstract neon skyscraper wireframes */}
                    <rect x="20" y="40" width="30" height="150" fill="none" stroke={costumeAccentColor} strokeWidth="0.5" />
                    <rect x="140" y="60" width="40" height="130" fill="none" stroke={hairColor} strokeWidth="0.5" />
                  </g>
                )}

                {backdrop === "crystals" && (
                  <g opacity="0.15" transform="translate(0, -10)">
                    {/* Abstract sharp crystals */}
                    <polygon points="20,170 35,110 50,170" fill={costumeAccentColor} />
                    <polygon points="150,180 165,90 180,180" fill={hairColor} />
                  </g>
                )}

                {/* --- CHARACTER GROUP --- */}
                <g transform={`rotate(${getHeadRotation()} 100 110)`} className="transition-transform duration-300">
                  
                  {/* Arms & Torso base under gesture pose themes */}
                  {activeGesture === "triumphant" && (
                    <g className="transition-all duration-300">
                      {/* Left Arm raised up */}
                      <path d="M 65 145 C 50 120, 45 90, 50 85" stroke={skinColor} strokeWidth="12" strokeLinecap="round" fill="none" />
                      {/* Right Arm raised up */}
                      <path d="M 135 145 C 150 120, 155 90, 150 85" stroke={skinColor} strokeWidth="12" strokeLinecap="round" fill="none" />
                      {/* Triumph energy sparks */}
                      <circle cx="50" cy="80" r="4" fill="#ffffff" opacity="0.8" />
                      <circle cx="150" cy="80" r="4" fill="#ffffff" opacity="0.8" />
                    </g>
                  )}

                  {activeGesture === "defensive" && (
                    <g className="transition-all duration-300">
                      {/* Arms crossed horizontally over chest */}
                      <path d="M 60 150 L 140 150" stroke={costumeAccentColor} strokeWidth="16" strokeLinecap="round" opacity="0.9" />
                      <path d="M 65 156 L 135 156" stroke="#1c1c1f" strokeWidth="10" strokeLinecap="round" />
                    </g>
                  )}

                  {activeGesture === "welcoming" && (
                    <g className="transition-all duration-300">
                      {/* Arms extended outward open */}
                      <path d="M 65 145 C 45 145, 30 155, 25 160" stroke={skinColor} strokeWidth="11" strokeLinecap="round" fill="none" />
                      <path d="M 135 145 C 155 145, 170 155, 175 160" stroke={skinColor} strokeWidth="11" strokeLinecap="round" fill="none" />
                    </g>
                  )}

                  {activeGesture === "thoughtful" && (
                    <g className="transition-all duration-300">
                      {/* Hand raised touching chin */}
                      <path d="M 135 145 C 120 150, 115 130, 110 122" stroke={skinColor} strokeWidth="10" strokeLinecap="round" fill="none" />
                    </g>
                  )}

                  {activeGesture === "aggressive" && (
                    <g className="transition-all duration-300">
                      {/* Left hand closed fist forward */}
                      <path d="M 65 145 C 55 130, 50 125, 45 125" stroke={skinColor} strokeWidth="13" strokeLinecap="round" fill="none" />
                    </g>
                  )}

                  {activeGesture === "despondent" && (
                    <g className="transition-all duration-300">
                      {/* Arms limp hanging directly down */}
                      <path d="M 65 145 L 60 185" stroke={skinColor} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.7" />
                      <path d="M 135 145 L 140 185" stroke={skinColor} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.7" />
                    </g>
                  )}

                  {/* Body Torso & Costume Base */}
                  <path d="M 65 140 L 135 140 L 145 220 L 55 220 Z" fill="#1c1d24" />
                  
                  {/* Costume Theme Layer overlay */}
                  {costumeTheme === "solar" && (
                    <g>
                      {/* Solar Exosuit metallic armor plate */}
                      <path d="M 70 145 L 130 145 L 138 200 L 62 200 Z" fill="#2d303b" stroke={costumeAccentColor} strokeWidth="1.5" />
                      <circle cx="100" cy="170" r="14" fill="#111" stroke={costumeAccentColor} strokeWidth="1" />
                      {/* Glowing solar core */}
                      <circle cx="100" cy="170" r="8" fill={costumeAccentColor} filter="drop-shadow(0 0 4px white)" />
                    </g>
                  )}

                  {costumeTheme === "trench" && (
                    <g>
                      {/* Collar and trench folds */}
                      <path d="M 62 142 L 138 142 L 142 220 L 58 220 Z" fill="#15161c" />
                      <path d="M 62 142 L 85 190 L 100 220" stroke={costumeAccentColor} strokeWidth="3" fill="none" />
                      <path d="M 138 142 L 115 190 L 100 220" stroke={costumeAccentColor} strokeWidth="3" fill="none" />
                      <polygon points="62,142 80,142 75,170" fill={costumeAccentColor} />
                      <polygon points="138,142 120,142 125,170" fill={costumeAccentColor} />
                    </g>
                  )}

                  {costumeTheme === "noble" && (
                    <g>
                      {/* Noble golden tunic/cloak */}
                      <path d="M 68 142 L 132 142 L 135 220 L 65 220 Z" fill="#3c1053" />
                      <polygon points="100,142 80,185 120,185" fill={costumeAccentColor} opacity="0.8" />
                      <line x1="100" y1="142" x2="100" y2="215" stroke={costumeAccentColor} strokeWidth="2.5" />
                    </g>
                  )}

                  {costumeTheme === "mesh" && (
                    <g>
                      {/* Synthetic grid mesh vest */}
                      <path d="M 70 144 L 130 144 L 135 210 L 65 210 Z" fill="#080c10" />
                      <path d="M 75 145 L 125 200" stroke={costumeAccentColor} strokeWidth="0.8" opacity="0.5" />
                      <path d="M 125 145 L 75 200" stroke={costumeAccentColor} strokeWidth="0.8" opacity="0.5" />
                      <path d="M 70 170 L 130 170" stroke={costumeAccentColor} strokeWidth="1" />
                    </g>
                  )}

                  {costumeTheme === "runic" && (
                    <g>
                      {/* Runic armor glyphs */}
                      <path d="M 68 145 L 132 145 L 140 215 L 60 215 Z" fill="#1b263b" />
                      <circle cx="100" cy="180" r="16" fill="none" stroke={costumeAccentColor} strokeWidth="1.5" strokeDasharray="3 3" />
                      {/* Abstract runic glyph in center */}
                      <path d="M 100 170 L 100 190 M 90 180 L 110 180 M 93 173 L 107 187 M 93 187 L 107 173" stroke={costumeAccentColor} strokeWidth="2" />
                    </g>
                  )}

                  {/* Costume Decal Overlay */}
                  {costumeDecal === "star" && (
                    <polygon points="100,150 103,158 111,158 105,163 107,171 100,166 93,171 95,163 89,158 97,158" fill="#ffffff" opacity="0.85" />
                  )}
                  {costumeDecal === "grid" && (
                    <g opacity="0.5">
                      <line x1="90" y1="150" x2="110" y2="150" stroke="#ffffff" strokeWidth="1" />
                      <line x1="90" y1="158" x2="110" y2="158" stroke="#ffffff" strokeWidth="1" />
                      <line x1="98" y1="145" x2="98" y2="165" stroke="#ffffff" strokeWidth="1" />
                      <line x1="102" y1="145" x2="102" y2="165" stroke="#ffffff" strokeWidth="1" />
                    </g>
                  )}
                  {costumeDecal === "wing" && (
                    <path d="M 90 152 Q 100 148 100 162 Q 100 148 110 152 C 105 160, 95 160, 90 152 Z" fill="#ffffff" opacity="0.75" />
                  )}
                  {costumeDecal === "leaf" && (
                    <path d="M 100 148 C 105 148, 107 155, 100 162 C 93 155, 95 148, 100 148 Z" fill="#ffffff" opacity="0.75" />
                  )}

                  {/* Head Neck */}
                  <rect x="91" y="115" width="18" height="28" fill={skinColor} rx="3" />

                  {/* Head Base Face */}
                  <ellipse cx="100" cy="100" rx="26" ry="30" fill={skinColor} />

                  {/* Blush cheeks */}
                  {blushIntensity > 0 && (
                    <g opacity={blushIntensity * 0.01}>
                      <circle cx="83" cy="108" r="6" fill="#ff4d4d" filter="blur(2px)" />
                      <circle cx="117" cy="108" r="6" fill="#ff4d4d" filter="blur(2px)" />
                    </g>
                  )}

                  {/* --- FACE FEATURES BOUND TO RIG SLIDERS --- */}

                  {/* Eyes */}
                  {/* Left Eye */}
                  <g>
                    <ellipse cx="86" cy="98" rx="5.5" ry={getEyeHeight()} fill="#1c1d24" />
                    <circle cx="85" cy="97" r="1.8" fill="#ffffff" />
                    <circle cx="86" cy="98" r={getEyeHeight() * 0.4} fill={eyeColor} opacity="0.6" />
                  </g>
                  
                  {/* Right Eye */}
                  <g>
                    <ellipse cx="114" cy="98" rx="5.5" ry={getEyeHeight()} fill="#1c1d24" />
                    <circle cx="115" cy="97" r="1.8" fill="#ffffff" />
                    <circle cx="114" cy="98" r={getEyeHeight() * 0.4} fill={eyeColor} opacity="0.6" />
                  </g>

                  {/* Eyebrows */}
                  {/* Left Eyebrow */}
                  <path
                    d={`M 77 ${90 - getEyebrowYOffset()} Q 86 ${86 - getEyebrowYOffset()} 92 ${89 - getEyebrowYOffset()}`}
                    stroke="#1c1d24"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(${getEyebrowAngle(true)} 86 88)`}
                    className="transition-all"
                  />

                  {/* Right Eyebrow */}
                  <path
                    d={`M 108 ${89 - getEyebrowYOffset()} Q 114 ${86 - getEyebrowYOffset()} 123 ${90 - getEyebrowYOffset()}`}
                    stroke="#1c1d24"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(${getEyebrowAngle(false)} 114 88)`}
                    className="transition-all"
                  />

                  {/* Nose */}
                  <path d="M 100 98 L 98 108 L 103 108" stroke="#1c1d24" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />

                  {/* Mouth */}
                  <path
                    d={getMouthPath()}
                    stroke="#1c1d24"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill={mouthOpen > 5 ? "#1c1d24" : "none"}
                    className="transition-all"
                  />

                  {/* Character Hair overlay with picked colors */}
                  {hairStyle === "quantum" && (
                    <g fill={hairColor}>
                      {/* Sweeping quantum spikes */}
                      <path d="M 72 82 C 65 60, 85 45, 100 48 C 115 45, 135 60, 128 82 C 132 75, 138 78, 132 90 C 122 84, 120 100, 124 105 C 118 95, 114 85, 100 85 C 86 85, 82 95, 76 105 C 80 100, 78 84, 68 90 C 62 78, 68 75, 72 82 Z" />
                      <path d="M 90 48 Q 100 30 110 48" stroke={hairColor} strokeWidth="5" strokeLinecap="round" />
                    </g>
                  )}

                  {hairStyle === "sleek" && (
                    <g fill={hairColor}>
                      {/* Sleek crop helmet-cut hair */}
                      <path d="M 72 88 C 70 70, 80 54, 100 54 C 120 54, 130 70, 128 88 C 128 88, 124 95, 122 92 C 120 80, 110 75, 100 80 C 90 75, 80 80, 78 92 C 76 95, 72 88, 72 88 Z" />
                    </g>
                  )}

                  {hairStyle === "mech" && (
                    <g fill={hairColor}>
                      {/* Heavy angular mecha spiky armor plates */}
                      <polygon points="72,82 85,45 95,65" />
                      <polygon points="90,60 100,32 110,60" />
                      <polygon points="105,65 115,45 128,82" />
                      <path d="M 72 82 L 128 82 L 126 95 L 74 95 Z" opacity="0.9" />
                    </g>
                  )}

                  {hairStyle === "ethereal" && (
                    <g fill={hairColor}>
                      {/* Swirling long cloud locks */}
                      <path d="M 70 82 C 60 50, 75 40, 100 40 C 125 40, 140 50, 130 82 C 138 95, 142 120, 138 140 C 132 135, 128 110, 128 90 C 120 95, 115 112, 118 125 C 108 115, 104 100, 100 100 C 96 100, 92 115, 82 125 C 85 112, 80 95, 72 90 C 72 110, 68 135, 62 140 C 58 120, 62 95, 70 82 Z" />
                    </g>
                  )}

                </g>
              </svg>
            </div>

            {/* Render details and export option */}
            <div className="flex flex-col gap-2 font-mono text-[10px] text-white/50 border-t border-white/5 pt-3">
              <div className="flex justify-between">
                <span>STAGE COORDINATES:</span>
                <span className="text-white/80">X: 100, Y: 110, DEPTH: MIDGROUND</span>
              </div>
              <div className="flex justify-between">
                <span>VFX PARTICLE STATUS:</span>
                <span className="text-cyan-400 font-bold uppercase">{particleType} ({particleCount} ACTIVE)</span>
              </div>
              <div className="flex justify-between">
                <span>LIGHT ANGLE / INTENSITY:</span>
                <span className="text-white/80">{lightAngle}° / AMBIENT: {ambientIntensity}%</span>
              </div>
              <div className="flex justify-between">
                <span>ACTIVE EXPR / GESTURE:</span>
                <span className="text-purple-400 font-bold uppercase">{expression} / {activeGesture}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      setStatusMsg("Exporting 4K render and configurations to active storyboard...");
                      setTimeout(() => setStatusMsg(""), 3000);
                    }
                  }}
                  className="flex-grow bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-white/20 text-neutral-300 font-bold uppercase tracking-wider py-2 rounded-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Snapshot Frame</span>
                </button>
              </div>
            </div>

          </div>

          {/* Quick Informational Tooltip Card */}
          <div className="bg-gradient-to-r from-purple-950/20 to-cyan-950/20 border border-white/5 p-4 rounded-sm flex gap-3">
            <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/90">Creative Suite Integration Tips</h4>
              <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                These controls feed directly into the **Animate** and **Storyboard** systems. Adjusting the face muscle parameters and posture gestures ensures that your characters communicate genuine mood subtexts that perfectly align with your dialogue lines or script.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
