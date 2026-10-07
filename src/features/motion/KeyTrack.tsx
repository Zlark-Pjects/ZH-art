import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Diamond, Layers, Pause, Play, Trash2 } from "lucide-react";
import type { Easing } from "../../types";
import { cx } from "../../ui";

export interface EditorKey {
  id: string;
  time: number;
  easing: Easing;
}

/**
 * The keyframe track under the rig: a loop-length ruler with a diamond per
 * key. Click to move the playhead, click a diamond to edit that key, drag a
 * diamond to retime it (mouse or pen).
 */
export function KeyTrack({
  keys,
  length,
  time,
  playing,
  selected,
  onion,
  onToggle,
  onSeek,
  onSelect,
  onRetime,
  onAdd,
  onDelete,
  onOnion,
}: {
  keys: EditorKey[];
  length: number;
  time: number;
  playing: boolean;
  selected: string | null;
  onion: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSelect: (id: string | null) => void;
  onRetime: (id: string, t: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  onOnion: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const timeAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(length, ((clientX - r.left) / r.width) * length));
  };
  const snap = (t: number) => Math.round(t * 24) / 24; // whole frames at 24 fps

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const t = snap(timeAt(e.clientX));
      if (d.id) onRetime(d.id, t);
      else onSeek(t);
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, length]);

  const sorted = [...keys].sort((a, b) => a.time - b.time);
  const idx = sorted.findIndex((k) => k.id === selected);
  const prevKey = () => {
    const before = [...sorted].reverse().find((k) => k.time < time - 1e-3) ?? sorted[sorted.length - 1];
    if (before) onSelect(before.id);
  };
  const nextKey = () => {
    const after = sorted.find((k) => k.time > time + 1e-3) ?? sorted[0];
    if (after) onSelect(after.id);
  };
  const ticks = length <= 3 ? 0.25 : length <= 8 ? 1 : 2;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-ink transition-transform active:scale-95"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <span className="ml-2 mr-3 font-mono text-[12px] tabular-nums text-muted">
          <span className="text-fg">{time.toFixed(2)}s</span> / {length.toFixed(2)}s
        </span>
        <Tool label="Add a key at the playhead" text="Key" onClick={onAdd} icon={<Diamond className="h-4 w-4" />} />
        <Tool label="Previous key" onClick={prevKey} disabled={!keys.length} icon={<ChevronLeft className="h-4 w-4" />} />
        <Tool label="Next key" onClick={nextKey} disabled={!keys.length} icon={<ChevronRight className="h-4 w-4" />} />
        <Tool label="Delete the selected key" onClick={onDelete} disabled={!selected} icon={<Trash2 className="h-4 w-4" />} />
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <Tool label="Show ghosts of the keys either side" text="Onion skin" pressed={onion} onClick={onOnion} icon={<Layers className="h-4 w-4" />} />
        <span className="ml-auto text-xs text-faint">{keys.length ? `${keys.length} key${keys.length === 1 ? "" : "s"}${idx >= 0 ? ` · key ${idx + 1} selected` : ""}` : "No keys yet"}</span>
      </div>

      <div className="border border-line bg-surface/40 px-3">
        <div
          ref={trackRef}
          className="relative h-16 cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            onSelect(null);
            onSeek(snap(timeAt(e.clientX)));
            setDrag({ id: null });
          }}
          role="slider"
          aria-label="Rig playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(length * 100) / 100}
          aria-valuenow={Math.round(time * 100) / 100}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(Math.min(length, snap(time + 1 / 24)));
            if (e.key === "ArrowLeft") onSeek(Math.max(0, snap(time - 1 / 24)));
            if (e.key === " ") {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          {Array.from({ length: Math.floor(length / ticks) + 1 }, (_, k) => k * ticks).map((t) => (
            <span key={t} className="absolute top-0 h-full border-l border-line pl-1 font-mono text-[10px] leading-5 text-faint" style={{ left: `${(t / length) * 100}%` }}>
              {Number.isInteger(t) ? `${t}s` : ""}
            </span>
          ))}
          <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
          {sorted.map((k, n) => {
            const on = k.id === selected;
            return (
              <button
                key={k.id}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(k.id);
                  if (e.pointerType !== "touch") setDrag({ id: k.id });
                }}
                aria-label={`Key ${n + 1} at ${k.time.toFixed(2)} seconds, ${k.easing}`}
                aria-pressed={on}
                title={`Key ${n + 1} · ${k.time.toFixed(2)}s · ${k.easing}`}
                className={cx(
                  "absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border transition-colors",
                  on ? "border-accent bg-accent" : k.easing === "hold" ? "border-fg/70 bg-ink" : "border-fg/70 bg-fg/70 hover:bg-fg",
                )}
                style={{ left: `${(k.time / length) * 100}%` }}
              />
            );
          })}
          <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-accent" style={{ left: `${(time / length) * 100}%` }}>
            <span className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-b-[3px] bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tool({ label, text, icon, onClick, disabled, pressed }: { label: string; text?: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={text ? undefined : label}
      aria-pressed={pressed}
      title={label}
      className={cx(
        "flex h-8 items-center gap-1.5 rounded-[3px] px-2 text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-30",
        pressed ? "bg-accent/15 text-accent" : "text-muted hover:bg-fg/[0.06] hover:text-fg",
      )}
    >
      {icon}
      {text && <span>{text}</span>}
    </button>
  );
}
