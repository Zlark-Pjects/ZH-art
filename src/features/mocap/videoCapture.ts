import type { Pose } from "../../project/rig";
import { detectPose, landmarksToPose, loadLandmarker, smoothPose } from "./poseTracking";
import type { RawTake } from "./cleanup";

/*
 * Motion capture from a video file: step through the chosen part frame by
 * frame and track the performer with the same on-device pose model as the
 * webcam. The video is never uploaded anywhere.
 */

export const MAX_VIDEO_SECONDS = 60;

function seek(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("The video stopped responding while seeking."));
    }, 5000);
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

export async function trackVideo(
  video: HTMLVideoElement,
  opts: { start: number; end: number; fps: number; mirror: boolean },
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<RawTake> {
  const landmarker = await loadLandmarker();
  video.pause();
  const frames: Pose[] = [];
  const times: number[] = [];
  const end = Math.min(opts.end, opts.start + MAX_VIDEO_SECONDS, video.duration);
  const step = 1 / opts.fps;
  let prev: Pose | null = null;
  for (let t = opts.start; t <= end + 1e-6; t += step) {
    if (signal.aborted) throw new DOMException("Tracking cancelled", "AbortError");
    await seek(video, t);
    const lm = detectPose(landmarker, video);
    const pose = lm ? landmarksToPose(lm, video.videoWidth, video.videoHeight, opts.mirror) : null;
    if (pose) {
      // A touch of smoothing at capture keeps single-frame glitches out of the take
      prev = smoothPose(prev, pose, 0.8);
      frames.push(prev);
      times.push(Math.round((t - opts.start) * 1000) / 1000);
    }
    onProgress((t - opts.start) / Math.max(step, end - opts.start));
  }
  if (frames.length < 2) throw new Error("Couldn't find a person in that part of the video. Pick a part where one person is clearly in view.");
  return { frames, times, source: "video" };
}

/** Track a single frame (the one the video is showing) as a pose. */
export async function poseFromFrame(video: HTMLVideoElement, mirror: boolean): Promise<Pose | null> {
  const landmarker = await loadLandmarker();
  const lm = detectPose(landmarker, video);
  return lm ? landmarksToPose(lm, video.videoWidth, video.videoHeight, mirror) : null;
}
