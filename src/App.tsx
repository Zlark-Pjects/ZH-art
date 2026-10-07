import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useStudio } from "./features/useStudio";
import { StoryboardView } from "./features/storyboard/StoryboardView";
import { AnimateView, TextToVideoView } from "./features/video/VideoViews";
import { ResearchView } from "./features/research/ResearchView";
import { Button, cx } from "./ui";
import { Leader } from "./features/Leader";

const RiggingMoCap = lazy(() => import("./components/RiggingMoCap"));
const CreativeSuite = lazy(() => import("./components/CreativeSuite"));
const ProductivityStudio = lazy(() => import("./components/ProductivityStudio"));

const VIEWS = [
  { id: "storyboard", label: "Storyboard" },
  { id: "animate", label: "Image to video" },
  { id: "text", label: "Text to video" },
  { id: "research", label: "Research" },
  { id: "rig", label: "Motion rig" },
  { id: "creative", label: "Creative suite" },
  { id: "edit", label: "Edit & export" },
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

  const status = studio.serverStatus;

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
            <span className="font-display text-[28px] uppercase leading-none tracking-[0.01em]">
              ZH<span className="text-accent">—</span>ART
            </span>
            <span className="eyebrow hidden sm:inline">Generative film studio</span>
          </a>
          <div className="flex items-center gap-3">
            {status && (
              <span
                className="eyebrow hidden items-center gap-2 md:flex"
                title={status.gemini ? "Gemini API key configured" : "No GEMINI_API_KEY: AI features use built-in templates"}
              >
                <span className={cx("h-1.5 w-1.5 rounded-full", status.gemini ? "bg-ok" : "bg-accent")} aria-hidden />
                {status.gemini ? "Gemini connected" : "Demo mode"}
              </span>
            )}
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
        {panel("storyboard", <StoryboardView studio={studio} />)}
        {panel("animate", <AnimateView />)}
        {panel("text", <TextToVideoView />)}
        {panel("research", <ResearchView studio={studio} onNavigate={go} />)}
        <Suspense fallback={<p className="eyebrow py-24 text-center">Loading…</p>}>
          {panel("rig", <RiggingMoCap />)}
          {panel("creative", <CreativeSuite />)}
          {panel(
            "edit",
            <ProductivityStudio
              storyboard={studio.storyboard}
              setStoryboard={studio.setStoryboard}
              activeSceneIndex={studio.playback.sceneIndex}
              setActiveSceneIndex={studio.playback.setSceneIndex}
              setSelectedStyle={studio.setStyle}
              setSelectedMusic={studio.setMusic}
              setPrompt={studio.setPrompt}
              loadStoryboard={studio.restore}
              backdrops={studio.backdrops}
              bpm={studio.playback.bpm}
              scale={studio.playback.scale}
              stopPlayback={studio.playback.stop}
            />,
          )}
        </Suspense>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-2 px-4 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:px-8">
          <span className="eyebrow">ZH-art · Gemini · Veo · Hugging Face · Web Audio</span>
          <span className="eyebrow text-faint">Previews and exports render in your browser.</span>
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
    ["Storyboard", "Gemini writes four scenes — titles, narration, colours, camera moves and layered shapes — and the browser plays them live with a procedural score. Without an API key you get a built-in template."],
    ["Image & text to video", "Sends your image or shot description to Google Veo and plays the clip when it's done. Needs a GEMINI_API_KEY with Veo access."],
    ["Research", "Gemini with Google Search grounding returns a palette, motifs and prompts for any look you name."],
    ["Backdrops", "Generates a still for the current scene with a Hugging Face model. Needs HF_TOKEN."],
    ["Edit & export", "Reorder scenes, change durations, start from templates, and record the storyboard with its score to a real video file in your browser."],
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
        <div className="mt-8">
          <p className="eyebrow mb-3 text-fg">Configuration</p>
          <pre className="overflow-x-auto border border-line bg-ink p-4 font-mono text-[12px] leading-relaxed text-muted">
{`GEMINI_API_KEY=…        # storyboards, research, Veo video
HF_TOKEN=…              # optional, scene backdrops
AI_RATE_LIMIT=30        # requests / 10 min per visitor
VIDEO_RATE_LIMIT=5      # Veo renders / hour per visitor`}
          </pre>
          <p className="mt-3 text-[13px] text-muted">Put these in .env.local, or in your host's secrets, and restart the server.</p>
        </div>
      </div>
    </div>
  );
}
