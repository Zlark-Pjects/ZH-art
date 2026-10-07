import { useEffect, useRef, useState } from "react";
import { Camera, Film, Square, Upload } from "lucide-react";
import type { Pose } from "../../project/rig";
import { Button, Notice, Progress, Section, Segmented, Slider } from "../../ui";
import { TAKE_FPS, type useMotionCapture } from "../mocap/useMotionCapture";
import { MAX_VIDEO_SECONDS, poseFromFrame, trackVideo } from "../mocap/videoCapture";
import { takeDuration, type CleanupOptions, type RawTake } from "../mocap/cleanup";

type Source = "webcam" | "video";

/** Motion capture from the webcam or a video file, plus clean-up of the take. */
export function CapturePanel({
  mocap,
  take,
  cleanup,
  onCleanup,
  onTake,
  onPose,
  keyCount,
}: {
  mocap: ReturnType<typeof useMotionCapture>;
  take: RawTake | null;
  cleanup: CleanupOptions;
  onCleanup: (patch: Partial<CleanupOptions>) => void;
  onTake: (take: RawTake) => void;
  onPose: (pose: Pose) => void;
  keyCount: number;
}) {
  const [source, setSource] = useState<Source>("webcam");

  return (
    <div>
      <Section index="01" title="Capture" aside="On this device">
        <div className="flex flex-col gap-4">
          <Segmented
            label="Source"
            value={source}
            onChange={(s) => {
              if (s === "video" && mocap.status !== "off") mocap.stop();
              setSource(s);
            }}
            options={[
              { value: "webcam", label: "Webcam" },
              { value: "video", label: "Video file" },
            ]}
          />
          {source === "webcam" ? <WebcamCapture mocap={mocap} onPose={onPose} /> : <VideoCapture onTake={onTake} onPose={onPose} />}
        </div>
      </Section>

      {take && (
        <Section index="02" title="Clean up the take" aside={`${takeDuration(take).toFixed(1)}s · ${take.frames.length} frames`}>
          <div className="flex flex-col gap-5">
            <Slider label="Start" value={cleanup.start} min={0} max={Math.max(0, cleanup.end - 0.3)} step={0.05} onChange={(v) => onCleanup({ start: v })} format={(v) => `${v.toFixed(2)}s`} />
            <Slider label="End" value={cleanup.end} min={Math.min(takeDuration(take), cleanup.start + 0.3)} max={takeDuration(take)} step={0.05} onChange={(v) => onCleanup({ end: v })} format={(v) => `${v.toFixed(2)}s`} />
            <Slider label="Smoothing" value={Math.round(cleanup.smoothing * 100)} min={0} max={100} onChange={(v) => onCleanup({ smoothing: v / 100 })} format={(v) => (v === 0 ? "Off" : `${v}%`)} />
            <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
              <span>
                Foot lock
                <span className="block text-xs text-faint">Feet stay on the floor and stop sliding while planted</span>
              </span>
              <input type="checkbox" checked={cleanup.footLock} onChange={(e) => onCleanup({ footLock: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
            </label>
            <Segmented
              label="Keys per second"
              value={String(cleanup.fps)}
              onChange={(v) => onCleanup({ fps: Number(v) })}
              options={[
                { value: "6", label: "6" },
                { value: "12", label: "12" },
                { value: "24", label: "24" },
              ]}
            />
            <p className="text-xs leading-relaxed text-faint">
              The take is now {keyCount} keys on the track. Changes here rebuild them from the original capture, so nothing is lost. Hand edits to keys are replaced when you change these settings.
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}

function WebcamCapture({ mocap, onPose }: { mocap: ReturnType<typeof useMotionCapture>; onPose: (pose: Pose) => void }) {
  const on = mocap.status !== "off" && mocap.status !== "error";
  const tracking = mocap.status === "tracking";
  const status =
    mocap.status === "starting"
      ? "Waiting for the camera…"
      : mocap.status === "loading"
        ? "Loading the pose model (about 6 MB, first time only)…"
        : tracking
          ? mocap.personVisible
            ? "Tracking you"
            : "Step back until your upper body is in frame"
          : "";

  return (
    <>
      <div className={on ? "relative aspect-[4/3] overflow-hidden bg-black ring-1 ring-line" : "hidden"}>
        <video ref={mocap.videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-70" />
        <canvas ref={mocap.overlayRef} className="absolute inset-0 h-full w-full object-cover" aria-hidden />
        {mocap.recordState === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="font-display text-[8rem] leading-none text-fg">{mocap.countdown}</span>
          </div>
        )}
        {mocap.recordState === "recording" && (
          <span className="eyebrow absolute left-3 top-3 flex items-center gap-2 bg-black/70 px-2 py-1 text-fg">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden /> Rec {mocap.recordSeconds.toFixed(1)}s
          </span>
        )}
        {status && <span className="eyebrow absolute bottom-3 left-3 bg-black/70 px-2 py-1 text-fg" aria-live="polite">{status}</span>}
      </div>
      {!on && (
        <p className="text-[13px] leading-relaxed text-muted">
          Act out a motion and the rig follows you live. Record a take of up to 20 seconds after a 3-second countdown. The video never leaves your browser.
        </p>
      )}
      {mocap.error && <Notice tone="error">{mocap.error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {!on ? (
          <Button variant="primary" icon={<Camera className="h-4 w-4" />} onClick={mocap.start}>
            Start camera
          </Button>
        ) : (
          <>
            {mocap.recordState === "idle" && (
              <Button variant="primary" onClick={mocap.record} disabled={!tracking}>
                Record take
              </Button>
            )}
            {mocap.recordState === "countdown" && <Button onClick={mocap.cancelCountdown}>Cancel</Button>}
            {mocap.recordState === "recording" && (
              <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={mocap.stopRecording}>
                Stop take
              </Button>
            )}
            <Button onClick={() => mocap.livePose.current && onPose(mocap.livePose.current)} disabled={!tracking || !mocap.personVisible || mocap.recordState !== "idle"}>
              Use this pose
            </Button>
            <Button variant="ghost" onClick={mocap.stop}>
              Stop camera
            </Button>
          </>
        )}
      </div>
      {on && <p className="text-xs leading-relaxed text-faint">Face the camera with your upper body in frame; full body works best. Takes record at up to {TAKE_FPS} fps.</p>}
    </>
  );
}

function VideoCapture({ onTake, onPose }: { onTake: (take: RawTake) => void; onPose: (pose: Pose) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [mirror, setMirror] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => () => {
    abortRef.current?.abort();
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  const pick = (f: File) => {
    setError("");
    setNote("");
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v|mkv)$/i.test(f.name)) {
      setError("That file isn't a video. Try an MP4, MOV or WebM.");
      return;
    }
    if (file) URL.revokeObjectURL(file.url);
    setFile({ url: URL.createObjectURL(f), name: f.name });
  };

  const track = async () => {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    setNote("");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const take = await trackVideo(video, { start: range.start, end: range.end, fps: 24, mirror }, setProgress, controller.signal);
      onTake(take);
      setNote(`Tracked ${take.frames.length} frames. The take is on the keyframe track; clean it up below.`);
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err?.message || "Couldn't track that video.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const useFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    try {
      const pose = await poseFromFrame(video, mirror);
      if (pose) onPose(pose);
      else setError("No one was found in this frame.");
    } catch (err: any) {
      setError(err?.message || "Couldn't track this frame.");
    }
  };

  const busy = progress !== null;
  const span = Math.max(0, range.end - range.start);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.m4v"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pick(f);
        }}
      />
      {file ? (
        <>
          <div className="relative overflow-hidden bg-black ring-1 ring-line">
            <video
              ref={videoRef}
              src={file.url}
              controls={!busy}
              playsInline
              muted
              preload="auto"
              className={mirror ? "w-full -scale-x-100" : "w-full"}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration || 0;
                setDuration(d);
                setRange({ start: 0, end: Math.min(d, 10) });
              }}
            />
          </div>
          <p className="truncate text-xs text-faint">{file.name}</p>
          {duration > 0 && (
            <>
              <Slider
                label="Track from"
                value={range.start}
                min={0}
                max={Math.max(0, duration - 0.5)}
                step={0.1}
                onChange={(v) => {
                  setRange((r) => ({ start: v, end: Math.min(duration, Math.max(v + 0.5, Math.min(r.end, v + MAX_VIDEO_SECONDS))) }));
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
                format={(v) => `${v.toFixed(1)}s`}
              />
              <Slider
                label="Track to"
                value={range.end}
                min={Math.min(duration, range.start + 0.5)}
                max={Math.min(duration, range.start + MAX_VIDEO_SECONDS)}
                step={0.1}
                onChange={(v) => {
                  setRange((r) => ({ ...r, end: v }));
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
                format={(v) => `${v.toFixed(1)}s`}
              />
              <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
                <span>
                  Mirror
                  <span className="block text-xs text-faint">For selfie videos, so your left is the rig's left</span>
                </span>
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
              </label>
            </>
          )}
          {busy && <Progress value={(progress ?? 0) * 100} label="Tracking" />}
          <div className="flex flex-wrap gap-2">
            {busy ? (
              <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            ) : (
              <>
                <Button variant="primary" icon={<Film className="h-4 w-4" />} onClick={track} disabled={!duration}>
                  Track {span.toFixed(1)}s
                </Button>
                <Button onClick={useFrame} disabled={!duration}>
                  Use this frame
                </Button>
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                  Other video
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-muted">
            Turn any clip of a person — a dance, a fight, a sport — into a rig take. Tracking runs on this device, frame by frame; the video is never uploaded.
          </p>
          <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
            Choose a video
          </Button>
          <p className="text-xs text-faint">One person, whole body in view, steady camera works best. Up to {MAX_VIDEO_SECONDS} seconds per take.</p>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice>{note}</Notice>}
    </>
  );
}
