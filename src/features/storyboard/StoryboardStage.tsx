import { useId } from "react";
import type { Scene } from "../../types";
import { useAudioLevels } from "./useAudioLevels";
import { FRAME_H, FRAME_W, computeFrame, itemTransform, layerTransform } from "./sceneModel";

/** The live picture: an SVG render of the scene plus the title card. */
export function StoryboardStage({
  scene,
  elapsed,
  isPlaying,
  backdropUrl,
  thumbnail,
}: {
  scene: Scene;
  elapsed: number;
  isPlaying: boolean;
  backdropUrl?: string;
  /** Picture only, no title card (used by the filmstrip) */
  thumbnail?: boolean;
}) {
  const levels = useAudioLevels(isPlaying);
  const frame = computeFrame(scene, elapsed, levels);
  const uid = useId().replace(/:/g, "");

  return (
    <div className="@container absolute inset-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        role={thumbnail ? undefined : "img"}
        aria-hidden={thumbnail || undefined}
        aria-label={thumbnail ? undefined : scene.visualDescription}
      >
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            {frame.gradient.map((c, i) => (
              <stop key={i} offset={frame.gradient.length > 1 ? i / (frame.gradient.length - 1) : 0} stopColor={c} />
            ))}
          </linearGradient>
          <radialGradient id={`vig-${uid}`} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        <rect width={FRAME_W} height={FRAME_H} fill={`url(#bg-${uid})`} />
        {backdropUrl && (
          <image href={backdropUrl} width={FRAME_W} height={FRAME_H} preserveAspectRatio="xMidYMid slice" />
        )}

        {frame.layers.map((layer, li) => (
          <g key={li} transform={layerTransform(layer)}>
            {layer.items.map((item, ii) => (
              <path
                key={ii}
                d={item.d}
                transform={itemTransform(item)}
                opacity={item.opacity}
                fill={item.stroked ? "none" : item.color}
                stroke={item.stroked ? item.color : "none"}
                strokeWidth={item.stroked ? item.strokeWidth : 0}
                strokeLinecap="round"
              />
            ))}
          </g>
        ))}

        <g fill={frame.particleColor} opacity={frame.particleOpacity}>
          {frame.particles.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={pt.r} opacity={pt.alpha} />
          ))}
        </g>

        <rect width={FRAME_W} height={FRAME_H} fill={`url(#vig-${uid})`} />
      </svg>

      {/* Title card: the scene title slammed lower-left, narration as a subtitle */}
      {!thumbnail && <div
        key={scene.sceneNumber + scene.title}
        className="pointer-events-none absolute inset-x-0 bottom-[7%] bg-gradient-to-t from-black/75 via-black/35 to-transparent p-[4cqw] pb-[3.5cqw] pt-[8cqw]"
      >
        <p className="font-mono text-[max(10px,1.05cqw)] uppercase tracking-[0.14em] text-fg/70">
          Scene {String(scene.sceneNumber).padStart(2, "0")}
        </p>
        <h3 className="animate-rise mt-[0.6cqw] max-w-[85%] font-display text-[clamp(1.1rem,7.2cqw,7rem)] uppercase leading-[0.86] tracking-[-0.005em] text-fg">
          {scene.title}
        </h3>
        <p
          className="animate-rise mt-[1.2cqw] hidden max-w-[62ch] font-serif @[30rem]:block text-[clamp(0.95rem,2cqw,1.75rem)] italic leading-snug text-fg/85 [animation-delay:120ms]"
        >
          {scene.narration}
        </p>
      </div>}
    </div>
  );
}
