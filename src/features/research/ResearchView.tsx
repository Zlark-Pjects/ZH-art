import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { VisualResearchResult } from "../../types";
import type { Studio } from "../useStudio";
import { Button, Chip, Notice, Section, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate, GateEmpty } from "../../ui/FilmGate";

const SUGGESTIONS = ["Cyberpunk arcade at dusk", "Astronaut on a crescent moon", "Watercolor forest at night", "Glowing underwater city"];

function swatch(entry: string) {
  return {
    hex: entry.match(/#[0-9a-fA-F]{6}\b/)?.[0] ?? "#333333",
    name: entry.replace(/#[0-9a-fA-F]{6}\b/, "").replace(/[()]/g, "").trim() || entry,
  };
}

export function ResearchView({ studio, onNavigate }: { studio: Studio; onNavigate: (view: "storyboard") => void }) {
  const [query, setQuery] = useState(SUGGESTIONS[0]);
  const [result, setResult] = useState<VisualResearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [appended, setAppended] = useState<string | null>(null);

  const run = async (q = query) => {
    if (!q.trim()) {
      setError("Type something to research.");
      return;
    }
    setQuery(q);
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/research-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Research failed.");
      setResult(data);
      setRecent((prev) => [q, ...prev.filter((p) => p !== q)].slice(0, 5));
    } catch (err: any) {
      setError(err?.message || "Research failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const palette = result?.colorPalette.map(swatch) ?? [];

  const stage = (
    <FilmGate slate={result ? "Colour script" : "Research"} meta={result ? `${palette.length} colours` : isLoading ? "Searching" : "Standby"}>
      {result ? (
        <div className="relative flex h-full w-full">
          {palette.map((c, i) => (
            <div key={i} className="relative h-full flex-1" style={{ background: c.hex }}>
              <span className="absolute left-3 top-[calc(7%+12px)] font-mono text-[11px] uppercase text-white mix-blend-difference">
                {c.hex}
              </span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-[7%] bg-gradient-to-t from-black/90 via-black/60 to-transparent px-[5%] pb-[4%] pt-[12%]">
            <p className="font-display text-[clamp(2rem,6vw,5.5rem)] uppercase leading-[0.88] text-fg">{result.aestheticName}</p>
            <p className="mt-3 line-clamp-3 max-w-3xl font-serif text-[clamp(1rem,1.7vw,1.4rem)] italic leading-snug text-fg/80">
              {result.description}
            </p>
          </div>
        </div>
      ) : (
        <GateEmpty
          title={isLoading ? "Searching" : "Find a look"}
          line={isLoading ? "Reading what designers are making with this right now." : "Research a mood and get a palette, motifs and ready-to-use prompts."}
        />
      )}
    </FilmGate>
  );

  const below = result && (
    <div className="flex flex-col gap-12">
      {result.warning && <Notice tone="warn">{result.warning}</Notice>}

      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="eyebrow text-fg">Motifs</h2>
          <span className="eyebrow">Click to add to your storyboard prompt</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.keyConcepts.map((c) => (
            <Chip
              key={c}
              onClick={() => {
                studio.setPrompt(studio.prompt ? `${studio.prompt}, ${c}` : c);
                setAppended(c);
              }}
            >
              + {c}
            </Chip>
          ))}
        </div>
        {appended && <p className="mt-3 text-xs text-muted">Added “{appended}” to the storyboard prompt.</p>}
      </div>

      <div>
        <h2 className="eyebrow mb-4 text-fg">Prompts</h2>
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {result.prompts.map((p, i) => (
            <li key={i} className="grid gap-4 py-6 md:grid-cols-[2rem_1fr_auto]">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <p className="max-w-[70ch] font-serif text-xl italic leading-snug text-fg/90">{p}</p>
              <div className="flex gap-2 md:flex-col">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<ArrowUpRight className="h-4 w-4" />}
                  onClick={() => {
                    studio.setPrompt(p);
                    onNavigate("storyboard");
                  }}
                >
                  Storyboard it
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    studio.setHfPrompt(p);
                    onNavigate("storyboard");
                    setTimeout(() => document.getElementById("backdrop")?.scrollIntoView({ behavior: "smooth" }), 80);
                  }}
                >
                  Use as backdrop
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {result.sources && result.sources.length > 0 && (
        <p className="eyebrow leading-relaxed">Sources · {result.sources.join(" · ")}</p>
      )}
    </div>
  );

  const rail = (
    <div>
      <Section index="01" title="Research a look" aside="Web search">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <label htmlFor="research-q" className="sr-only">
            What do you want to research?
          </label>
          <input
            id="research-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Neon arcade in the rain"
            className={inputClass}
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoading} icon={<Search className="h-5 w-5" />}>
            {isLoading ? "Researching" : "Research"}
          </Button>
        </form>
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </Section>
      <Section index="02" title="Try">
        <ul className="flex flex-col">
          {[...recent, ...SUGGESTIONS.filter((s) => !recent.includes(s))].slice(0, 6).map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => run(s)}
                className={cx(
                  "flex w-full items-baseline justify-between gap-3 border-b border-line py-3 text-left text-[14px] transition-colors hover:text-fg",
                  s === query && result ? "text-fg" : "text-muted",
                )}
              >
                {s}
                {recent.includes(s) && <span className="eyebrow text-faint">Recent</span>}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} below={below} />;
}
