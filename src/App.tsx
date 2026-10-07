import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useStudio } from "./features/useStudio";
import { StoryboardView } from "./features/storyboard/StoryboardView";
import { LooksView } from "./features/looks/LooksView";
import { ProjectMenu } from "./features/ProjectMenu";
import { Button, cx } from "./ui";
import { Leader } from "./features/Leader";

const CharactersView = lazy(() => import("./features/forge/CharactersView").then((m) => ({ default: m.CharactersView })));
const RiggingMoCap = lazy(() => import("./components/RiggingMoCap"));
const ExportPanel = lazy(() => import("./features/export/ExportPanel").then((m) => ({ default: m.ExportPanel })));

const VIEWS = [
  { id: "storyboard", label: "Storyboard" },
  { id: "looks", label: "Looks" },
  { id: "characters", label: "Characters" },
  { id: "rig", label: "Motion" },
  { id: "export", label: "Export" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export default function App() {
  const studio = useStudio();
  const [view, setView] = useState<ViewId>("storyboard");
  // Views stay mounted after their first visit so renders and inputs survive tab switches
  const [visited, setVisited] = useState<Set<ViewId>>(() => new Set(["storyboard"]));
  const [guideOpen, setGuideOpen] = useState(false);

  const go = (id: ViewId) => {
    setView(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const panel = (id: ViewId, node: React.ReactNode) =>
    visited.has(id) && (
      <div key={id} hidden={view !== id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
        {node}
      </div>
    );

  return (
    <div className="min-h-screen bg-ink text-fg">
      <Leader />

      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 pt-4 sm:px-8">
          <a href="/" className="flex items-baseline gap-3" aria-label="ZH-art home">
            <span className="whitespace-nowrap font-display text-[28px] uppercase leading-none tracking-[0.01em]">
              ZH<span className="text-accent">—</span>ART
            </span>
            <span className="eyebrow hidden sm:inline">Generative film studio</span>
          </a>
          <div className="flex min-w-0 items-center gap-3">
            <ProjectMenu studio={studio} />
            <Button size="sm" variant="ghost" icon={<BookOpen className="h-4 w-4" />} onClick={() => setGuideOpen(true)}>
              Guide
            </Button>
          </div>
        </div>
        <nav aria-label="Studio" className="mx-auto max-w-[1680px] px-4 sm:px-8">
          <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VIEWS.map((v, i) => {
              const active = v.id === view;
              return (
                <button
                  key={v.id}
                  id={`tab-${v.id}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={`panel-${v.id}`}
                  onClick={() => go(v.id)}
                  className={cx(
                    "group relative flex shrink-0 items-baseline gap-2 py-4 text-[14px] transition-colors",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <span className={cx("font-mono text-[11px]", active ? "text-accent" : "text-faint")}>{String(i + 1).padStart(2, "0")}</span>
                  {v.label}
                  <span
                    aria-hidden
                    className={cx(
                      "absolute inset-x-0 bottom-0 h-[2px] origin-left bg-fg transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-hover:bg-line-strong",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 sm:px-8 sm:pt-8">
        <h1 className="sr-only">ZH-art — {VIEWS.find((v) => v.id === view)?.label}</h1>
        {panel("storyboard", <StoryboardView studio={studio} onNavigate={go} />)}
        {panel("looks", <LooksView studio={studio} onNavigate={go} />)}
        <Suspense fallback={<p className="eyebrow py-24 text-center">Loading…</p>}>
          {panel(
            "characters",
            <CharactersView
              characters={studio.project.characters}
              grade={studio.project.grade}
              onSaveCharacter={studio.upsertCharacter}
              onDeleteCharacter={studio.removeCharacter}
              onApplyGrade={studio.setGrade}
            />,
          )}
          {panel(
            "rig",
            <RiggingMoCap characters={studio.project.characters} clips={studio.project.clips} onSaveClip={studio.upsertClip} onDeleteClip={studio.removeClip} />,
          )}
          {panel("export", <ExportPanel studio={studio} />)}
        </Suspense>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-2 px-4 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:px-8">
          <span className="eyebrow">ZH-art · Runs entirely in your browser · No accounts, no API keys</span>
          <span className="eyebrow text-faint">Projects autosave to this browser. Save a project file to move it elsewhere.</span>
        </div>
      </footer>

      {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

function Guide({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = [
    ["Storyboard", "Write an idea and build, or open a sample film: the composer lays out scenes, colours, camera moves and a score. Then edit anything — words, palette, camera, shapes (drag them on the picture), particles, a backdrop photo, and cast."],
    ["Timeline", "Under the picture: drag scenes to reorder, drag their edges to trim, split at the playhead, and pick a transition between any two scenes. Add titles and captions on the text track. Add your own song on the music track; ZH-art finds its beat, so cuts snap to it, or press Cut on beat to line every cut up at once."],
    ["Looks", "A library of colour and atmosphere. Preview one on the current scene, then apply it to every scene at once."],
    ["Characters", "Forge whole characters from parts — bodies, heads, eyes, wings, tails, props — on two legs, four legs, wings, a serpent's coil or floating — or let the generator surprise you: pick an archetype, mutate, breed two designs, and lock what you like. Export any character as a game sprite sheet with idle, walk, run, jump and attack loops. The portrait studio handles faces and the film's colour grade."],
    ["Motion rig", "Pose a skeleton, layer a motion like a run or a float, record keyframes, or act it out on your webcam — motion capture runs on your device and the video never leaves the browser. Save the result as a clip to cast in any scene."],
    ["Export", "Record the finished film, with its transitions, text, song and score, to a video file — widescreen, vertical 9:16 or square."],
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl animate-rise overflow-y-auto border border-line bg-surface p-6 sm:p-10"
      >
        <div className="mb-8 flex items-start justify-between gap-6">
          <h2 id="guide-title" className="font-display text-5xl uppercase leading-[0.9]">
            How it works
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close guide" className="text-muted hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {items.map(([term, desc], i) => (
            <div key={term} className="grid gap-2 py-5 sm:grid-cols-[2.5rem_10rem_1fr]">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <dt className="text-[15px] font-medium">{term}</dt>
              <dd className="text-[14px] leading-relaxed text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-[14px] leading-relaxed text-muted">
          Everything runs in your browser. Projects save automatically here; use <span className="text-fg">Projects → Save project file</span> to back one up or move it to another computer.
        </p>
      </div>
    </div>
  );
}
