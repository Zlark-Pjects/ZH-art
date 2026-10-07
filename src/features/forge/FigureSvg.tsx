import type { DrawOp } from "../../project/forge/figure";
import { tfAttr } from "../../project/forge/figure";

/** Render figure draw ops (rig space) as SVG. */
export function FigureOps({ ops }: { ops: DrawOp[] }) {
  return (
    <>
      {ops.map((op, i) =>
        op.t === "line" ? (
          <line key={i} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.color} strokeWidth={op.w} strokeLinecap="round" opacity={op.opacity} />
        ) : (
          <path
            key={i}
            d={op.d}
            fill={op.fill ?? "none"}
            stroke={op.stroke}
            strokeWidth={op.sw}
            strokeLinecap={op.stroke ? "round" : undefined}
            strokeLinejoin={op.stroke ? "round" : undefined}
            opacity={op.opacity}
            transform={tfAttr(op.tf)}
          />
        ),
      )}
    </>
  );
}
