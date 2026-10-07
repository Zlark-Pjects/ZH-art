import { useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { CharacterLook, Grade, RigClip, Scene } from "../../types";
import { useAudioLevels } from "./useAudioLevels";
import { FigureOps } from "../forge/FigureSvg";
import { FRAME_H, FRAME_W, castFigures, computeFrame, gradeFilter, itemTransform, layerTransform } from "./sceneModel";

export type StageSelection = { kind: "element"; index: number } | { kind: "cast"; index: number } | null;

/**
 * The live picture: an SVG render of the scene, cast characters, colour grade
 * and the title card. In layout mode (paused editing) the camera holds still
 * and shapes and characters can be dragged directly on the picture.
 */
export function StoryboardStage({
  scene,
  elapsed,
  isPlaying,
  backdropUrl,
  thumbnail,
  characters = [],
  clips = [],
  grade,
  layout,
  selection,
  onSelect,
  onMove,
  titleCard = true,
}: {
  scene: Scene;
  elapsed: number;
  isPlaying: boolean;
  backdropUrl?: string;
  /** Picture only, no title card (used by the filmstrip) */
  thumbnail?: boolean;
  characters?: CharacterLook[];
  clips?: RigClip[];
  grade?: Grade;
  /** Hold the camera still and enable direct manipulation */
  layout?: boolean;
  selection?: StageSelection;
  onSelect?: (sel: StageSelection) => void;
  onMove?: (sel: NonNullable<StageSelection>, x: number, y: number) => void;
  /** Show the scene title and narration card */
  titleCard?: boolean;
}) {
  const levels = useAudioLevels(isPlaying && !thumbnail);
  const frame = computeFrame(scene, elapsed, levels);
  const figures = castFigures(scene, elapsed, characters, clips);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<NonNullable<StageSelection> | null>(null);

  // In layout mode the camera is neutral so shapes sit exactly where they're dragged
  const layers = layout ? frame.layers.map((l) => ({ ...l, zoom: 1, dx: 0, dy: 0 })) : frame.layers;

  const toPercent = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.max(0, Math.min(100, (p.x / FRAME_W) * 100)), y: Math.max(0, Math.min(100, (p.y / FRAME_H) * 100)) };
  };

  const startDrag = (sel: NonNullable<StageSelection>) => (e: ReactPointerEvent) => {
    if (!layout) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    dragRef.current = sel;
    onSelect?.(sel);
  };

  const interactive = Boolean(layout && onSelect);
  const vignette = (grade?.vignette ?? 35) / 100;

  return (
    <div className="@container absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="xMidYMid slice"
        className={interactive ? "absolute inset-0 h-full w-full touch-none" : "absolute inset-0 h-full w-full"}
        style={grade ? { filter: gradeFilter(grade) } : undefined}
        role={thumbnail ? undefined : "img"}
        aria-hidden={thumbnail || undefined}
        aria-label={thumbnail ? undefined : scene.visualDescription || scene.title}
        onPointerMove={(e) => {
          if (!dragRef.current || !onMove) return;
          const p = toPercent(e);
          if (p) onMove(dragRef.current, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
        onPointerDown={() => interactive && onSelect?.(null)}
      >
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            {frame.gradient.map((c, i) => (
              <stop key={i} offset={frame.gradient.length > 1 ? i / (frame.gradient.length - 1) : 0} stopColor={c} />
            ))}
          </linearGradient>
          <radialGradient id={`vig-${uid}`} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity={Math.min(1, vignette * 1.6)} />
          </radialGradient>
        </defs>

        <rect width={FRAME_W} height={FRAME_H} fill={`url(#bg-${uid})`} />
        {backdropUrl && <image href={backdropUrl} width={FRAME_W} height={FRAME_H} preserveAspectRatio="xMidYMid slice" />}

        {layers.map((layer, li) => (
          <g key={li} transform={layerTransform(layer)}>
            {layer.items.map((item) => {
              const selected = interactive && selection?.kind === "element" && selection.index === item.index;
              return (
                <g key={item.index}>
                  <path
                    d={item.d}
                    transform={itemTransform(item)}
                    opacity={item.opacity}
                    fill={item.stroked ? "none" : item.color}
                    stroke={item.stroked ? item.color : "none"}
                    strokeWidth={item.stroked ? item.strokeWidth : 0}
                    strokeLinecap="round"
                    onPointerDown={interactive ? startDrag({ kind: "element", index: item.index }) : undefined}
                    style={interactive ? { cursor: "move" } : undefined}
                  />
                  {selected && (
                    <path
                      d={item.d}
                      transform={itemTransform(item)}
                      fill="none"
                      stroke="#ffb224"
                      strokeWidth={3 / item.scale}
                      strokeDasharray={`${8 / item.scale} ${6 / item.scale}`}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
            {/* Cast characters perform in the midground */}
            {li === 1 &&
              figures.map((f, fi) => {
                const selected = interactive && selection?.kind === "cast" && selection.index === fi;
                return (
                  <g
                    key={`cast-${fi}`}
                    transform={f.transform}
                    onPointerDown={interactive ? startDrag({ kind: "cast", index: fi }) : undefined}
                    style={interactive ? { cursor: "move" } : undefined}
                  >
                    {selected && <rect x={60} y={20} width={280} height={470} fill="none" stroke="#ffb224" strokeWidth={4} strokeDasharray="14 10" />}
                    {interactive && <rect x={110} y={40} width={180} height={440} fill="transparent" />}
                    <FigureOps ops={f.ops} />
                  </g>
                );
              })}
            {/* While laying out, show where moving characters travel */}
            {li === 1 &&
              interactive &&
              (scene.cast ?? []).map((m, ci) =>
                m.path && m.path.length > 1 ? (
                  <g key={`path-${ci}`} pointerEvents="none" opacity={selection?.kind === "cast" && selection.index === ci ? 1 : 0.5}>
                    <polyline
                      points={[...m.path].sort((a, b) => a.t - b.t).map((k) => `${(k.x / 100) * FRAME_W},${(k.y / 100) * FRAME_H}`).join(" ")}
                      fill="none"
                      stroke="#ffb224"
                      strokeWidth={4}
                      strokeDasharray="14 10"
                    />
                    {m.path.map((k, n) => (
                      <rect key={n} x={(k.x / 100) * FRAME_W - 9} y={(k.y / 100) * FRAME_H - 9} width={18} height={18} fill="#ffb224" transform={`rotate(45 ${(k.x / 100) * FRAME_W} ${(k.y / 100) * FRAME_H})`} />
                    ))}
                  </g>
                ) : null,
              )}
          </g>
        ))}

        <g fill={frame.particleColor} opacity={frame.particleOpacity} pointerEvents="none">
          {frame.particles.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={pt.r} opacity={pt.alpha} />
          ))}
        </g>

        {grade && grade.tintAmount > 0 && (
          <rect width={FRAME_W} height={FRAME_H} fill={grade.tint} opacity={grade.tintAmount / 100} style={{ mixBlendMode: "soft-light" }} pointerEvents="none" />
        )}
        <rect width={FRAME_W} height={FRAME_H} fill={`url(#vig-${uid})`} pointerEvents="none" />
      </svg>

      {/* Title card: the scene title slammed lower-left, narration as a subtitle */}
      {!thumbnail && titleCard && (scene.title || scene.narration) && (
        <div
          key={scene.sceneNumber + scene.title}
          className="pointer-events-none absolute inset-x-0 bottom-[max(7%,1.75rem)] bg-gradient-to-t from-black/75 via-black/35 to-transparent p-[4cqw] pb-[3.5cqw] pt-[8cqw]"
        >
          <p className="font-mono text-[max(10px,1.05cqw)] uppercase tracking-[0.14em] text-fg/70">
            Scene {String(scene.sceneNumber).padStart(2, "0")}
          </p>
          <h3 className="animate-rise mt-[0.6cqw] max-w-[85%] font-display text-[clamp(1.1rem,7.2cqw,7rem)] uppercase leading-[0.86] tracking-[-0.005em] text-fg">
            {scene.title}
          </h3>
          {scene.narration && (
            <p className="animate-rise mt-[1.2cqw] hidden max-w-[62ch] font-serif text-[clamp(0.95rem,2cqw,1.75rem)] italic leading-snug text-fg/85 [animation-delay:120ms] @[30rem]:block">
              {scene.narration}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
