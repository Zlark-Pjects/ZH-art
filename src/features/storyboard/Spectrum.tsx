import { useAudioLevels } from "./useAudioLevels";

/** 16-band meter. Monochrome bars; only the peak caps carry the accent. */
export function Spectrum({ active }: { active: boolean }) {
  const { bars, peaks } = useAudioLevels(active);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Mix</span>
        <span className="eyebrow flex items-center gap-1.5">
          <span className={active ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-faint"} aria-hidden />
          {active ? "Live" : "Standby"}
        </span>
      </div>
      <div className="flex h-16 items-end gap-[3px]" aria-hidden>
        {bars.map((v, i) => (
          <div key={i} className="relative h-full flex-1">
            <div
              className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-fg/80"
              style={{ transform: `scaleY(${Math.max(0.04, v)})`, opacity: active ? 0.35 + v * 0.65 : 0.15 }}
            />
            {active && (
              <div
                className="absolute inset-x-0 h-[2px] bg-accent"
                style={{ bottom: `${Math.min(97, Math.max(4, peaks[i] * 100))}%` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
