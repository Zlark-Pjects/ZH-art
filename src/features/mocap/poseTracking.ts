import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { STANDING_POSE, type Pose } from "../../project/rig";

/*
 * Real webcam motion capture with MediaPipe Pose Landmarker.
 * The model and WASM runtime are served by this app (public/models,
 * public/mediapipe), so tracking runs entirely on this device: no video
 * or pose data leaves the browser.
 */

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Load (once) the pose model. GPU when available, CPU otherwise. */
export function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const create = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// MediaPipe landmark indices -> rig joints. The view is mirrored, so the
// performer's left side drives the rig's screen-left ("l_") joints.
const MAP: Record<string, number> = {
  head: 0,
  l_shoulder: 11,
  r_shoulder: 12,
  l_elbow: 13,
  r_elbow: 14,
  l_hand: 15,
  r_hand: 16,
  l_hip: 23,
  r_hip: 24,
  l_knee: 25,
  r_knee: 26,
  l_ankle: 27,
  r_ankle: 28,
};

const VISIBLE = 0.5;
// Rig distance from pelvis (200,260) to neck (200,140): the torso drives the scale
const RIG_TORSO = 120;
const PELVIS = { x: 200, y: 260 };

/**
 * Convert landmarks (normalised to the video frame) into a rig pose.
 * The figure is anchored at the pelvis and scaled by torso length, so it
 * keeps the same size however far the performer stands from the camera.
 * Joints the camera can't see fall back to the standing pose.
 */
export function landmarksToPose(lm: Landmark[], videoW: number, videoH: number): Pose | null {
  const px = (i: number) => ({ x: (1 - lm[i].x) * videoW, y: lm[i].y * videoH });
  const seen = (i: number) => (lm[i]?.visibility ?? 1) >= VISIBLE;
  if (!seen(11) || !seen(12)) return null; // need at least the shoulders

  const ls = px(11);
  const rs = px(12);
  const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);

  let pelvis: { x: number; y: number };
  let torso: number;
  if (seen(23) && seen(24)) {
    const lh = px(23);
    const rh = px(24);
    pelvis = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    torso = Math.hypot(neck.x - pelvis.x, neck.y - pelvis.y);
  } else {
    // Hips out of frame (seated or close-up): estimate from shoulder width
    torso = shoulderWidth * 1.25;
    pelvis = { x: neck.x, y: neck.y + torso };
  }
  const s = RIG_TORSO / Math.max(1, torso);
  const toRig = (p: { x: number; y: number }) => ({ x: PELVIS.x + (p.x - pelvis.x) * s, y: PELVIS.y + (p.y - pelvis.y) * s });

  const pose: Pose = { ...STANDING_POSE };
  const rigNeck = toRig(neck);
  pose.pelvis = { ...PELVIS };
  pose.neck = rigNeck;
  pose.spine = { x: PELVIS.x + (rigNeck.x - PELVIS.x) * 0.42, y: PELVIS.y + (rigNeck.y - PELVIS.y) * 0.42 };

  for (const [joint, index] of Object.entries(MAP)) {
    if (seen(index)) {
      pose[joint] = toRig(px(index));
    } else {
      // Keep unseen limbs hanging naturally relative to the tracked body
      const rest = STANDING_POSE[joint];
      pose[joint] = { x: rest.x + (rigNeck.x - 200) * (joint.includes("hip") || joint.includes("knee") || joint.includes("ankle") ? 0 : 1), y: rest.y };
    }
  }
  // Head sits a little above the nose landmark
  if (seen(0)) pose.head = { x: pose.head.x, y: pose.head.y - 12 };
  return pose;
}

/** Exponential smoothing so the figure doesn't jitter. */
export function smoothPose(prev: Pose | null, next: Pose, amount = 0.55): Pose {
  if (!prev) return next;
  const out: Pose = {};
  for (const id of Object.keys(next)) {
    const a = prev[id] ?? next[id];
    const b = next[id];
    out[id] = { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
  }
  return out;
}

/** Bones to draw over the video preview, as landmark index pairs. */
export const PREVIEW_BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
