import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Studio } from "../useStudio";
import { LOOKS, searchLooks, type Look } from "../../project/looks";
import { applyPalette } from "../../project/builder";
import { MUSIC_PRESETS, VISUAL_PRESETS } from "../../lib/presets";
import { Button, Chip, Notice, Section, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate } from "../../ui/FilmGate";
import { StoryboardStage } from "../storyboard/StoryboardStage";
import { GradePanel } from "./GradePanel";

/** Offline look library: preview a palette on the current scene, then apply it to the whole project. */
export function LooksView({ studio, onNavigate }: { studio: Studio; onNavigate: (view: "storyboard") => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(LOOKS[0].id);
  const [applied, setApplied] = useState<string | null>(null);
  const results = useMemo(() => searchLooks(query), [query]);
  const look = LOOKS.find((l) => l.id === selectedId) ?? LOOKS[0];

  const { board, playback, project } = studio;
  const scene = board.scenes[playback.sceneIndex];
  // Non-destructive preview: recolour just the current scene
  const preview = useMemo(
    () => (scene ? applyPalette({ ...board, scenes: [scene] }, look.palette, look.style).scenes[0] : null),
    [board, scene, look],
  );

  const apply = (l: Look) => {
    studio.setBoard({ ...applyPalette(board, l.palette, l.style), musicVibe: l.mood });
    studio.setStyle(l.style);
    setApplied(l.id);
  };

  const stage = (
    <FilmGate slate={`Preview · ${look.name}`} meta={`Scene ${playback.sceneIndex + 1}`}>
      {preview && (
        <StoryboardStage
          scene={preview}
          elapsed={preview.duration * 0.5}
          isPlaying={false}
          backdropUrl={studio.backdrops[playback.sceneIndex]}
          characters={project.characters}
          clips={project.clips}
          grade={project.grade}
        />
      )}
    </FilmGate>
  );

  const below = (
    <div className="flex flex-col gap-10">
      <div className="flex h-24 overflow-hidden ring-1 ring-line" aria-label="Palette">
        {[...look.palette.bg, look.palette.accent, look.palette.element].map((c, i) => (
          <div key={i} className="relative flex-1" style={{ background: c }}>
            <span className="absolute bottom-2 left-2 font-mono text-[11px] uppercase text-white mix-blend-difference">{c}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] uppercase leading-[0.9]">{look.name}</h2>
          <p className="mt-4 max-w-[60ch] font-serif text-xl italic leading-snug text-fg/80">{look.description}</p>
          <p className="eyebrow mt-5">
            {VISUAL_PRESETS.find((v) => v.id === look.style)?.name} · {MUSIC_PRESETS.find((m) => m.id === look.mood)?.name} score · {look.palette.particle?.replace("-", " ")}
          </p>
        </div>
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="eyebrow text-fg">Motifs</h3>
            <span className="eyebrow">Add to your idea</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {look.motifs.map((m) => (
              <Chip key={m} onClick={() => studio.setPrompt(studio.project.prompt ? `${studio.project.prompt}, ${m}` : m)}>
                + {m}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const rail = (
    <div>
      <Section index="01" title="Find a look" aside={`${LOOKS.length} looks`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <label htmlFor="look-q" className="sr-only">
            Search looks
          </label>
          <input id="look-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="night, ocean, warm, retro…" className={cx(inputClass, "pl-9")} />
        </div>
        <ul className="mt-4 flex flex-col">
          {results.map((l) => {
            const active = l.id === look.id;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(l.id);
                    setApplied(null);
                  }}
                  aria-pressed={active}
                  className={cx("flex w-full items-center gap-3 border-b border-line py-3 text-left transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}
                >
                  <span className="flex h-6 w-14 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-fg/15" aria-hidden>
                    {[l.palette.bg[0], l.palette.bg[2], l.palette.accent, l.palette.element].map((c, i) => (
                      <span key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{l.name}</span>
                  {applied === l.id && <Check className="h-4 w-4 text-accent" aria-label="Applied" />}
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="py-6 font-serif text-lg italic text-muted">No look matches “{query}”.</li>}
        </ul>
      </Section>
      <div className="flex flex-col gap-3 border-t border-line pt-6 pb-8">
        <Button variant="primary" size="lg" className="w-full" onClick={() => apply(look)}>
          Apply to project
        </Button>
        {applied === look.id && (
          <Notice>
            Recoloured all {board.scenes.length} scenes and set the score to {look.mood}.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => onNavigate("storyboard")}>
              Back to the storyboard
            </button>
          </Notice>
        )}
        <p className="text-xs leading-relaxed text-faint">Keeps your shapes, words, timing and cast; changes colour, particles and score.</p>
      </div>
      <GradePanel studio={studio} />
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} below={below} />;
}
