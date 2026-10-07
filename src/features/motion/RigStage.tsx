import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { CharacterLook } from "../../types";
import { INITIAL_JOINTS, RIG_FLOOR, type Pose } from "../../project/rig";
import { buildFigure } from "../../project/forge/figure";
import { FigureOps } from "../forge/FigureSvg";

const BONES = INITIAL_JOINTS.filter((j) => j.parent).map((j) => [j.parent!, j.id] as const);
const COLORS = Object.fromEntries(INITIAL_JOINTS.map((j) => [j.id, j.color]));
const NAMES = Object.fromEntries(INITIAL_JOINTS.map((j) => [j.id, j.name]));

// 16:9 window onto the 400 x 500 rig space, with room for wings and props
export const RIG_VIEW = { x: -333, y: -40, w: 1067, h: 600 };

function Skeleton({ pose, color, opacity, width = 2 }: { pose: Pose; color: string; opacity: number; width?: number }) {
  return (
    <g opacity={opacity} pointerEvents="none">
      {BONES.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={pose[a].x} y1={pose[a].y} x2={pose[b].x} y2={pose[b].y} stroke={color} strokeWidth={width} strokeLinecap="round" />
      ))}
    </g>
  );
}

/**
 * The posing stage: the character drawn on its skeleton, with draggable
 * joints, onion-skin ghosts of the neighbouring keys and a floor line.
 */
export function RigStage({
  pose,
  look,
  time,
  showFigure,
  editable,
  ghosts,
  activeJoint,
  onPick,
  onDrag,
  onDrop,
}: {
  pose: Pose;
  look: CharacterLook;
  time: number;
  showFigure: boolean;
  editable: boolean;
  ghosts: { pose: Pose; tone: "before" | "after" }[];
  activeJoint: string | null;
  onPick: (id: string | null) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onDrop: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);

  const toRig = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.max(RIG_VIEW.x + 10, Math.min(RIG_VIEW.x + RIG_VIEW.w - 10, p.x)), y: Math.max(-10, Math.min(RIG_VIEW.y + RIG_VIEW.h - 45, p.y)) };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${RIG_VIEW.x} ${RIG_VIEW.y} ${RIG_VIEW.w} ${RIG_VIEW.h}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full touch-none select-none"
      role="img"
      aria-label={`${look.name} on the motion rig`}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const p = toRig(e);
        if (p) onDrag(dragging.current, p.x, p.y);
      }}
      onPointerUp={() => {
        if (dragging.current) onDrop();
        dragging.current = null;
      }}
      onPointerCancel={() => (dragging.current = null)}
      onPointerDown={() => editable && onPick(null)}
    >
      <defs>
        <radialGradient id="rig-floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <pattern id="rig-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.035" />
        </pattern>
      </defs>
      <rect x={RIG_VIEW.x} y={RIG_VIEW.y} width={RIG_VIEW.w} height={RIG_VIEW.h} fill="#0d0d10" />
      <rect x={RIG_VIEW.x} y={RIG_VIEW.y} width={RIG_VIEW.w} height={RIG_VIEW.h} fill="url(#rig-grid)" />
      <ellipse cx={200} cy={RIG_FLOOR + 2} rx={260} ry={18} fill="url(#rig-floor)" />
      <line x1={RIG_VIEW.x} x2={RIG_VIEW.x + RIG_VIEW.w} y1={RIG_FLOOR} y2={RIG_FLOOR} stroke="#ffffff" strokeOpacity="0.08" />

      {ghosts.map((g, i) => (
        <Skeleton key={i} pose={g.pose} color={g.tone === "before" ? "#5b8cff" : "#3fbf98"} opacity={0.6} width={5} />
      ))}

      {showFigure && <FigureOps ops={buildFigure(pose, look, time)} />}

      <Skeleton pose={pose} color="#ffb224" opacity={showFigure ? 0.55 : 0.9} width={showFigure ? 1.5 : 3} />
      {INITIAL_JOINTS.map((j) => {
        const p = pose[j.id];
        if (!p) return null;
        const active = activeJoint === j.id;
        return (
          <g key={j.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={active ? 9 : 6.5}
              fill={active ? COLORS[j.id] : "#0f0f12"}
              stroke={COLORS[j.id]}
              strokeWidth={2.5}
              opacity={editable ? 1 : 0.5}
              pointerEvents="none"
            />
            {editable && (
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                style={{ cursor: "grab" }}
                aria-label={NAMES[j.id]}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  svgRef.current?.setPointerCapture?.(e.pointerId);
                  dragging.current = j.id;
                  onPick(j.id);
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
