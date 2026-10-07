import React, { useState, useEffect, useRef } from "react";
import type { CharacterLook, MotionId, RigClip } from "../types";
import { STANDING_POSE } from "../project/rig";
import { newId } from "../project/storage";
import { Button, Field, IconButton, Notice, Slider, inputClass } from "../ui";
import {
  Bone,
  Play,
  Pause,
  Camera,
  Layers,
  Download,
  RefreshCw,
  Plus,
  Trash,
  Sparkles,
  Undo,
  Sliders,
  Check,
  Video,
  Activity,
  AlertCircle
} from "lucide-react";

interface Joint {
  id: string;
  name: string;
  x: number; // 0 to 400
  y: number; // 0 to 500
  parent?: string;
  color: string;
}

interface MotionPreset {
  id: string;
  name: string;
  description: string;
  vibe: string;
}

interface Keyframe {
  id: string;
  joints: Record<string, { x: number; y: number }>;
}

const CHARACTER_PRESETS = [
  {
    id: "cyborg",
    name: "Cyborg Assassin v4.2",
    desc: "A stylized cybernetic hunter featuring a carbon fiber chassis and electric cyan plasma joint nodes.",
    primaryColor: "#06b6d4",
    accentColor: "#f43f5e",
    visualStyle: "cyberpunk",
    outlineUrl: ""
  },
  {
    id: "astronaut",
    name: "Cosmic Odyssey Suit",
    desc: "Cinematic space explorer equipped with gold-foil life support nodes and a white carbon-mesh hull.",
    primaryColor: "#f59e0b",
    accentColor: "#10b981",
    visualStyle: "cinema",
    outlineUrl: ""
  },
  {
    id: "mystic",
    name: "Watercolor Spirit",
    desc: "A soft, hand-painted mystical entity with organic brushstroke segments and glowing forest embers.",
    primaryColor: "#a855f7",
    accentColor: "#e11d48",
    visualStyle: "watercolor",
    outlineUrl: ""
  },
  {
    id: "android",
    name: "Sleek Carbon Unit",
    desc: "A minimalist monochrome android featuring a glowing neon orange visor and fluid mechanical segments.",
    primaryColor: "#f97316",
    accentColor: "#3b82f6",
    visualStyle: "line-art",
    outlineUrl: ""
  }
];

const MOTION_PRESETS: MotionPreset[] = [
  { id: "idle", name: "Swaying Breath", description: "Subtle organic chest expansion and arm sway", vibe: "Ambient" },
  { id: "run", name: "Cyberpunk Dash", description: "High-velocity rhythmic running cycle", vibe: "Dynamic" },
  { id: "float", name: "Zero-G Float", description: "Weightless drift with floating limbs and spinal curve", vibe: "Ethereal" },
  { id: "strike", name: "Katana Lunge", description: "Coiled preparation followed by a sudden sweeping strike", vibe: "Action" },
  { id: "wave", name: "Robotic Wave", description: "Fluid kinetic ripple passing from left hand to right hand", vibe: "Technical" }
];

// Initial default T-Pose joints definition
const INITIAL_JOINTS: Joint[] = [
  { id: "pelvis", name: "Pelvis Center", x: 200, y: 260, color: "#ef4444" },
  { id: "spine", name: "Lower Spine", x: 200, y: 210, parent: "pelvis", color: "#3b82f6" },
  { id: "neck", name: "Neck Joint", x: 200, y: 140, parent: "spine", color: "#3b82f6" },
  { id: "head", name: "Head Node", x: 200, y: 90, parent: "neck", color: "#ec4899" },
  
  // Left arm
  { id: "l_shoulder", name: "L Shoulder", x: 150, y: 150, parent: "neck", color: "#10b981" },
  { id: "l_elbow", name: "L Elbow", x: 100, y: 150, parent: "l_shoulder", color: "#10b981" },
  { id: "l_hand", name: "L Hand", x: 50, y: 150, parent: "l_elbow", color: "#10b981" },

  // Right arm
  { id: "r_shoulder", name: "R Shoulder", x: 250, y: 150, parent: "neck", color: "#8b5cf6" },
  { id: "r_elbow", name: "R Elbow", x: 300, y: 150, parent: "r_shoulder", color: "#8b5cf6" },
  { id: "r_hand", name: "R Hand", x: 350, y: 150, parent: "r_elbow", color: "#8b5cf6" },

  // Left leg
  { id: "l_hip", name: "L Hip", x: 160, y: 270, parent: "pelvis", color: "#eab308" },
  { id: "l_knee", name: "L Knee", x: 160, y: 370, parent: "l_hip", color: "#eab308" },
  { id: "l_ankle", name: "L Ankle", x: 160, y: 460, parent: "l_knee", color: "#eab308" },

  // Right leg
  { id: "r_hip", name: "R Hip", x: 240, y: 270, parent: "pelvis", color: "#f97316" },
  { id: "r_knee", name: "R Knee", x: 240, y: 370, parent: "r_hip", color: "#f97316" },
  { id: "r_ankle", name: "R Ankle", x: 240, y: 460, parent: "r_knee", color: "#f97316" }
];

export default function RiggingMoCap({
  characters,
  clips,
  onSaveClip,
  onDeleteClip,
}: {
  characters: CharacterLook[];
  clips: RigClip[];
  onSaveClip: (clip: RigClip) => void;
  onDeleteClip: (id: string) => void;
}) {
  const [selectedChar, setSelectedChar] = useState(CHARACTER_PRESETS[0]);
  const [joints, setJoints] = useState<Joint[]>(JSON.parse(JSON.stringify(INITIAL_JOINTS)));
  const [activeJoint, setActiveJoint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // MoCap states
  const [activeMotion, setActiveMotion] = useState<string | null>(null);
  const [motionSpeed, setMotionSpeed] = useState<number>(1);
  const [motionIntensity, setMotionIntensity] = useState<number>(1);
  
  // Camera MoCap states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraTracking, setCameraTracking] = useState(false);
  
  // Timeline/Keyframes
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  
  // Project characters appear alongside the built-in rig styles
  const characterOptions = [
    ...characters.map((c) => ({
      id: c.id,
      name: c.name,
      desc: "From your project's characters",
      primaryColor: c.costume,
      accentColor: c.accent,
      visualStyle: "cinema",
      outlineUrl: "",
    })),
    ...CHARACTER_PRESETS,
  ];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const motionTime = useRef<number>(0);

  // Set preset poses (T-Pose, Active Run Pose, Floating)
  const applyPosePreset = (pose: "t_pose" | "action" | "crouch") => {
    const updated = JSON.parse(JSON.stringify(INITIAL_JOINTS)) as Joint[];
    if (pose === "action") {
      // Create a dynamic ninja-style combat pose
      updated.find(j => j.id === "l_elbow")!.y = 100;
      updated.find(j => j.id === "l_hand")!.y = 60;
      updated.find(j => j.id === "l_hand")!.x = 120;
      updated.find(j => j.id === "r_elbow")!.x = 280;
      updated.find(j => j.id === "r_elbow")!.y = 200;
      updated.find(j => j.id === "r_hand")!.x = 310;
      updated.find(j => j.id === "r_hand")!.y = 250;
      updated.find(j => j.id === "pelvis")!.y = 280;
      updated.find(j => j.id === "l_knee")!.x = 130;
      updated.find(j => j.id === "l_knee")!.y = 350;
      updated.find(j => j.id === "l_ankle")!.x = 110;
      updated.find(j => j.id === "l_ankle")!.y = 440;
      updated.find(j => j.id === "r_knee")!.x = 270;
      updated.find(j => j.id === "r_knee")!.y = 390;
      updated.find(j => j.id === "r_ankle")!.x = 300;
      updated.find(j => j.id === "r_ankle")!.y = 450;
    } else if (pose === "crouch") {
      // Crouched/Coiled stance
      updated.find(j => j.id === "pelvis")!.y = 340;
      updated.find(j => j.id === "spine")!.y = 300;
      updated.find(j => j.id === "neck")!.y = 240;
      updated.find(j => j.id === "head")!.y = 200;
      updated.find(j => j.id === "l_shoulder")!.y = 250;
      updated.find(j => j.id === "r_shoulder")!.y = 250;
      updated.find(j => j.id === "l_elbow")!.y = 270;
      updated.find(j => j.id === "r_elbow")!.y = 270;
      updated.find(j => j.id === "l_hand")!.y = 290;
      updated.find(j => j.id === "r_hand")!.y = 290;
      updated.find(j => j.id === "l_hip")!.y = 350;
      updated.find(j => j.id === "r_hip")!.y = 350;
      updated.find(j => j.id === "l_knee")!.x = 120;
      updated.find(j => j.id === "l_knee")!.y = 400;
      updated.find(j => j.id === "r_knee")!.x = 280;
      updated.find(j => j.id === "r_knee")!.y = 400;
      updated.find(j => j.id === "l_ankle")!.x = 140;
      updated.find(j => j.id === "l_ankle")!.y = 470;
      updated.find(j => j.id === "r_ankle")!.x = 260;
      updated.find(j => j.id === "r_ankle")!.y = 470;
    }
    setJoints(updated);
    setActiveMotion(null);
  };

  // Turn Webcam on/off
  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null;
      setCameraActive(false);
      setCameraTracking(false);
    } else {
      setCameraError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
        setCameraActive(true);
        setCameraTracking(true);
        setActiveMotion(null); // Overwrite procedural motions with camera sway!
      } catch (err: any) {
        console.error("Camera access failed", err);
        setCameraError("Webcam access denied. Please ensure browser permissions are configured.");
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timeline Player Loop
  useEffect(() => {
    if (!isPlayingTimeline || keyframes.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % keyframes.length;
        // Interpolate or set active joints to this keyframe
        const kf = keyframes[nextIndex];
        setJoints(currentJoints => {
          return currentJoints.map(j => {
            if (kf.joints[j.id]) {
              return { ...j, x: kf.joints[j.id].x, y: kf.joints[j.id].y };
            }
            return j;
          });
        });
        return nextIndex;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isPlayingTimeline, keyframes]);

  // Main canvas animation and joint update loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      motionTime.current += 0.05 * motionSpeed;
      const t = motionTime.current;

      // Local copy of joints to render (with motion offsets if active)
      let renderedJoints = [...joints];

      // 1. Procedural Motion Synthesis (Skeletal Sinusoidal Deformations)
      if (activeMotion) {
        const i = motionIntensity;
        renderedJoints = joints.map(j => {
          let dx = 0;
          let dy = 0;

          if (activeMotion === "idle") {
            // Subtle breathing and sway
            if (j.id === "spine" || j.id === "neck" || j.id === "head") {
              dx = Math.sin(t) * 4 * i;
              dy = Math.cos(t * 2) * 2 * i;
            } else if (j.id.startsWith("l_")) {
              dx = Math.sin(t) * 6 * i;
              dy = Math.cos(t) * 3 * i;
            } else if (j.id.startsWith("r_")) {
              dx = -Math.sin(t) * 6 * i;
              dy = Math.cos(t) * 3 * i;
            }
          } else if (activeMotion === "run") {
            // Rhythmic running pattern
            if (j.id === "pelvis") {
              dy = Math.sin(t * 2) * 8 * i;
              dx = Math.cos(t) * 3 * i;
            } else if (j.id === "head" || j.id === "neck") {
              dy = Math.sin(t * 2) * 4 * i;
            } else if (j.id === "l_elbow" || j.id === "l_hand") {
              dx = Math.sin(t) * 35 * i;
              dy = Math.cos(t) * 15 * i;
            } else if (j.id === "r_elbow" || j.id === "r_hand") {
              dx = -Math.sin(t) * 35 * i;
              dy = -Math.cos(t) * 15 * i;
            } else if (j.id === "l_knee") {
              dx = Math.sin(t) * 30 * i;
              dy = Math.max(0, Math.cos(t) * 25) * i;
            } else if (j.id === "r_knee") {
              dx = -Math.sin(t) * 30 * i;
              dy = Math.max(0, -Math.cos(t) * 25) * i;
            } else if (j.id === "l_ankle") {
              dx = Math.sin(t) * 35 * i;
              dy = Math.sin(t + 0.5) * 30 * i;
            } else if (j.id === "r_ankle") {
              dx = -Math.sin(t) * 35 * i;
              dy = -Math.sin(t + 0.5) * 30 * i;
            }
          } else if (activeMotion === "float") {
            // Lazily floating zero-G
            dx = Math.sin(t + j.y * 0.01) * 15 * i;
            dy = Math.cos(t * 0.7 + j.x * 0.01) * 15 * i;
          } else if (activeMotion === "strike") {
            // Katana charge and quick strike
            const strikePhase = t % (Math.PI * 2);
            if (strikePhase < Math.PI) {
              // Coiling back (anticipation)
              if (j.id === "pelvis" || j.id === "spine") {
                dx = -15 * i;
                dy = 10 * i;
              } else if (j.id.includes("hand")) {
                dx = -40 * i;
                dy = -10 * i;
              }
            } else {
              // Sweeping Slash
              const speedUp = (strikePhase - Math.PI) * 2;
              if (j.id.includes("hand") || j.id.includes("elbow")) {
                dx = (Math.sin(speedUp) * 80 - 10) * i;
                dy = (Math.cos(speedUp) * 40 + 20) * i;
              } else if (j.id === "pelvis" || j.id === "spine") {
                dx = 25 * i;
              }
            }
          } else if (activeMotion === "wave") {
            // Rippling wave
            const offset = (j.x / 400) * Math.PI * 2;
            dy = Math.sin(t * 1.5 + offset) * 15 * i;
            dx = Math.cos(t * 1.5 + offset) * 5 * i;
          }

          return { ...j, x: j.x + dx, y: j.y + dy };
        });
      }

      // CLEAR CANVAS
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // DRAW HIGH-TECH BACKGROUND GRAPHICS
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // DRAW THE CHARACTER GEOMETRIC PARTS (The "Rigged Mesh")
      // We will render beautiful custom polygons/paths matching the selected character style
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0)";

      const jMap = new Map(renderedJoints.map(j => [j.id, j]));

      const drawLimbSegment = (fromId: string, toId: string, width: number, strokeColor: string, fillColor: string, drawShield = false) => {
        const from = jMap.get(fromId);
        const to = jMap.get(toId);
        if (!from || !to) return;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.stroke();

        // High-tech sci-fi detailing on cyber limbs
        if (selectedChar.id === "cyborg" || selectedChar.id === "android") {
          ctx.beginPath();
          ctx.arc((from.x + to.x) / 2, (from.y + to.y) / 2, width / 2 - 2, 0, Math.PI * 2);
          ctx.fillStyle = selectedChar.accentColor;
          ctx.fill();
        }

        if (drawShield && selectedChar.id === "cyborg") {
          // Draw geometric forearm shield
          ctx.save();
          ctx.translate((from.x + to.x) / 2, (from.y + to.y) / 2);
          ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x));
          ctx.fillStyle = "rgba(255, 178, 36, 0.15)";
          ctx.strokeStyle = "rgba(255, 178, 36, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(-15, -6, 30, 12);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      };

      // Draw stylized physical character mesh parts based on style preset
      const style = selectedChar.visualStyle;
      const c1 = selectedChar.primaryColor;
      const c2 = selectedChar.accentColor;

      // Draw Head Mesh
      const headNode = jMap.get("head");
      const neckNode = jMap.get("neck");
      if (headNode && neckNode) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = c1;
        
        ctx.beginPath();
        if (style === "cyberpunk") {
          // Hexagonal visor head
          ctx.fillStyle = "rgba(255, 178, 36, 0.2)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 2;
          ctx.arc(headNode.x, headNode.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          //Visor line
          ctx.beginPath();
          ctx.moveTo(headNode.x - 16, headNode.y - 2);
          ctx.lineTo(headNode.x + 16, headNode.y - 2);
          ctx.strokeStyle = c2;
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (style === "cinema") {
          // Rounded golden bubble space helmet
          ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 2.5;
          ctx.arc(headNode.x, headNode.y, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Visor glass glow reflection
          ctx.beginPath();
          ctx.arc(headNode.x + 6, headNode.y - 6, 8, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
          ctx.fill();
        } else if (style === "watercolor") {
          // Fluid spiritual head form
          ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 1.5;
          ctx.arc(headNode.x, headNode.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Organic flower halo dots
          for (let deg = 0; deg < 360; deg += 60) {
            const rad = (deg * Math.PI) / 180;
            ctx.beginPath();
            ctx.arc(headNode.x + Math.cos(rad + t) * 26, headNode.y + Math.sin(rad + t) * 26, 3, 0, Math.PI * 2);
            ctx.fillStyle = c2;
            ctx.fill();
          }
        } else {
          // Sleek minimalist robot visor
          ctx.fillStyle = "rgba(249, 115, 22, 0.1)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(headNode.x - 18, headNode.y - 22, 36, 40);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.rect(headNode.x - 14, headNode.y - 6, 28, 6);
          ctx.fillStyle = c1;
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw chest plates and spinal hulls
      const spineNode = jMap.get("spine");
      const pelvisNode = jMap.get("pelvis");
      if (neckNode && spineNode && pelvisNode) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = c1;

        if (style === "cyberpunk") {
          // Cybernetic glowing ribs/chest plates
          ctx.beginPath();
          ctx.moveTo(neckNode.x - 25, neckNode.y + 15);
          ctx.lineTo(neckNode.x + 25, neckNode.y + 15);
          ctx.lineTo(spineNode.x + 18, spineNode.y);
          ctx.lineTo(spineNode.x - 18, spineNode.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 178, 36, 0.08)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          // Kinetic core node inside spinal chest
          ctx.beginPath();
          ctx.arc(spineNode.x, (neckNode.y + spineNode.y) / 2, 7 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
          ctx.fillStyle = c2;
          ctx.fill();
        } else if (style === "cinema") {
          // Bulbous metallic torso armor plate
          ctx.beginPath();
          ctx.arc(spineNode.x, (neckNode.y + pelvisNode.y) / 2, 32, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          // Central energy turbine
          ctx.beginPath();
          ctx.arc(spineNode.x, (neckNode.y + pelvisNode.y) / 2, 10, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
        } else if (style === "watercolor") {
          // Abstract floating brushstroke leaves for chest
          ctx.beginPath();
          ctx.ellipse(spineNode.x, (neckNode.y + pelvisNode.y) / 2, 24, 38, Math.sin(t * 0.5) * 0.1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
          ctx.strokeStyle = c1;
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
        } else {
          // Minimalist angular structural frames
          ctx.beginPath();
          ctx.moveTo(neckNode.x - 30, neckNode.y + 10);
          ctx.lineTo(neckNode.x + 30, neckNode.y + 10);
          ctx.lineTo(pelvisNode.x + 15, pelvisNode.y - 10);
          ctx.lineTo(pelvisNode.x - 15, pelvisNode.y - 10);
          ctx.closePath();
          ctx.strokeStyle = c1;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw Limbs (Bones and Hulls)
      const isCyber = style === "cyberpunk" || style === "android";
      const limbWidth = isCyber ? 7 : 5;
      const primaryLimbColor = "rgba(255,255,255,0.15)";
      
      // Arm bones
      drawLimbSegment("neck", "l_shoulder", 4, c1, "none");
      drawLimbSegment("neck", "r_shoulder", 4, c1, "none");
      drawLimbSegment("l_shoulder", "l_elbow", limbWidth, primaryLimbColor, "none");
      drawLimbSegment("l_elbow", "l_hand", limbWidth - 1, primaryLimbColor, "none", true);
      drawLimbSegment("r_shoulder", "r_elbow", limbWidth, primaryLimbColor, "none");
      drawLimbSegment("r_elbow", "r_hand", limbWidth - 1, primaryLimbColor, "none");

      // Spine & Hips
      drawLimbSegment("neck", "spine", 8, c1, "none");
      drawLimbSegment("spine", "pelvis", 10, c1, "none");
      drawLimbSegment("pelvis", "l_hip", 6, c1, "none");
      drawLimbSegment("pelvis", "r_hip", 6, c1, "none");

      // Leg bones
      drawLimbSegment("l_hip", "l_knee", limbWidth + 1, primaryLimbColor, "none");
      drawLimbSegment("l_knee", "l_ankle", limbWidth, primaryLimbColor, "none");
      drawLimbSegment("r_hip", "r_knee", limbWidth + 1, primaryLimbColor, "none");
      drawLimbSegment("r_knee", "r_ankle", limbWidth, primaryLimbColor, "none");

      // 3. DRAW SKELETAL SENSOR OVERLAY (High Tech Node Circles)
      renderedJoints.forEach(j => {
        const isHovered = activeJoint === j.id;
        
        ctx.save();
        ctx.shadowBlur = isHovered ? 15 : 6;
        ctx.shadowColor = j.color;

        // Draw joint core glowing ring
        ctx.beginPath();
        ctx.arc(j.x, j.y, isHovered ? 10 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? j.color : "rgba(15, 15, 17, 0.9)";
        ctx.strokeStyle = j.color;
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        // High-tech MoCap concentric radar ring
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(j.x, j.y, 18, 0, Math.PI * 2);
          ctx.strokeStyle = `${j.color}44`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 2]);
          ctx.stroke();
        }

        ctx.restore();
      });

      // RENDER HUD overlay data inside canvas
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "8px monospace";
      ctx.fillText(`MO_CAP_STREAM: ${cameraActive ? "LIVE_FEED_SYNCED" : "PROCEDURAL_SYNTH"}`, 12, 20);
      ctx.fillText(`ACTIVE_MESH: ${selectedChar.name.toUpperCase()}`, 12, 32);
      ctx.fillText(`MOCAP_SYSTEMS: ACTIVE`, 12, 44);

      if (activeJoint) {
        const selNode = renderedJoints.find(j => j.id === activeJoint);
        if (selNode) {
          ctx.fillStyle = c1;
          ctx.fillText(`NODE_NAME: ${selNode.name.toUpperCase()}`, 12, canvas.height - 30);
          ctx.fillText(`COORDS: X=${Math.round(selNode.x)}, Y=${Math.round(selNode.y)}`, 12, canvas.height - 18);
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [joints, activeJoint, selectedChar, activeMotion, motionSpeed, motionIntensity]);

  // Handle Dragging of Skeleton Nodes
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Find if clicked near any node (radius threshold 15)
    const clickedNode = joints.find(j => Math.hypot(clickX - j.x, clickY - j.y) < 15);

    if (clickedNode) {
      setActiveJoint(clickedNode.id);
      setIsDragging(true);
      // Turn off playing presets while dragging manually
      setActiveMotion(null);
    } else {
      setActiveJoint(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !activeJoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Constrain inside bounds
    const boundedX = Math.max(10, Math.min(canvas.width - 10, mouseX));
    const boundedY = Math.max(10, Math.min(canvas.height - 10, mouseY));

    setJoints(current => 
      current.map(j => (j.id === activeJoint ? { ...j, x: boundedX, y: boundedY } : j))
    );
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Timeline / Keyframing controls
  const addKeyframe = () => {
    const jointMap: Record<string, { x: number; y: number }> = {};
    joints.forEach(j => {
      jointMap[j.id] = { x: j.x, y: j.y };
    });
    const newKf: Keyframe = {
      id: "kf_" + Date.now(),
      joints: jointMap
    };
    setKeyframes([...keyframes, newKf]);
  };

  const removeKeyframe = (id: string) => {
    setKeyframes(keyframes.filter(k => k.id !== id));
  };

  const clearTimeline = () => {
    setKeyframes([]);
    setIsPlayingTimeline(false);
    setCurrentFrameIndex(0);
  };

  return (
    <div className="flex flex-col gap-6" id="mocap-rigging-workspace">
      
      {/* Visual Header Banner */}
      <div className="bg-surface border border-line p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-fg/[0.04] to-transparent pointer-events-none"></div>
        <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono text-fg">04</span>
              <h2 className="text-xs uppercase tracking-widest font-semibold text-fg/80">Motion rig</h2>
            </div>
            <p className="text-xs text-muted max-w-xl">
              Pose the skeleton by dragging joints, layer a motion on top, or record keyframes. Save the result as a clip, then cast it in any storyboard scene.
            </p>
          </div>
          <span className="text-[11px] font-mono bg-fg/[0.05] text-fg px-2 py-1 border border-fg/60 uppercase tracking-widest">
            {clips.length} clips in project
          </span>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Rigging Controls & Presets (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          
          {/* Preset Characters */}
          <div className="bg-surface border border-line p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg/40">A</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-fg/80">Select Character Asset</h3>
              </div>
              <span className="text-[11px] font-mono opacity-50 uppercase">Assets</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {characterOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChar(c)}
                  className={`p-3 text-left border cursor-pointer rounded-xs transition-all relative overflow-hidden flex flex-col gap-1 ${
                    selectedChar.id === c.id
                      ? "bg-fg/[0.05] text-fg border-fg/60"
                      : "bg-black/40 text-fg/60 border-line hover:border-line-strong"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider block">{c.name}</span>
                  <span className="text-[11px] opacity-50 line-clamp-2 leading-relaxed">{c.desc}</span>
                  {selectedChar.id === c.id && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Joint Positions (Quick Poses) */}
          <div className="bg-surface border border-line p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg/40">B</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-fg/80">Calibration & Pose Presets</h3>
              </div>
              <span className="text-[11px] font-mono opacity-50 uppercase">Calibration</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => applyPosePreset("t_pose")}
                className="py-2.5 px-3 bg-black/40 border border-line hover:border-line-strong text-[11px] font-mono font-bold uppercase text-fg/80 rounded-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                T-Pose (Rest)
              </button>
              <button
                onClick={() => applyPosePreset("action")}
                className="py-2.5 px-3 bg-black/40 border border-line hover:border-line-strong text-[11px] font-mono font-bold uppercase text-fg/80 rounded-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Combat Pose
              </button>
              <button
                onClick={() => applyPosePreset("crouch")}
                className="py-2.5 px-3 bg-black/40 border border-line hover:border-line-strong text-[11px] font-mono font-bold uppercase text-fg/80 rounded-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Undo className="w-3.5 h-3.5" />
                Crouch
              </button>
            </div>
          </div>

          {/* Procedural MoCap Motion Streams */}
          <div className="bg-surface border border-line p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg/40">C</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-fg/80">Procedural Motion presets</h3>
              </div>
              <span className="text-[11px] font-mono opacity-50 uppercase">Library</span>
            </div>

            <div className="flex flex-col gap-2">
              {MOTION_PRESETS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMotion(m.id);
                    setCameraTracking(false);
                  }}
                  className={`p-2.5 text-left border cursor-pointer rounded-xs transition-all relative overflow-hidden flex items-center justify-between gap-3 ${
                    activeMotion === m.id
                      ? "bg-fg/[0.05] text-fg border-fg/60"
                      : "bg-black/40 text-fg/60 border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold uppercase tracking-wider block">{m.name}</span>
                    <span className="text-[11px] opacity-50 line-clamp-1">{m.description}</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-fg/5 uppercase shrink-0 text-fg/60">
                    {m.vibe}
                  </span>
                </button>
              ))}
            </div>

            {/* Speed & Intensity sliders */}
            {activeMotion && (
              <div className="mt-2 pt-3 border-t border-line flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] uppercase font-mono tracking-wider opacity-60">
                    <span>Motion Speed Cycle</span>
                    <span>{motionSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={motionSpeed}
                    onChange={(e) => setMotionSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-fg/10 rounded-sm appearance-none outline-none accent-accent"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] uppercase font-mono tracking-wider opacity-60">
                    <span>Joint Displacement Intensity</span>
                    <span>{motionIntensity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={motionIntensity}
                    onChange={(e) => setMotionIntensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-fg/10 rounded-sm appearance-none outline-none accent-accent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timeline & Keyframing */}
          <div className="bg-surface border border-line p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-fg/40">D</span>
                <h3 className="text-xs uppercase tracking-widest font-semibold text-fg/80">Kinetic Timeline / Keyframes</h3>
              </div>
              <span className="text-[11px] font-mono text-fg uppercase">Local Record</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={addKeyframe}
                className="flex-1 py-2 bg-black/50 hover:bg-black/80 border border-line text-[11px] font-mono font-bold uppercase tracking-wider text-fg rounded-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-fg" />
                Add Keyframe
              </button>
              {keyframes.length > 0 && (
                <button
                  onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                  className={`px-4 py-2 border text-[11px] font-mono font-bold uppercase rounded-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                    isPlayingTimeline 
                      ? "bg-accent text-ink border-fg/60" 
                      : "bg-accent text-fg border-fg/60"
                  }`}
                >
                  {isPlayingTimeline ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlayingTimeline ? "Pause" : "Play Sequence"}
                </button>
              )}
              {keyframes.length > 0 && (
                <button
                  onClick={clearTimeline}
                  className="px-3.5 py-2 bg-black/40 hover:bg-danger/10 border border-line hover:border-danger/30 text-[11px] font-mono text-muted hover:text-danger rounded-xs cursor-pointer"
                  title="Clear Timeline"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {keyframes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-mono uppercase text-fg/40 flex justify-between">
                  <span>Recorded Frames ({keyframes.length})</span>
                  <span>Active Frame: {currentFrameIndex + 1}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {keyframes.map((kf, idx) => (
                    <div
                      key={kf.id}
                      className={`h-11 w-11 shrink-0 border rounded-xs flex flex-col items-center justify-center relative group select-none transition-all ${
                        currentFrameIndex === idx 
                          ? "bg-fg/[0.05] border-fg/60 text-fg" 
                          : "bg-black/60 border-line text-fg/40"
                      }`}
                    >
                      <span className="text-[11px] font-mono font-bold">F{idx+1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeKeyframe(kf.id);
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-danger hover:bg-danger text-fg text-[11px] flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Rigging Interactive Canvas & MoCap Output (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-5">
          
          {/* Interactive Joint Editor Canvas Container */}
          <div className="relative aspect-[4/5] md:aspect-video xl:aspect-square w-full bg-surface border border-line overflow-hidden group shadow-2xl flex flex-col">
            
            {/* Live Render Canvas */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <canvas
                ref={canvasRef}
                width={400}
                height={500}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className="w-full h-full max-w-[400px] max-h-[500px] cursor-crosshair touch-none"
              />
            </div>

            {/* Floating Live Camera Picture-In-Picture Overlay */}
            {cameraActive && (
              <div className="absolute bottom-4 left-4 w-32 md:w-44 bg-black/90 border border-fg/60 rounded-sm overflow-hidden shadow-2xl flex flex-col z-20">
                <div className="relative w-full aspect-[4/3] bg-surface overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
                <div className="py-1 px-2 flex justify-between items-center text-[11px] font-mono bg-black border-t border-line">
                  <span className="text-muted uppercase tracking-wider">Reference mirror</span>
                </div>
              </div>
            )}

            {/* Absolute HUD Top bar overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
              <span className="bg-black/80 px-2.5 py-1 text-[11px] font-mono text-fg uppercase tracking-widest border border-fg/60 rounded-sm">
                Rig · drag the joints
              </span>
              <div className="flex gap-2 pointer-events-auto">
                <button
                  onClick={toggleCamera}
                  className={`px-3 py-1 text-[11px] font-mono uppercase rounded-sm border transition-all cursor-pointer flex items-center gap-1.5 ${
                    cameraActive 
                      ? "bg-danger/10 text-danger border-danger/30" 
                      : "bg-fg/[0.05] text-fg border-fg/60 hover:border-fg/60"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {cameraActive ? "Hide mirror" : "Reference mirror"}
                </button>
              </div>
            </div>

            {/* Hover Tooltip or Guidance */}
            <div className="absolute bottom-4 right-4 pointer-events-none z-10 bg-black/80 p-2.5 border border-line max-w-[200px] text-[11px] leading-normal font-mono text-muted">
              <span className="text-fg font-bold block uppercase mb-0.5 text-[11px]">IK/FK Editor</span>
              Click and drag joint node markers to manipulate limb configurations.
            </div>
          </div>

          {/* Webcam Access Error messaging */}
          {cameraError && (
            <div className="bg-danger/10 border border-danger/30 p-3.5 rounded-xs flex items-start gap-3 text-danger text-xs">
              <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              <div>
                <span className="font-bold uppercase tracking-wider block mb-0.5">Camera Error</span>
                <p className="leading-relaxed text-danger/80">{cameraError}</p>
              </div>
            </div>
          )}

          <ClipSaver joints={joints} keyframes={keyframes} activeMotion={activeMotion} motionSpeed={motionSpeed} motionIntensity={motionIntensity} clips={clips} onSave={onSaveClip} onDelete={onDeleteClip} onLoad={(clip) => {
            setJoints((current) => current.map((j) => (clip.pose[j.id] ? { ...j, ...clip.pose[j.id] } : j)));
            setActiveMotion(clip.motion);
            setMotionSpeed(clip.speed);
            setMotionIntensity(clip.intensity);
            setKeyframes(clip.keyframes.map((k, n) => ({ id: `kf_${n}_${Date.now()}`, joints: k })));
          }} />
        </div>

      </div>

    </div>
  );
}

/** Save the current pose, motion and keyframes as a clip the storyboard can cast. */
function ClipSaver({
  joints,
  keyframes,
  activeMotion,
  motionSpeed,
  motionIntensity,
  clips,
  onSave,
  onDelete,
  onLoad,
}: {
  joints: Joint[];
  keyframes: Keyframe[];
  activeMotion: string | null;
  motionSpeed: number;
  motionIntensity: number;
  clips: RigClip[];
  onSave: (clip: RigClip) => void;
  onDelete: (id: string) => void;
  onLoad: (clip: RigClip) => void;
}) {
  const [name, setName] = useState("");
  const [frameSeconds, setFrameSeconds] = useState(0.8);
  const [saved, setSaved] = useState("");

  const save = (existing?: RigClip) => {
    const pose = keyframes.length
      ? keyframes[0].joints
      : Object.fromEntries(joints.map((j) => [j.id, { x: j.x, y: j.y }]));
    const clip: RigClip = {
      id: existing?.id ?? newId("clip"),
      name: name.trim() || existing?.name || MOTION_PRESETS.find((m) => m.id === activeMotion)?.name || `Clip ${clips.length + 1}`,
      pose: { ...STANDING_POSE, ...pose },
      motion: (activeMotion as MotionId | null) ?? null,
      speed: motionSpeed,
      intensity: motionIntensity,
      keyframes: keyframes.map((k) => k.joints),
      keyframeSeconds: frameSeconds,
    };
    onSave(clip);
    setSaved(clip.name);
    setName("");
  };

  return (
    <div className="flex flex-col gap-4 border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-medium text-fg">Save as clip</h3>
        <span className="eyebrow">Used by the storyboard</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        Saves the pose{keyframes.length ? `, ${keyframes.length} keyframes` : ""}
        {activeMotion ? ` and the ${MOTION_PRESETS.find((m) => m.id === activeMotion)?.name.toLowerCase()} motion` : ""}. Cast it into any scene from the storyboard's Scene panel.
      </p>
      <Field label="Clip name" htmlFor="clip-name">
        <input id="clip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hero runs in" className={inputClass} />
      </Field>
      {keyframes.length > 1 && (
        <Slider label="Time per keyframe" value={frameSeconds} min={0.2} max={2} step={0.1} onChange={setFrameSeconds} format={(v) => `${v.toFixed(1)}s`} />
      )}
      <Button variant="primary" onClick={() => save()}>
        Save clip
      </Button>
      {saved && <Notice>Saved “{saved}”. It's ready to cast in the storyboard.</Notice>}
      {clips.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-[14px] text-fg">{c.name}</span>
              <span className="eyebrow text-faint">{c.keyframes.length ? `${c.keyframes.length} keys` : c.motion ?? "pose"}</span>
              <Button size="sm" variant="ghost" onClick={() => onLoad(c)}>
                Load
              </Button>
              <Button size="sm" variant="ghost" onClick={() => save(c)} title="Overwrite with the current rig">
                Update
              </Button>
              <IconButton label={`Delete ${c.name}`} onClick={() => onDelete(c.id)}>
                <Trash className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
