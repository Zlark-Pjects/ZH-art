import { Plus, Trash2 } from "lucide-react";
import type { TextClip } from "../../types";
import type { Studio } from "../useStudio";
import { Button, Field, IconButton, Section, Segmented, Slider, cx, inputClass } from "../../ui";
import { newTextClip, sceneStarts } from "./timeline";

/** Rail panel for the text track: titles and captions over the film. */
export function TextPanel({ studio, selected, onSelect }: { studio: Studio; selected: string | null; onSelect: (id: string | null) => void }) {
  const texts = [...(studio.project.texts ?? [])].sort((a, b) => a.start - b.start);
  const clip = texts.find((t) => t.id === selected);
  const { total } = sceneStarts(studio.board.scenes);
  const titleCards = studio.project.titleCards ?? true;

  const add = () => {
    const c = newTextClip(studio.playback.sequenceElapsed, total);
    studio.upsertText(c);
    onSelect(c.id);
  };
  const set = (patch: Partial<TextClip>) => clip && studio.upsertText({ ...clip, ...patch });

  return (
    <div>
      <Section index="01" title="Text" aside={`${texts.length} on the timeline`}>
        <div className="flex flex-col gap-3">
          {texts.length > 0 && (
            <ul className="flex flex-col gap-1">
              {texts.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(t.id);
                      studio.playback.seek(t.start + Math.min(0.6, t.duration / 2));
                    }}
                    aria-pressed={t.id === selected}
                    className={cx(
                      "flex w-full items-baseline justify-between gap-3 rounded-[3px] border px-3 py-2 text-left text-[13px] transition-colors",
                      t.id === selected ? "border-fg/80 bg-fg/[0.06] text-fg" : "border-line text-muted hover:text-fg",
                    )}
                  >
                    <span className="truncate">{t.text || "Text"}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{t.start.toFixed(1)}s</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button icon={<Plus className="h-4 w-4" />} onClick={add}>
            Add text at the playhead
          </Button>
          <label className="mt-1 flex items-center justify-between gap-4 text-[14px] text-fg">
            <span>
              Scene title cards
              <span className="block text-xs text-faint">Each scene's title and narration, lower left</span>
            </span>
            <input type="checkbox" checked={titleCards} onChange={(e) => studio.setTitleCards(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          </label>
        </div>
      </Section>

      {clip && (
        <Section index="02" title="Edit text" aside={<IconButton label="Delete this text" onClick={() => { studio.removeText(clip.id); onSelect(null); }}><Trash2 className="h-4 w-4" /></IconButton>}>
          <div className="flex flex-col gap-5">
            <Field label="Words" htmlFor="tx-text">
              <textarea id="tx-text" value={clip.text} rows={2} onChange={(e) => set({ text: e.target.value })} className={cx(inputClass, "resize-none")} />
            </Field>
            <Segmented
              label="Animation"
              value={clip.animation}
              onChange={(animation) => {
                set({ animation });
                studio.playback.seek(clip.start);
              }}
              columns={4}
              options={[
                { value: "pop", label: "Pop" },
                { value: "slide", label: "Slide" },
                { value: "typewriter", label: "Type" },
                { value: "fade", label: "Fade" },
              ]}
            />
            <Segmented
              label="Font"
              value={clip.font}
              onChange={(font) => set({ font })}
              options={[
                { value: "display", label: "Bold" },
                { value: "serif", label: "Serif" },
                { value: "sans", label: "Clean" },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Segmented label="Size" value={clip.size} onChange={(size) => set({ size })} options={[{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }]} />
              <Segmented label="Place" value={clip.position} onChange={(position) => set({ position })} options={[{ value: "top", label: "Top" }, { value: "middle", label: "Mid" }, { value: "bottom", label: "Low" }]} />
            </div>
            <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
              Caption box behind the text
              <input type="checkbox" checked={clip.box} onChange={(e) => set({ box: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
            </label>
            <Slider label="Starts at" value={clip.start} min={0} max={Math.max(0, total - 0.5)} step={0.1} onChange={(v) => set({ start: v, duration: Math.min(clip.duration, total - v) })} format={(v) => `${v.toFixed(1)}s`} />
            <Slider label="Stays for" value={clip.duration} min={0.5} max={Math.max(0.5, total - clip.start)} step={0.1} onChange={(v) => set({ duration: v })} format={(v) => `${v.toFixed(1)}s`} />
          </div>
        </Section>
      )}
      {!clip && texts.length > 0 && <p className="pb-8 pt-2 text-xs text-faint">Pick a text above or on the timeline to edit it.</p>}
    </div>
  );
}
