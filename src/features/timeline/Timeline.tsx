import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Blend, Copy, Magnet, Music2, Pause, Play, Plus, Scissors, SplitSquareHorizontal, Trash2, Type, Zap, ZoomIn, ZoomOut, PanelLeftOpen, Film } from "lucide-react";
import type { TransitionKind } from "../../types";
import type { Studio } from "../useStudio";
import { blankScene } from "../../project/builder";
import { cx } from "../../ui";
import { StoryboardStage } from "../storyboard/StoryboardStage";
import { MIN_SCENE_SECONDS, TRANSITIONS, beatGrid, cutsOnBeats, newTextClip, sceneStarts, snapToBeat } from "./timeline";
import { useSongUpload } from "./useSongUpload";

const TRANSITION_ICONS: Record<TransitionKind, typeof Blend> = {
  cut: Scissors,
  fade: Blend,
  wipe: PanelLeftOpen,
  zoom: ZoomIn,
  flash: Zap,
};

type Drag =
  | { kind: "scrub" }
  | { kind: "trim-scene"; index: number; x0: number; dur0: number; start: number }
  | { kind: "move-scene"; index: number; x0: number; moved: boolean }
  | { kind: "move-text"; id: string; x0: number; start0: number; dur: number }
  | { kind: "trim-text"; id: string; edge: "start" | "end"; x0: number; start0: number; dur0: number }
  | { kind: "slip-music"; x0: number; offset0: number };

const clock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

/**
 * The timeline: one place to arrange the film. Scenes, text and music sit on
 * tracks under a shared playhead. Drag to reorder and trim (mouse or pen),
 * tap to select; cuts can snap to the beat of the song or the score.
 */
export function Timeline({
  studio,
  selectedText,
  onSelectText,
  onEditScene,
}: {
  studio: Studio;
  selectedText: string | null;
  onSelectText: (id: string | null) => void;
  onEditScene: () => void;
}) {
  const { board, playback, project } = studio;
  const music = project.music ?? null;
  const texts = project.texts ?? [];
  const { starts, total } = sceneStarts(board.scenes);
  const beats = beatGrid(music, playback.bpm, total);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragX, setDragX] = useState(0);
  const [menu, setMenu] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const songUpload = useSongUpload(studio);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pps = Math.max(14, ((width - 40) / Math.max(1, total)) * zoom);
  const contentWidth = Math.max(width, total * pps + 40);
  const playheadX = playback.sequenceElapsed * pps;

  // Keep the playhead in view while playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playback.isPlaying) return;
    if (playheadX < el.scrollLeft || playheadX > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = Math.max(0, playheadX - 24);
  }, [playheadX, playback.isPlaying]);

  useEffect(() => {
    if (menu === null) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const timeAt = (clientX: number) => {
    const rect = contentRef.current?.getBoundingClientRect();
    return rect ? (clientX - rect.left) / pps : 0;
  };
  const snapT = (t: number) => (snap ? snapToBeat(t, beats, 10 / pps) : t);
  const round = (t: number) => Math.round(t * 100) / 100;

  /* ----- dragging ----- */
  const dragRef = useRef<Drag | null>(null);
  const pointerType = useRef("");
  const studioRef = useRef(studio);
  studioRef.current = studio;

  const begin = (d: Drag, e: ReactPointerEvent, touchOk = false) => {
    if (e.button !== 0) return;
    // Touch scrolls the timeline; only mouse and pen drag, except on handles
    if (e.pointerType === "touch" && !touchOk) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = d;
    setDrag(d);
    setDragX(e.clientX);
    if (d.kind === "scrub") studio.playback.seek(Math.max(0, timeAt(e.clientX)));
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const s = studioRef.current;
      setDragX(e.clientX);
      const dt = "x0" in d ? (e.clientX - d.x0) / pps : 0;
      if (d.kind === "scrub") s.playback.seek(Math.max(0, timeAt(e.clientX)));
      if (d.kind === "trim-scene") {
        const end = snapT(d.start + d.dur0 + dt);
        s.updateScene(d.index, { duration: round(Math.max(MIN_SCENE_SECONDS, end - d.start)) });
      }
      if (d.kind === "move-scene" && !d.moved && Math.abs(e.clientX - d.x0) > 5) {
        dragRef.current = { ...d, moved: true };
        setDrag(dragRef.current);
      }
      if (d.kind === "move-text") {
        const clip = (s.project.texts ?? []).find((t) => t.id === d.id);
        if (!clip) return;
        const start = Math.max(0, Math.min(total - d.dur, snapT(d.start0 + dt)));
        s.upsertText({ ...clip, start: round(start) });
      }
      if (d.kind === "trim-text") {
        const clip = (s.project.texts ?? []).find((t) => t.id === d.id);
        if (!clip) return;
        if (d.edge === "end") {
          const end = Math.min(total, snapT(d.start0 + d.dur0 + dt));
          s.upsertText({ ...clip, duration: round(Math.max(0.5, end - d.start0)) });
        } else {
          const start = Math.max(0, Math.min(d.start0 + d.dur0 - 0.5, snapT(d.start0 + dt)));
          s.upsertText({ ...clip, start: round(start), duration: round(d.start0 + d.dur0 - start) });
        }
      }
      if (d.kind === "slip-music" && s.project.music) {
        const max = Math.max(0, s.project.music.duration - 1);
        s.patchMusic({ offset: round(Math.max(0, Math.min(max, d.offset0 - dt))) });
      }
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d?.kind === "move-scene") {
        const s = studioRef.current;
        if (!d.moved) {
          if (s.playback.sceneIndex === d.index) onEditScene();
          else s.playback.setSceneIndex(d.index);
          return;
        }
        const to = targetIndex(d.index, timeAt(e.clientX));
        if (to !== d.index) {
          s.moveScene(d.index, to);
          s.playback.setSceneIndex(to);
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.kind, pps, snap, total]);

  /** Where a dragged scene would land if dropped at time `t`. */
  const targetIndex = (from: number, t: number) => {
    let to = 0;
    board.scenes.forEach((s, i) => {
      if (i !== from && starts[i] + s.duration / 2 < t) to++;
    });
    return to;
  };

  /* ----- actions ----- */
  const i = playback.sceneIndex;
  const scene = board.scenes[i];

  const split = () => {
    const local = playback.elapsed;
    if (!scene || local < MIN_SCENE_SECONDS || scene.duration - local < MIN_SCENE_SECONDS) {
      setNotice("Move the playhead at least a second inside a scene to split it.");
      return;
    }
    const first = round(local);
    studio.insertScene(i + 1, { ...scene, duration: round(scene.duration - first), transition: "cut" });
    studio.updateScene(i, { duration: first });
    playback.setSceneIndex(i + 1);
  };

  const addText = () => {
    const clip = newTextClip(playback.sequenceElapsed, total);
    studio.upsertText(clip);
    onSelectText(clip.id);
  };

  const cutToBeat = () => {
    studio.setDurations(cutsOnBeats(board.scenes, beats));
    setNotice(music ? `Cuts moved onto the song's beats (${music.bpm} bpm).` : `Cuts moved onto the score's beat (${playback.bpm} bpm).`);
  };

  const ticks = pps >= 60 ? 1 : pps >= 25 ? 2 : pps >= 10 ? 5 : 10;
  const beatPx = beats.length > 1 ? (beats[1] - beats[0]) * pps : 0;
  const draggingScene = drag?.kind === "move-scene" && drag.moved ? drag : null;
  const dropAt = draggingScene ? targetIndex(draggingScene.index, timeAt(dragX)) : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-2">
        <button
          type="button"
          onClick={playback.toggle}
          aria-label={playback.isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-ink transition-transform active:scale-95"
        >
          {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <span className="ml-2 mr-3 font-mono text-[12px] tabular-nums text-muted">
          <span className="text-fg">{clock(playback.sequenceElapsed)}</span> / {clock(total)}
        </span>
        <ToolButton label="Split at playhead" onClick={split} icon={<SplitSquareHorizontal className="h-4 w-4" />} />
        <ToolButton label="Duplicate scene" onClick={() => studio.insertScene(i + 1, { ...scene })} icon={<Copy className="h-4 w-4" />} />
        <ToolButton label="Delete scene" onClick={() => studio.removeScene(i)} disabled={board.scenes.length <= 1} icon={<Trash2 className="h-4 w-4" />} />
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <ToolButton label="Add text" text="Text" onClick={addText} icon={<Type className="h-4 w-4" />} />
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <ToolButton label={snap ? "Snapping to the beat is on" : "Snapping to the beat is off"} text="Snap" pressed={snap} onClick={() => setSnap((v) => !v)} icon={<Magnet className="h-4 w-4" />} />
        <ToolButton label="Move every cut onto the nearest beat" text="Cut on beat" onClick={cutToBeat} icon={<Music2 className="h-4 w-4" />} />
        {(notice || songUpload.error || studio.songError) && (
          <span role="status" className="ml-2 min-w-0 truncate text-xs text-muted">
            {songUpload.error || studio.songError || notice}
          </span>
        )}
        <span className="ml-auto flex items-center">
          <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} disabled={zoom <= 1} icon={<ZoomOut className="h-4 w-4" />} />
          <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} disabled={zoom >= 8} icon={<ZoomIn className="h-4 w-4" />} />
        </span>
      </div>
      <div className="flex border border-line bg-surface/40">
        {/* Track labels */}
        <div className="flex w-9 shrink-0 flex-col border-r border-line text-faint" aria-hidden>
          <div className="h-6 border-b border-line" />
          <div className="flex h-[68px] items-center justify-center"><Film className="h-3.5 w-3.5" /></div>
          <div className="flex h-9 items-center justify-center"><Type className="h-3.5 w-3.5" /></div>
          <div className="flex h-11 items-center justify-center"><Music2 className="h-3.5 w-3.5" /></div>
        </div>

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
          <div ref={contentRef} className="relative select-none" style={{ width: contentWidth }}>
            {/* Ruler */}
            <div
              className="relative h-6 cursor-ew-resize touch-none border-b border-line"
              onPointerDown={(e) => begin({ kind: "scrub" }, e, true)}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={Math.round(total * 10) / 10}
              aria-valuenow={Math.round(playback.sequenceElapsed * 10) / 10}
              aria-valuetext={clock(playback.sequenceElapsed)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") playback.seek(Math.min(total, playback.sequenceElapsed + (e.shiftKey ? 1 : 0.1)));
                if (e.key === "ArrowLeft") playback.seek(Math.max(0, playback.sequenceElapsed - (e.shiftKey ? 1 : 0.1)));
                if (e.key === " ") {
                  e.preventDefault();
                  playback.toggle();
                }
              }}
            >
              {beatPx >= 5 &&
                beats.map((b, k) => <span key={`b${k}`} className="absolute bottom-0 h-1.5 w-px bg-accent/50" style={{ left: b * pps }} />)}
              {Array.from({ length: Math.floor(total / ticks) + 1 }, (_, k) => k * ticks).map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-line-strong pl-1 font-mono text-[10px] leading-6 text-faint" style={{ left: t * pps }}>
                  {t}s
                </span>
              ))}
            </div>

            {/* Scenes */}
            <div className="relative h-[68px]">
              {board.scenes.map((s, k) => {
                const active = k === i;
                const dragged = draggingScene?.index === k;
                return (
                  <div
                    key={`${s.sceneNumber}-${k}`}
                    className={cx("group absolute top-3 bottom-1.5 px-px", dragged && "z-20 opacity-80")}
                    style={{ left: starts[k] * pps, width: s.duration * pps, transform: dragged ? `translateX(${dragX - draggingScene.x0}px)` : undefined }}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        pointerType.current = e.pointerType;
                        begin({ kind: "move-scene", index: k, x0: e.clientX, moved: false }, e);
                      }}
                      onClick={() => {
                        // Touch and keyboard select here; mouse and pen select on pointer up
                        const by = pointerType.current;
                        pointerType.current = "";
                        if (by === "mouse" || by === "pen") return;
                        if (active) onEditScene();
                        else playback.setSceneIndex(k);
                      }}
                      aria-label={`Scene ${k + 1}: ${s.title || "Untitled"}, ${s.duration.toFixed(1)} seconds${active ? ", selected" : ""}`}
                      aria-current={active ? "step" : undefined}
                      title="Drag to reorder · drag the right edge to trim"
                      className={cx(
                        "relative h-full w-full cursor-grab overflow-hidden rounded-[3px] text-left ring-1 active:cursor-grabbing",
                        active ? "ring-2 ring-accent" : "ring-line-strong hover:ring-fg/50",
                      )}
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-75">
                        <StoryboardStage
                          scene={s}
                          elapsed={s.duration * 0.6}
                          isPlaying={false}
                          backdropUrl={studio.backdrops[k]}
                          characters={project.characters}
                          clips={project.clips}
                          grade={project.grade}
                          thumbnail
                        />
                      </span>
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent pb-1 pl-2.5 pr-3.5 pt-3">
                        <span className="truncate text-[11px] font-medium text-fg">{s.title || "Untitled"}</span>
                        <span className="shrink-0 font-mono text-[10px] text-fg/80">{s.duration.toFixed(1)}s</span>
                      </span>
                    </button>
                    {/* Trim handle */}
                    <span
                      role="separator"
                      aria-label={`Trim scene ${k + 1}`}
                      onPointerDown={(e) => begin({ kind: "trim-scene", index: k, x0: e.clientX, dur0: s.duration, start: starts[k] }, e, true)}
                      className="absolute -right-1.5 top-0 bottom-0 z-20 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                    >
                      <span className="h-6 w-1 rounded-full bg-fg/70 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </div>
                );
              })}
              {dropAt !== null && draggingScene && (
                <span
                  className="absolute top-0 bottom-0 z-30 w-0.5 -translate-x-1/2 bg-accent"
                  style={{
                    left:
                      board.scenes
                        .filter((_, k) => k !== draggingScene.index)
                        .slice(0, dropAt)
                        .reduce((sum, sc) => sum + sc.duration, 0) * pps,
                  }}
                  aria-hidden
                />
              )}
              {/* Transition chips between scenes */}
              {board.scenes.slice(1).map((s, k) => {
                const index = k + 1;
                const Icon = TRANSITION_ICONS[s.transition ?? "cut"];
                return (
                  <div key={`tr${index}`} className="absolute top-3 z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: starts[index] * pps }}>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setMenu(menu === index ? null : index)}
                      aria-label={`Transition into scene ${index + 1}: ${TRANSITIONS.find((t) => t.id === (s.transition ?? "cut"))?.label}`}
                      aria-expanded={menu === index}
                      className={cx(
                        "flex h-5 w-5 rotate-45 items-center justify-center rounded-[3px] border bg-ink transition-colors",
                        s.transition && s.transition !== "cut" ? "border-accent text-accent" : "border-line-strong text-muted hover:text-fg",
                      )}
                    >
                      <Icon className="h-3 w-3 -rotate-45" />
                    </button>
                    {menu === index && (
                      <div
                        role="menu"
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute left-1/2 top-7 z-40 w-40 -translate-x-1/2 border border-line-strong bg-raised p-1 shadow-xl"
                      >
                        {TRANSITIONS.map((t) => {
                          const TIcon = TRANSITION_ICONS[t.id];
                          const on = (s.transition ?? "cut") === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={on}
                              title={t.hint}
                              onClick={() => {
                                studio.updateScene(index, { transition: t.id });
                                setMenu(null);
                                playback.seek(Math.max(0, starts[index] - 0.8));
                              }}
                              className={cx("flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-[13px]", on ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg")}
                            >
                              <TIcon className="h-3.5 w-3.5" /> {t.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  studio.insertScene(board.scenes.length, blankScene(board, board.scenes.length + 1));
                  playback.setSceneIndex(board.scenes.length);
                  onEditScene();
                }}
                aria-label="Add a scene at the end"
                title="Add a scene"
                className="absolute top-3 bottom-1.5 flex w-7 items-center justify-center rounded-[3px] border border-dashed border-line-strong text-muted hover:border-fg/50 hover:text-fg"
                style={{ left: total * pps + 6 }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Text */}
            <div className="relative h-9 border-t border-line">
              {texts.map((t) => {
                const on = t.id === selectedText;
                return (
                  <div key={t.id} className="absolute top-1 bottom-1" style={{ left: t.start * pps, width: Math.max(8, t.duration * pps) }}>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        onSelectText(t.id);
                        begin({ kind: "move-text", id: t.id, x0: e.clientX, start0: t.start, dur: t.duration }, e);
                      }}
                      onClick={() => onSelectText(t.id)}
                      aria-label={`Text: ${t.text}, from ${t.start.toFixed(1)} seconds for ${t.duration.toFixed(1)}`}
                      aria-pressed={on}
                      className={cx(
                        "h-full w-full cursor-grab truncate rounded-[3px] px-2 text-left text-[11px] font-medium active:cursor-grabbing",
                        on ? "bg-accent text-ink" : "bg-[#3a3550] text-fg hover:bg-[#4a4466]",
                      )}
                    >
                      {t.text || "Text"}
                    </button>
                    {(["start", "end"] as const).map((edge) => (
                      <span
                        key={edge}
                        role="separator"
                        aria-label={`Trim text ${edge}`}
                        onPointerDown={(e) => begin({ kind: "trim-text", id: t.id, edge, x0: e.clientX, start0: t.start, dur0: t.duration }, e, true)}
                        className={cx("absolute top-0 bottom-0 w-2.5 cursor-ew-resize touch-none", edge === "start" ? "-left-1" : "-right-1")}
                      />
                    ))}
                  </div>
                );
              })}
              {!texts.length && (
                <button type="button" onClick={addText} className="absolute inset-y-1 left-1 px-2 text-[11px] text-faint hover:text-fg">
                  + Add text at the playhead
                </button>
              )}
            </div>

            {/* Music */}
            <div className="relative h-11 border-t border-line">
              {music ? (
                <div
                  onPointerDown={(e) => begin({ kind: "slip-music", x0: e.clientX, offset0: music.offset }, e)}
                  className="absolute inset-y-1 left-0 cursor-grab overflow-hidden rounded-[3px] bg-[#16302a] active:cursor-grabbing"
                  style={{ width: Math.min(total, music.duration - music.offset) * pps }}
                  title="Drag to choose which part of the song plays"
                >
                  <Waveform peaks={music.peaks} duration={music.duration} offset={music.offset} seconds={total} pps={pps} />
                  <span className="pointer-events-none absolute left-1.5 top-0.5 max-w-[80%] truncate text-[10px] font-medium text-[#8fe3c8]">
                    {music.name} · {music.bpm} bpm{music.offset > 0 ? ` · from ${music.offset.toFixed(1)}s` : ""}
                  </span>
                </div>
              ) : (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) songUpload.upload(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={songUpload.busy}
                    className="absolute inset-y-1 left-1 px-2 text-[11px] text-faint hover:text-fg disabled:opacity-60"
                  >
                    {songUpload.busy ? "Finding the beat…" : "+ Add a song (MP3, WAV, M4A) — cuts can snap to its beat"}
                  </button>
                </>
              )}
            </div>

            {/* Playhead */}
            <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-accent" style={{ left: playheadX }} aria-hidden>
              <span className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-b-[3px] bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  text,
  icon,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  text?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
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

/** The visible part of the song as a mirrored bar waveform. */
function Waveform({ peaks, duration, offset, seconds, pps }: { peaks: number[]; duration: number; offset: number; seconds: number; pps: number }) {
  const per = peaks.length / Math.max(0.001, duration);
  const first = Math.floor(offset * per);
  const last = Math.min(peaks.length, Math.ceil((offset + seconds) * per));
  const step = Math.max(1, Math.round(per / Math.max(1, pps / 3)));
  let d = "";
  for (let k = first; k < last; k += step) {
    const x = (k / per - offset) * pps;
    const h = Math.max(0.04, peaks[k]) * 15;
    d += `M${x.toFixed(1)} ${(18 - h).toFixed(1)}V${(18 + h).toFixed(1)}`;
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${Math.max(1, Math.min(seconds, duration - offset) * pps)} 36`} preserveAspectRatio="none" aria-hidden>
      <path d={d} stroke="#3fbf98" strokeWidth={Math.max(1, (step / per) * pps * 0.6)} opacity={0.75} />
    </svg>
  );
}
