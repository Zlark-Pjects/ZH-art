import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Pose } from "../../project/rig";
import { PREVIEW_BONES, landmarksToPose, loadLandmarker, smoothPose, type Landmark } from "./poseTracking";

export type MocapStatus = "off" | "starting" | "loading" | "tracking" | "error";
export type RecordState = "idle" | "countdown" | "recording";

export const TAKE_FPS = 12;
export const MAX_TAKE_SECONDS = 20;
const COUNTDOWN_SECONDS = 3;

/**
 * Webcam motion capture: camera stream, on-device pose tracking, a live
 * pose for the rig, and recording takes as keyframes.
 */
export function useMotionCapture(onTake: (frames: Pose[], frameSeconds: number) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const loopRef = useRef<number | null>(null);
  const livePose = useRef<Pose | null>(null);
  const takeRef = useRef<Pose[]>([]);
  const lastSampleRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const recordStartRef = useRef(0);
  const onTakeRef = useRef(onTake);
  onTakeRef.current = onTake;

  const [status, setStatus] = useState<MocapStatus>("off");
  const [error, setError] = useState("");
  const [personVisible, setPersonVisible] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const recordStateRef = useRef<RecordState>("idle");
  const [countdown, setCountdown] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setRec = (s: RecordState) => {
    recordStateRef.current = s;
    setRecordState(s);
  };

  const finishTake = useCallback(() => {
    if (recordStateRef.current !== "recording") return;
    setRec("idle");
    const frames = takeRef.current;
    takeRef.current = [];
    // Slower devices track fewer frames than TAKE_FPS; spread them over the
    // real recording time so the take plays back at the speed it was performed.
    const seconds = (performance.now() - recordStartRef.current) / 1000;
    if (frames.length >= 2) onTakeRef.current(frames, Math.max(1 / 30, seconds / frames.length));
  }, []);

  const drawOverlay = (lm: Landmark[] | null) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const pt = (i: number) => ({ x: (1 - lm[i].x) * canvas.width, y: lm[i].y * canvas.height });
    const ok = (i: number) => (lm[i]?.visibility ?? 1) > 0.5;
    ctx.lineWidth = Math.max(2, canvas.width / 160);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffb224";
    for (const [a, b] of PREVIEW_BONES) {
      if (!ok(a) || !ok(b)) continue;
      const pa = pt(a);
      const pb = pt(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.fillStyle = "#edeae3";
    for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      if (!ok(i)) continue;
      const p = pt(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const tick = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || !streamRef.current) return;
    // Only run the model when the camera has delivered a new frame
    if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const lm = (result.landmarks?.[0] as Landmark[] | undefined) ?? null;
      const pose = lm ? landmarksToPose(lm, video.videoWidth, video.videoHeight) : null;
      livePose.current = pose ? smoothPose(livePose.current, pose) : null;
      setPersonVisible((v) => (v === Boolean(pose) ? v : Boolean(pose)));
      drawOverlay(lm);

      if (recordStateRef.current === "recording") {
        const elapsed = (now - recordStartRef.current) / 1000;
        if (livePose.current && now - lastSampleRef.current >= 1000 / TAKE_FPS) {
          lastSampleRef.current = now;
          takeRef.current.push(livePose.current);
        }
        setRecordSeconds(Math.floor(elapsed * 10) / 10);
        if (elapsed >= MAX_TAKE_SECONDS) finishTake();
      }
    }
    loopRef.current = requestAnimationFrame(tick);
  }, [finishTake]);

  const stop = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    livePose.current = null;
    takeRef.current = [];
    setRec("idle");
    setPersonVisible(false);
    setStatus("off");
  }, []);

  const start = useCallback(async () => {
    setError("");
    setStatus("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use a camera here. Use a recent browser over https or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus("loading");
      landmarkerRef.current = await loadLandmarker();
      if (!streamRef.current) return; // stopped while loading
      setStatus("tracking");
      loopRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      const missing = err?.name === "NotFoundError" || err?.name === "OverconstrainedError";
      setError(
        denied
          ? "Camera access was blocked. Allow the camera for this site in your browser settings. Embedded previews can't use the camera at all; run ZH-art directly to use motion capture."
          : missing
            ? "No camera was found."
            : err?.message || "Couldn't start motion capture.",
      );
      setStatus("error");
    }
  }, [tick]);

  useEffect(() => stop, [stop]);

  /** 3-2-1 countdown, then record the performance until stopped (max 20 s). */
  const record = useCallback(() => {
    if (status !== "tracking" || recordStateRef.current !== "idle") return;
    setRec("countdown");
    setCountdown(COUNTDOWN_SECONDS);
    let n = COUNTDOWN_SECONDS;
    countdownTimer.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        takeRef.current = [];
        lastSampleRef.current = 0;
        recordStartRef.current = performance.now();
        setRecordSeconds(0);
        setRec("recording");
      }
    }, 1000);
  }, [status]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setRec("idle");
  }, []);

  return {
    videoRef,
    overlayRef,
    livePose,
    status,
    error,
    personVisible,
    start,
    stop,
    record,
    stopRecording: finishTake,
    cancelCountdown,
    recordState,
    countdown,
    recordSeconds,
  };
}
