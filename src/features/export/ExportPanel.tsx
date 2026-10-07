import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Square, Video } from "lucide-react";
import type { Storyboard } from "../../types";
import { Button, Field, Notice, Progress, Section, Segmented, downloadUrl } from "../../ui";
import { recordStoryboard, supportedRecordingType, type DrawExtras } from "./recordStoryboard";

const RESOLUTIONS = {
  "720p": { width: 1280, height: 720, label: "720p" },
  "1080p": { width: 1920, height: 1080, label: "1080p" },
  vertical: { width: 1080, height: 1920, label: "9:16" },
  square: { width: 1080, height: 1080, label: "1:1" },
} as const;
type ResolutionKey = keyof typeof RESOLUTIONS;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportPanel({
  storyboard,
  backdrops,
  bpm,
  scale,
  stopPlayback,
  extras,
}: {
  storyboard: Storyboard;
  backdrops: Record<number, string>;
  bpm: number;
  scale: string;
  stopPlayback: () => void;
  extras: DrawExtras;
}) {
  const format = useMemo(supportedRecordingType, []);
  const [resolution, setResolution] = useState<ResolutionKey>("1080p");
  const [fps, setFps] = useState<"24" | "30" | "60">("30");
  const [bitrate, setBitrate] = useState(8);
  const [withAudio, setWithAudio] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; size: number; name: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const duration = storyboard.scenes.reduce((sum, s) => sum + s.duration, 0);
  const estimate = ((duration * bitrate) / 8) * 1024 * 1024;

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    return () => URL.revokeObjectURL(result.url);
  }, [result]);

  const start = async () => {
    if (!canvasRef.current) return;
    stopPlayback();
    setError("");
    setResult(null);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { width, height } = RESOLUTIONS[resolution];
      const out = await recordStoryboard(
        storyboard,
        canvasRef.current,
        { width, height, fps: Number(fps), bitrateMbps: bitrate, withAudio, bpm, scale, backdrops, ...extras },
        setProgress,
        controller.signal,
      );
      const slug = storyboard.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "storyboard";
      setResult({
        url: URL.createObjectURL(out.blob),
        size: out.blob.size,
        name: `${slug}-${RESOLUTIONS[resolution].label}-${fps}fps.${out.extension}`,
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err?.message || "Recording failed.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const recording = progress !== null;
  const { width, height } = RESOLUTIONS[resolution];

  return (
    <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="relative flex items-center justify-center overflow-hidden bg-black ring-1 ring-line" style={{ aspectRatio: "16 / 9" }}>
          <canvas
            ref={canvasRef}
            className={recording ? "max-h-full max-w-full" : "hidden"}
            style={{ aspectRatio: `${width} / ${height}` }}
            aria-label="Recording preview"
          />
          {!recording && result && (
            <video src={result.url} controls playsInline className="h-full w-full object-contain" />
          )}
          {!recording && !result && (
            <div className="flex h-full w-full flex-col justify-end p-[8%]">
              <p className="font-display text-[clamp(2.5rem,6vw,5.5rem)] uppercase leading-[0.88]">Print it</p>
              <p className="mt-4 max-w-md font-serif text-xl italic text-muted">
                Records the storyboard and its score to a video file, right here in the browser. It plays in real time: {duration.toFixed(0)} seconds.
              </p>
            </div>
          )}
          {recording && (
            <span className="eyebrow absolute left-4 top-4 flex items-center gap-2 text-fg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden /> Recording
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 xl:mt-0">
        {!format && (
          <div className="mb-6">
            <Notice tone="error">This browser can't record video. Use a recent Chrome, Edge, Firefox or Safari.</Notice>
          </div>
        )}
        <Section index="01" title="Picture" aside={format?.label}>
          <div className="flex flex-col gap-5">
            <Segmented
              label="Size"
              value={resolution}
              onChange={setResolution}
              options={(Object.keys(RESOLUTIONS) as ResolutionKey[]).map((k) => ({ value: k, label: RESOLUTIONS[k].label }))}
            />
            <Segmented label="Frame rate" value={fps} onChange={setFps} options={[{ value: "24", label: "24 fps" }, { value: "30", label: "30 fps" }, { value: "60", label: "60 fps" }]} />
            <Field label="Bitrate" hint={`${bitrate} Mbps · about ${formatBytes(estimate)}`} htmlFor="export-bitrate">
              <input id="export-bitrate" type="range" min={2} max={20} value={bitrate} onChange={(e) => setBitrate(Number(e.target.value))} className="mt-2 w-full" />
            </Field>
          </div>
        </Section>
        <Section index="02" title="Sound">
          <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
            Include the score
            <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          </label>
        </Section>
        <div className="flex flex-col gap-4 border-t border-line pt-6 pb-8">
          {recording && <Progress value={(progress ?? 0) * 100} label="Recording" />}
          {error && <Notice tone="error">{error}</Notice>}
          {recording ? (
            <Button variant="danger" className="w-full" icon={<Square className="h-4 w-4" />} onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="w-full" icon={<Video className="h-5 w-5" />} disabled={!format} onClick={start}>
              {result ? "Record again" : "Record video"}
            </Button>
          )}
          {result && !recording && (
            <Button icon={<Download className="h-4 w-4" />} onClick={() => downloadUrl(result.url, result.name)}>
              Download · {formatBytes(result.size)}
            </Button>
          )}
          <p className="text-xs leading-relaxed text-faint">Keep this tab in front while recording; browsers slow down background tabs.</p>
        </div>
      </div>
    </div>
  );
}
