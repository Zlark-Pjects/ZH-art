import type { ReactNode } from "react";
import { cx } from "./index";

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
