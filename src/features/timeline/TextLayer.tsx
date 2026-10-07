import type { TextClip } from "../../types";
import { cx } from "../../ui";
import { TEXT_SIZES, TEXT_Y, textsAt } from "./timeline";

const FONT_CLASS: Record<TextClip["font"], string> = {
  display: "font-display uppercase leading-[0.92] tracking-[0.005em]",
  serif: "font-serif italic leading-[1.05]",
  sans: "font-sans font-semibold leading-[1.1]",
};

/** Text-track clips over the live picture (a 16:9 container). */
export function TextLayer({ texts, time, selectedId }: { texts?: TextClip[]; time: number; selectedId?: string | null }) {
  const visible = textsAt(texts, time);
  if (!visible.length) return null;
  return (
    <div className="@container pointer-events-none absolute inset-0 overflow-hidden" aria-live="off">
      {visible.map(({ clip, state }) => {
        const shown = clip.text.slice(0, state.chars);
        const rest = clip.text.slice(state.chars);
        return (
          <div
            key={clip.id}
            className="absolute inset-x-0 flex justify-center px-[7%]"
            style={{
              top: `${(TEXT_Y[clip.position] + state.dy) * 100}%`,
              transform: `translateY(-50%) scale(${state.scale})`,
              opacity: state.opacity,
            }}
          >
            <p
              className={cx(
                "max-w-full whitespace-pre-wrap text-center text-fg",
                FONT_CLASS[clip.font],
                clip.box ? "rounded-[0.12em] bg-black/65 px-[0.5em] py-[0.2em]" : "[text-shadow:0_0.04em_0.25em_rgba(0,0,0,0.65)]",
                selectedId === clip.id && "outline outline-1 outline-offset-4 outline-accent/70",
              )}
              style={{ fontSize: `${TEXT_SIZES[clip.font][clip.size] * 56.25}cqw` }}
            >
              {shown}
              <span className="invisible">{rest}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
