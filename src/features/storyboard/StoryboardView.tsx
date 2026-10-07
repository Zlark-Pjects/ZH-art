import { useEffect, useState } from "react";
import { Copy, Dices, Pause, Play, Plus, Trash2, Undo2, Volume2, VolumeX, Wand2 } from "lucide-react";
import type { Studio } from "../useStudio";
import { MUSIC_PRESETS, SCALES, VISUAL_PRESETS, type ScaleName } from "../../lib/presets";
import { blankScene } from "../../project/builder";
import { Button, Field, IconButton, RailTabs, Section, Segmented, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate } from "../../ui/FilmGate";
import { StoryboardStage, type StageSelection } from "./StoryboardStage";
import { SceneInspector } from "./SceneInspector";
import { Spectrum } from "./Spectrum";

type RailTab = "build" | "scene" | "score";

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
  const scene = board.scenes[playback.sceneIndex];
  const layout = tab === "scene" && !playback.isPlaying;

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
          onSelect={(sel) => {
            setSelection(sel);
            if (sel) setTab("scene");
          }}
          onMove={moveSelected}
        />
      )}
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
          { value: "score", label: "Score" },
        ]}
      />
      {tab === "build" && <BuildPanel studio={studio} />}
      {tab === "scene" && <SceneInspector studio={studio} selection={selection} setSelection={setSelection} onNavigate={onNavigate} />}
      {tab === "score" && <ScorePanel studio={studio} />}
    </div>
  );

  return (
    <StudioLayout
      stage={stage}
      rail={rail}
      below={
        <Filmstrip
          studio={studio}
          onEdit={() => {
            setTab("scene");
          }}
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
        <p className="text-xs leading-relaxed text-faint">Building replaces the scenes. Characters, clips and the grade are kept.</p>
      </div>
    </div>
  );
}

function ScorePanel({ studio }: { studio: Studio }) {
  const { playback } = studio;
  return (
    <div>
      <Section index="01" title="Score" aside="Web Audio">
        <div className="flex flex-col gap-5">
          <Segmented
            label="Mood"
            value={studio.mood}
            onChange={studio.setMood}
            columns={3}
            options={MUSIC_PRESETS.map((p) => ({ value: p.id, label: p.name, hint: p.desc }))}
          />
          <Spectrum active={playback.isPlaying} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tempo" hint={`${playback.bpm} bpm`} htmlFor="sb-bpm">
              <input
                id="sb-bpm"
                type="range"
                min={60}
                max={160}
                value={playback.bpm}
                onChange={(e) => {
                  playback.setBpm(Number(e.target.value));
                  studio.patchBoard({ tempoBpm: Number(e.target.value) });
                }}
                className="mt-2 w-full"
              />
            </Field>
            <Field label="Scale" htmlFor="sb-scale">
              <select
                id="sb-scale"
                value={playback.scale}
                onChange={(e) => {
                  playback.setScale(e.target.value as ScaleName);
                  studio.patchBoard({ scale: e.target.value as ScaleName });
                }}
                className={inputClass}
              >
                {SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-faint">Saved with the project and used for the exported video.</p>
        </div>
      </Section>
    </div>
  );
}

function Filmstrip({ studio, onEdit }: { studio: Studio; onEdit: () => void }) {
  const { board, playback, project } = studio;
  const i = playback.sceneIndex;
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="eyebrow text-fg">Sequence</h2>
        <div className="flex items-center gap-1">
          <span className="eyebrow mr-2">
            {board.scenes.length} scenes · {playback.sequenceDuration.toFixed(1)}s
          </span>
          <IconButton label="Duplicate this scene" onClick={() => studio.insertScene(i + 1, { ...board.scenes[i] })}>
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete this scene" onClick={() => studio.removeScene(i)} disabled={board.scenes.length <= 1}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {board.scenes.map((s, k) => {
          const active = k === i;
          return (
            <li key={`${s.sceneNumber}-${k}`}>
              <button
                type="button"
                onClick={() => (active ? onEdit() : playback.setSceneIndex(k))}
                aria-current={active ? "step" : undefined}
                className="group block w-full text-left"
              >
                <div className={cx("relative aspect-video overflow-hidden ring-1 transition-shadow duration-300", active ? "ring-fg/70" : "ring-line group-hover:ring-line-strong")}>
                  <StoryboardStage
                    scene={s}
                    elapsed={s.duration * 0.6}
                    isPlaying={false}
                    backdropUrl={studio.backdrops[k]}
                    characters={project.characters}
                    clips={project.clips}
                    grade={project.grade}
                    thumbnail
                  />
                  <span className={cx("absolute inset-x-0 top-0 h-[2px] origin-left bg-accent transition-transform duration-500", active ? "scale-x-100" : "scale-x-0")} />
                  <span className="absolute left-2 top-2 font-mono text-[11px] text-fg/90 [text-shadow:0_1px_2px_#000]">{String(k + 1).padStart(2, "0")}</span>
                  <span className="absolute bottom-2 right-2 font-mono text-[11px] text-fg/90 [text-shadow:0_1px_2px_#000]">{s.duration.toFixed(1)}s</span>
                </div>
                <p className={cx("mt-2 truncate font-display text-lg uppercase leading-none tracking-[0.01em] transition-colors", active ? "text-fg" : "text-muted group-hover:text-fg")}>
                  {s.title || "Untitled"}
                </p>
                <p className="eyebrow mt-1.5 text-faint">{active ? "Click to edit" : s.cameraMotion.type.replace("-", " ")}</p>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => {
              studio.insertScene(board.scenes.length, blankScene(board, board.scenes.length + 1));
              playback.setSceneIndex(board.scenes.length);
              onEdit();
            }}
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-muted transition-colors hover:border-fg/50 hover:text-fg"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[13px]">Add scene</span>
          </button>
        </li>
      </ol>
    </div>
  );
}
