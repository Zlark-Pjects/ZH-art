import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Dna, Lock, Redo2, RefreshCw, Shuffle, Sparkles, Undo2, Unlock } from "lucide-react";
import type { CharacterBuild, CharacterLook, CharacterPalette, MotionId, PartSlot, RigClip } from "../../types";
import { DEFAULT_CLIP, MOTION_PRESETS, poseAt } from "../../project/rig";
import { SLOTS, buildFigure, buildOf } from "../../project/forge/figure";
import { ARCHETYPES, breed, lookFromBuild, mutate, nameFor, newSeed, randomBuild, type LockKey } from "../../project/forge/generate";
import { newId } from "../../project/storage";
import { Button, ColorField, Field, IconButton, Notice, RailTabs, Section, Segmented, Slider, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate } from "../../ui/FilmGate";
import { FigureOps } from "./FigureSvg";

const PREVIEW_CLIPS: Record<MotionId, RigClip> = Object.fromEntries(
  MOTION_PRESETS.map((m) => [m.id, { ...DEFAULT_CLIP, id: `preview_${m.id}`, name: m.name, motion: m.id, intensity: m.id === "run" ? 0.8 : 1 }]),
) as Record<MotionId, RigClip>;

/** A character drawn in a fixed frame that fits wings, tails and props. */
function Figure({ look, t, motion, className }: { look: CharacterLook; t: number; motion: MotionId; className?: string }) {
  const ops = useMemo(() => buildFigure(poseAt(PREVIEW_CLIPS[motion], t), look, t), [look, t, motion]);
  return (
    <svg viewBox="-160 -110 720 640" className={className} aria-hidden>
      <ellipse cx={200} cy={478} rx={150} ry={16} fill="#000" opacity={0.35} />
      <FigureOps ops={ops} />
    </svg>
  );
}

const PALETTE_KEYS: { key: keyof CharacterPalette; label: string }[] = [
  { key: "primary", label: "Main" },
  { key: "secondary", label: "Second" },
  { key: "accent", label: "Accent" },
  { key: "glow", label: "Glow" },
  { key: "skin", label: "Skin" },
  { key: "hair", label: "Hair & fur" },
];

type Tab = "generate" | "parts" | "colours";

export function ForgeView({
  characters,
  onSave,
}: {
  characters: CharacterLook[];
  onSave: (c: CharacterLook) => void;
}) {
  const first = useMemo(() => randomBuild(newSeed(), "wild"), []);
  const [history, setHistory] = useState<CharacterBuild[]>([first]);
  const [index, setIndex] = useState(0);
  const build = history[index];
  const [lineup, setLineup] = useState<CharacterBuild[]>(() => Array.from({ length: 6 }, (_, i) => (i === 0 ? first : randomBuild(newSeed(), "wild"))));
  const [archetype, setArchetype] = useState("wild");
  const [locks, setLocks] = useState<Set<LockKey>>(new Set());
  const [tab, setTab] = useState<Tab>("generate");
  const [motion, setMotion] = useState<MotionId>("idle");
  const [name, setName] = useState(() => nameFor(first));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mate, setMate] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [t, setT] = useState(0);

  // Animate the main preview (paused for reduced motion)
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const startRef = useRef(performance.now());
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      setT((now - startRef.current) / 1000);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  /** Make a design current, keeping history so Back/Forward work. */
  const commit = (next: CharacterBuild, rename = true) => {
    setHistory((h) => [...h.slice(0, index + 1), next].slice(-40));
    setIndex((i) => Math.min(i + 1, 39));
    if (rename) setName(nameFor(next));
    setNotice("");
  };

  /** New candidates always start a fresh design; the saved character stays as it was. */
  const startFresh = (next: CharacterBuild) => {
    setEditingId(null);
    commit(next, true);
  };

  const generate = (make: (seed: number) => CharacterBuild) => {
    const batch = Array.from({ length: 6 }, () => make(newSeed()));
    setLineup(batch);
    startFresh(batch[0]);
  };

  const toggleLock = (key: LockKey) =>
    setLocks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const look = useMemo(() => lookFromBuild(build, editingId ?? "preview", name), [build, editingId, name]);
  const mateLook = characters.find((c) => c.id === mate);
  const editing = characters.find((c) => c.id === editingId);

  const save = (asNew: boolean) => {
    const id = !asNew && editing ? editing.id : newId("char");
    const finalName = name.trim() || nameFor(build);
    onSave(lookFromBuild(build, id, finalName));
    setEditingId(id);
    setName(finalName);
    setNotice(`Saved ${finalName}. Cast them in any scene from the Storyboard's Scene panel.`);
  };

  const LockButton = ({ k, label }: { k: LockKey; label: string }) => {
    const on = locks.has(k);
    return (
      <IconButton label={on ? `Unlock ${label}` : `Lock ${label}`} onClick={() => toggleLock(k)}>
        {on ? <Lock className="h-4 w-4 text-accent" /> : <Unlock className="h-4 w-4" />}
      </IconButton>
    );
  };

  const stage = (
    <>
    <FilmGate slate={name || "Unnamed"} meta={`${ARCHETYPES.find((a) => a.id === build.archetype)?.label ?? "Custom"} · seed ${build.seed}`}>
      <div className="relative h-full w-full bg-[radial-gradient(90%_80%_at_50%_45%,#1d1c22_0%,#08080a_70%)]">
        <Figure look={look} t={t} motion={motion} className="absolute inset-0 h-full w-full" />
      </div>
    </FilmGate>
      <div className="mt-3 flex justify-start overflow-x-auto sm:justify-center">
          <div role="radiogroup" aria-label="Preview motion" className="flex shrink-0 gap-1 rounded-full border border-line p-1">
            {MOTION_PRESETS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={motion === m.id}
                onClick={() => setMotion(m.id)}
                className={cx("whitespace-nowrap rounded-full px-3 py-1 text-[12px] transition-colors", motion === m.id ? "bg-fg text-ink" : "text-muted hover:text-fg")}
              >
                {m.name}
              </button>
            ))}
          </div>
      </div>
    </>
  );

  const below = (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="eyebrow text-fg">Line-up</h2>
        <div className="flex items-center gap-1">
          <span className="eyebrow mr-2">Pick one to keep working on it</span>
          <IconButton label="Back" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <Undo2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Forward" onClick={() => setIndex((i) => Math.min(history.length - 1, i + 1))} disabled={index >= history.length - 1}>
            <Redo2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {lineup.map((candidate, i) => {
          const current = candidate === build;
          const candidateLook = lookFromBuild(candidate, "lineup", nameFor(candidate));
          return (
            <li key={`${candidate.seed}-${i}`}>
              <button
                type="button"
                onClick={() => startFresh(candidate)}
                aria-pressed={current}
                className={cx("group block w-full rounded-[3px] bg-surface text-left ring-1 transition-shadow", current ? "ring-fg/70" : "ring-line hover:ring-line-strong")}
              >
                <Figure look={candidateLook} t={0} motion="idle" className="aspect-[9/8] w-full" />
                <p className={cx("truncate px-2 pb-2 text-[12px]", current ? "text-fg" : "text-muted group-hover:text-fg")}>{candidateLook.name}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const arch = ARCHETYPES.find((a) => a.id === archetype) ?? ARCHETYPES[0];

  const rail = (
    <div>
      <RailTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "generate", label: "Generate" },
          { value: "parts", label: "Parts" },
          { value: "colours", label: "Colours" },
        ]}
      />

      {tab === "generate" && (
        <div>
          <Section index="01" title="Kind" aside={arch.description}>
            <Segmented label="Archetype" value={archetype} onChange={setArchetype} columns={2} options={ARCHETYPES.map((a) => ({ value: a.id, label: a.label, hint: a.description }))} />
          </Section>
          <div className="flex flex-col gap-2 border-t border-line pt-6 pb-8">
            <Button variant="primary" size="lg" className="w-full" icon={<Sparkles className="h-5 w-5" />} onClick={() => generate((seed) => randomBuild(seed, archetype, build, locks))}>
              Surprise me
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button icon={<Shuffle className="h-4 w-4" />} onClick={() => generate((seed) => mutate(build, "small", seed, locks))}>
                Mutate a little
              </Button>
              <Button icon={<Dices className="h-4 w-4" />} onClick={() => generate((seed) => mutate(build, "wild", seed, locks))}>
                Mutate a lot
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Each makes six candidates below.{" "}
              {locks.size > 0 ? `Locked: ${[...locks].join(", ")} — those stay as they are.` : "Lock parts or colours in the other tabs to keep them while you reroll the rest."}
            </p>
          </div>
          <Section index="02" title="Breed" aside="Mix two designs">
            {characters.length === 0 ? (
              <p className="text-[13px] text-muted">Save a character first, then breed new designs with it.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Partner" htmlFor="forge-mate">
                  <select id="forge-mate" value={mate} onChange={(e) => setMate(e.target.value)} className={inputClass}>
                    <option value="">Choose a saved character</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button icon={<Dna className="h-4 w-4" />} disabled={!mateLook} onClick={() => mateLook && generate((seed) => breed(build, buildOf(mateLook), seed, locks, build))}>
                  Make six offspring
                </Button>
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "parts" && (
        <div>
          <Section index="01" title="Parts" aside="Lock to keep">
            <div className="flex flex-col gap-3">
              {SLOTS.map(({ slot, label, options }) => (
                <div key={slot} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2">
                  <label htmlFor={`part-${slot}`} className="eyebrow">
                    {label}
                  </label>
                  <select
                    id={`part-${slot}`}
                    value={build.parts[slot]}
                    onChange={(e) => commit({ ...build, parts: { ...build.parts, [slot]: e.target.value } as Record<PartSlot, string> }, false)}
                    className={inputClass}
                  >
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <LockButton k={slot} label={label} />
                </div>
              ))}
            </div>
          </Section>
          <Section index="02" title="Proportions" aside={<LockButton k="proportions" label="proportions" />}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(
                [
                  ["head", "Head", 0.6, 1.8],
                  ["shoulders", "Shoulders", 0.7, 1.5],
                  ["arms", "Arms", 0.6, 1.6],
                  ["legs", "Legs", 0.5, 1.6],
                  ["bulk", "Build", 0.6, 1.8],
                ] as const
              ).map(([key, label, min, max]) => (
                <Slider
                  key={key}
                  label={label}
                  value={build.proportions[key]}
                  min={min}
                  max={max}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => commit({ ...build, proportions: { ...build.proportions, [key]: v } }, false)}
                />
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "colours" && (
        <Section index="01" title="Colours" aside={<LockButton k="colours" label="colours" />}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {PALETTE_KEYS.map(({ key, label }) => (
                <ColorField key={key} label={label} value={build.palette[key]} onChange={(v) => commit({ ...build, palette: { ...build.palette, [key]: v } }, false)} />
              ))}
            </div>
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => commit({ ...build, palette: randomBuild(newSeed(), build.archetype).palette }, false)}
            >
              New colour scheme
            </Button>
          </div>
        </Section>
      )}

      <Section index="·" title={editing ? `Editing ${editing.name}` : "Keep this one"}>
        <div className="flex flex-col gap-3">
          <Field label="Name" htmlFor="forge-name" hint={<button type="button" className="underline underline-offset-4 hover:text-fg" onClick={() => setName(nameFor({ ...build, seed: newSeed() }))}>Another name</button>}>
            <input id="forge-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => save(!editing)}>
              {editing ? "Update" : "Save to project"}
            </Button>
            <Button onClick={() => save(true)}>Save as new</Button>
          </div>
          {notice && <Notice>{notice}</Notice>}
          {characters.length > 0 && (
            <div className="mt-2">
              <p className="eyebrow mb-2">In this project · click to edit</p>
              <ul className="flex flex-wrap gap-2">
                {characters.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setName(c.name);
                        commit(buildOf(c), false);
                      }}
                      aria-pressed={c.id === editingId}
                      className={cx("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-colors", c.id === editingId ? "border-fg/70 text-fg" : "border-line text-muted hover:text-fg")}
                    >
                      <span className="h-7 w-7 overflow-hidden rounded-full bg-surface ring-1 ring-fg/15">
                        <Figure look={c} t={0} motion="idle" className="h-full w-full scale-[2.2] translate-y-[38%]" />
                      </span>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
              {editing && (
                <button type="button" className="mt-3 text-[13px] text-muted underline underline-offset-4 hover:text-fg" onClick={() => { setEditingId(null); setName(nameFor(build)); }}>
                  Stop editing {editing.name}
                </button>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} below={below} />;
}
