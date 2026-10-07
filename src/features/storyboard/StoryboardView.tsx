import { Suspense, lazy, useEffect, useState } from "react";
import { Dices, Pause, Play, Undo2, Volume2, VolumeX, Wand2 } from "lucide-react";
import type { Studio } from "../useStudio";
import { VISUAL_PRESETS } from "../../lib/presets";
import { Button, RailTabs, Section, Segmented, StudioLayout, cx } from "../../ui";
import { FilmGate } from "../../ui/FilmGate";
import { StoryboardStage, type StageSelection } from "./StoryboardStage";
import { SceneInspector } from "./SceneInspector";
import { Timeline } from "../timeline/Timeline";
import { TextLayer } from "../timeline/TextLayer";

const TextPanel = lazy(() => import("../timeline/TextPanel").then((m) => ({ default: m.TextPanel })));
const SoundPanel = lazy(() => import("../timeline/SoundPanel").then((m) => ({ default: m.SoundPanel })));
const SampleFilms = lazy(() => import("./SampleFilms").then((m) => ({ default: m.SampleFilms })));
import { transitionAt, transitionLook } from "../timeline/timeline";

type RailTab = "build" | "scene" | "text" | "sound";

function GateButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-7 items-center gap-1.5 rounded-[2px] px-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors",
        active ? "text-accent" : "text-fg/75 hover:bg-fg/10 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function StoryboardView({ studio, onNavigate }: { studio: Studio; onNavigate: (view: "characters" | "rig") => void }) {
  const { board, playback, project } = studio;
  const [tab, setTab] = useState<RailTab>("build");
  const [selection, setSelection] = useState<StageSelection>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const scene = board.scenes[playback.sceneIndex];
  const layout = tab === "scene" && !playback.isPlaying;
  const titleCards = project.titleCards ?? true;
  const trans = layout ? null : transitionAt(board.scenes, playback.sceneIndex, playback.elapsed);
  const look = trans ? transitionLook(trans.kind, trans.progress) : null;
  const prev = trans ? board.scenes[trans.prevIndex] : null;

  // Selection belongs to one scene
  useEffect(() => setSelection(null), [playback.sceneIndex]);

  const moveSelected = (sel: NonNullable<StageSelection>, x: number, y: number) => {
    const i = playback.sceneIndex;
    if (sel.kind === "element") {
      studio.updateScene(i, (s) => ({ ...s, elements: s.elements.map((el, k) => (k === sel.index ? { ...el, position: { x, y } } : el)) }));
    } else {
      studio.updateScene(i, (s) => ({ ...s, cast: (s.cast ?? []).map((m, k) => (k === sel.index ? { ...m, x, y } : m)) }));
    }
  };

  const stage = (
    <FilmGate
      slate={board.title}
      meta={layout ? "Layout · drag to place" : `${board.visualStyle} · ${playback.bpm} bpm`}
      time={playback.sequenceElapsed}
      progress={playback.sequenceDuration ? playback.sequenceElapsed / playback.sequenceDuration : undefined}
      controls={
        <>
          <GateButton label={playback.isPlaying ? "Pause" : "Play"} onClick={playback.toggle}>
            {playback.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{playback.isPlaying ? "Pause" : "Play"}</span>
          </GateButton>
          <GateButton label={playback.isMuted ? "Unmute score" : "Mute score"} onClick={playback.toggleMute}>
            {playback.isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </GateButton>
        </>
      }
    >
      {scene && (
        <StoryboardStage
          scene={scene}
          elapsed={layout ? 0 : playback.elapsed}
          isPlaying={playback.isPlaying}
          backdropUrl={studio.backdrops[playback.sceneIndex]}
          characters={project.characters}
          clips={project.clips}
          grade={project.grade}
          layout={layout}
          selection={selection}
          titleCard={titleCards}
          onSelect={(sel) => {
            setSelection(sel);
            if (sel) setTab("scene");
          }}
          onMove={moveSelected}
        />
      )}
      {trans && look && prev && look.prevOpacity > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: look.prevOpacity,
            transform: look.prevScale !== 1 ? `scale(${look.prevScale})` : undefined,
            clipPath: look.revealLeft > 0 ? `inset(0 0 0 ${look.revealLeft * 100}%)` : undefined,
          }}
        >
          <StoryboardStage
            scene={prev}
            elapsed={trans.prevLocal}
            isPlaying={false}
            backdropUrl={studio.backdrops[trans.prevIndex]}
            characters={project.characters}
            clips={project.clips}
            grade={project.grade}
            titleCard={false}
          />
        </div>
      )}
      {look && look.flash > 0 && <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: look.flash }} />}
      {!layout && <TextLayer texts={project.texts} time={playback.sequenceElapsed} selectedId={tab === "text" ? selectedText : null} />}
    </FilmGate>
  );

  const rail = (
    <div>
      <RailTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "build", label: "Build" },
          { value: "scene", label: "Scene" },
          { value: "text", label: "Text" },
          { value: "sound", label: "Sound" },
        ]}
      />
      {tab === "build" && <BuildPanel studio={studio} />}
      {tab === "scene" && <SceneInspector studio={studio} selection={selection} setSelection={setSelection} onNavigate={onNavigate} />}
      <Suspense fallback={<p className="eyebrow py-10 text-center">Loading…</p>}>
        {tab === "text" && <TextPanel studio={studio} selected={selectedText} onSelect={setSelectedText} />}
        {tab === "sound" && <SoundPanel studio={studio} />}
      </Suspense>
    </div>
  );

  return (
    <StudioLayout
      stage={<div className="xl:mx-auto xl:max-w-[calc((100vh-400px)*1.7778)]">{stage}</div>}
      rail={rail}
      below={
        <Timeline
          studio={studio}
          selectedText={selectedText}
          onSelectText={(id) => {
            setSelectedText(id);
            if (id) setTab("text");
          }}
          onEditScene={() => setTab("scene")}
        />
      }
    />
  );
}

function BuildPanel({ studio }: { studio: Studio }) {
  return (
    <div>
      <Section index="01" title="Idea">
        <label htmlFor="sb-prompt" className="sr-only">
          Your idea
        </label>
        <textarea
          id="sb-prompt"
          value={studio.project.prompt}
          onChange={(e) => studio.setPrompt(e.target.value)}
          rows={3}
          placeholder="A lighthouse keeper who collects lost radio signals…"
          className="w-full resize-none border-0 bg-transparent p-0 font-serif text-[26px] italic leading-[1.15] text-fg outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <p className="mt-3 text-xs leading-relaxed text-faint">
          The builder reads places and things in your idea — space, ocean, forest, city, fire, snow, desert — and composes scenes around them. Everything it makes stays editable.
        </p>
      </Section>

      <Section index="02" title="Look">
        <div className="flex flex-col gap-4">
          <Segmented
            label="Visual style"
            value={studio.style}
            onChange={studio.setStyle}
            columns={2}
            options={VISUAL_PRESETS.map((p) => ({ value: p.id, label: p.name, hint: p.desc, swatch: p.swatch }))}
          />
          <Button size="sm" variant="ghost" onClick={studio.applyStyle} className="self-start">
            Recolour current scenes with this style
          </Button>
        </div>
      </Section>

      <Section index="03" title="Shape">
        <Segmented
          label="Scenes"
          value={String(studio.sceneCount)}
          onChange={(v) => studio.setSceneCount(Number(v))}
          options={["3", "4", "5", "6"].map((n) => ({ value: n, label: n }))}
        />
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-6 pb-8">
        <Button variant="primary" size="lg" className="w-full" onClick={() => studio.build()} icon={<Wand2 className="h-5 w-5" />}>
          Build storyboard
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button icon={<Dices className="h-4 w-4" />} onClick={() => studio.build({ reroll: true })}>
            Another take
          </Button>
          <Button icon={<Undo2 className="h-4 w-4" />} onClick={studio.undoBuild} disabled={!studio.canUndo}>
            Undo
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-faint">Building replaces the scenes. Characters, clips, text, music and the grade are kept.</p>
      </div>

      <Suspense fallback={null}>
        <SampleFilms studio={studio} />
      </Suspense>
    </div>
  );
}
