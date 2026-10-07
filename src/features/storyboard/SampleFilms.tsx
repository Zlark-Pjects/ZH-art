import type { Studio } from "../useStudio";
import { SAMPLE_FILMS } from "../../project/samples";
import { Section } from "../../ui";

/** Hand-made films to start from (loaded on demand: the scene data is large). */
export function SampleFilms({ studio }: { studio: Studio }) {
  return (
    <Section index="04" title="Or start from a sample">
      <ul className="flex flex-col gap-1.5">
        {SAMPLE_FILMS.map((film) => (
          <li key={film.id}>
            <button
              type="button"
              onClick={() => studio.openSample(film)}
              className="w-full rounded-[3px] border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong"
            >
              <span className="block text-[14px] text-fg">{film.name}</span>
              <span className="mt-0.5 block truncate text-xs text-faint">{film.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">Replaces the scenes; Undo brings yours back.</p>
    </Section>
  );
}
