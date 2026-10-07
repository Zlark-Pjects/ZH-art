import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button, cx, downloadUrl } from "./index";

/** SMPTE-style timecode at 24 fps: HH:MM:SS:FF */
export function timecode(seconds: number) {
  const total = Math.max(0, seconds);
  const frames = Math.floor((total % 1) * 24);
  const s = Math.floor(total) % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return [h, m, s, frames].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * The film gate: the picture framed by letterbox bars that carry viewfinder
 * metadata, crop marks and grain. Every preview in the app sits in one.
 */
export function FilmGate({
  slate,
  meta,
  time,
  progress,
  portrait,
  controls,
  children,
}: {
  slate?: ReactNode;
  meta?: ReactNode;
  time?: number;
  progress?: number;
  portrait?: boolean;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="relative w-full overflow-hidden bg-black ring-1 ring-line">
      <div className={cx("relative w-full", portrait ? "mx-auto aspect-[9/16] max-h-[78vh]" : "aspect-video")}>
        <div className="absolute inset-0">{children}</div>
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="crop-marks pointer-events-none absolute inset-[calc(7%+10px)_12px]" />
      </div>

      {/* Letterbox bars carry the viewfinder metadata */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[7%] min-h-7 items-center justify-between bg-black/85 px-3 sm:px-4">
        <span className="eyebrow truncate text-fg/70">{slate}</span>
        <span className="eyebrow shrink-0 text-fg/70">{meta}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[7%] min-h-7 items-center justify-between gap-3 bg-black/85 px-3 sm:px-4">
        {progress !== undefined && (
          <div className="absolute inset-x-0 top-0 h-px bg-fg/10">
            <div
              className="h-full origin-left bg-accent"
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
            />
          </div>
        )}
        <div className="flex items-center gap-1">{controls}</div>
        {time !== undefined && (
          <span className="font-mono text-[11px] tabular-nums tracking-[0.08em] text-fg/80">{timecode(time)}</span>
        )}
      </div>
    </figure>
  );
}

/** Empty gate: strong type and one instruction instead of an icon in a circle. */
export function GateEmpty({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-end bg-[radial-gradient(120%_90%_at_20%_10%,#1b1a17_0%,#08080a_60%)] p-[8%]">
      <p className="font-display text-[clamp(2.5rem,7vw,6.5rem)] uppercase leading-[0.88] tracking-[-0.01em] text-fg/90">
        {title}
      </p>
      <p className="mt-4 max-w-md font-serif text-lg italic leading-snug text-muted sm:text-xl">{line}</p>
    </div>
  );
}

/** Rendering gate: the progress number is the picture until the video arrives. */
export function GateRendering({ progress, line }: { progress: number; line: string }) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-end bg-[radial-gradient(120%_90%_at_80%_20%,#2a1d06_0%,#08080a_65%)] p-[8%]">
      <p className="font-display text-[clamp(4rem,14vw,11rem)] leading-[0.82] tabular-nums text-accent" aria-live="polite">
        {Math.round(progress)}
        <span className="text-fg/30">%</span>
      </p>
      <p className="mt-4 max-w-md font-serif text-lg italic leading-snug text-fg/70 sm:text-xl">{line}</p>
    </div>
  );
}

export function GateVideo({ url, filename, muted }: { url: string; filename: string; muted?: boolean }) {
  return (
    <div className="group relative h-full w-full bg-black">
      <video src={url} autoPlay loop controls muted={muted} playsInline className="h-full w-full object-contain" />
      <div className="absolute right-4 top-[calc(7%+12px)] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <Button size="sm" variant="primary" icon={<Download className="h-4 w-4" />} onClick={() => downloadUrl(url, filename)}>
          Download
        </Button>
      </div>
    </div>
  );
}
