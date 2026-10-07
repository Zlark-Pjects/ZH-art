import { useState } from "react";
import { ImagePlus, Pause, Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { Studio } from "../useStudio";
import { HF_MODELS, MUSIC_PRESETS, SCALES, VISUAL_PRESETS, type ScaleName } from "../../lib/presets";
import { Button, Field, Notice, Progress, Section, Segmented, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate, GateEmpty, GateVideo } from "../../ui/FilmGate";
import { StoryboardStage } from "./StoryboardStage";
import { Spectrum } from "./Spectrum";

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

export function StoryboardView({ studio }: { studio: Studio }) {
  const { storyboard, playback, veo } = studio;
  const [showRender, setShowRender] = useState(true);
  const scene = storyboard?.scenes[playback.sceneIndex];
  const showingVeo = Boolean(veo.url && showRender);

  const stage = (
    <FilmGate
      slate={storyboard ? storyboard.title : "ZH-art"}
      meta={storyboard ? `${storyboard.visualStyle} · ${playback.bpm} bpm` : undefined}
      time={showingVeo ? undefined : playback.sequenceElapsed}
      progress={!showingVeo && playback.sequenceDuration ? playback.sequenceElapsed / playback.sequenceDuration : undefined}
      controls={
        storyboard && (
          <>
            {!showingVeo && (
              <GateButton label={playback.isPlaying ? "Pause" : "Play"} onClick={playback.toggle}>
                {playback.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{playback.isPlaying ? "Pause" : "Play"}</span>
              </GateButton>
            )}
            <GateButton label={playback.isMuted ? "Unmute score" : "Mute score"} onClick={playback.toggleMute}>
              {playback.isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </GateButton>
            {veo.url && (
              <>
                <span className="mx-1 h-3 w-px bg-fg/20" aria-hidden />
                <GateButton label="Show live preview" onClick={() => setShowRender(false)} active={!showingVeo}>
                  Live
                </GateButton>
                <GateButton label="Show Veo render" onClick={() => setShowRender(true)} active={showingVeo}>
                  Veo
                </GateButton>
              </>
            )}
          </>
        )
      }
    >
      {showingVeo && veo.url ? (
        <GateVideo url={veo.url} filename={`zh-art-${Date.now()}.mp4`} muted={playback.isMuted} />
      ) : scene ? (
        <StoryboardStage
          scene={scene}
          elapsed={playback.elapsed}
          isPlaying={playback.isPlaying}
          backdropUrl={studio.backdrops[playback.sceneIndex]}
        />
      ) : (
        <GateEmpty
          title={studio.isGenerating ? "Writing" : "No picture"}
          line={studio.isGenerating ? "The crew is drafting your storyboard." : "Write a prompt and generate a storyboard."}
        />
      )}
    </FilmGate>
  );

  const below = storyboard && (
    <div className="flex flex-col gap-12">
      <Filmstrip studio={studio} />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {storyboard.crewDialogue && storyboard.crewDialogue.length > 0 && <CrewNotes studio={studio} />}
        <Takes studio={studio} />
      </div>
    </div>
  );

  return <StudioLayout stage={stage} below={below} rail={<Rail studio={studio} />} />;
}

function Rail({ studio }: { studio: Studio }) {
  const { playback, veo, storyboard } = studio;
  return (
    <div>
      {studio.warning && (
        <div className="mb-6">
          <Notice tone="warn" onDismiss={studio.dismissWarning}>
            {studio.warning}
          </Notice>
        </div>
      )}

      <Section index="01" title="Prompt">
        <label htmlFor="sb-prompt" className="sr-only">
          Storyboard prompt
        </label>
        <textarea
          id="sb-prompt"
          value={studio.prompt}
          onChange={(e) => studio.setPrompt(e.target.value)}
          rows={3}
          placeholder="A lighthouse keeper who collects lost radio signals…"
          className="w-full resize-none border-0 bg-transparent p-0 font-serif text-[26px] italic leading-[1.15] text-fg outline-none placeholder:text-faint focus-visible:outline-none"
        />
      </Section>

      <Section index="02" title="Look">
        <Segmented
          label="Visual style"
          value={studio.style}
          onChange={studio.setStyle}
          columns={2}
          options={VISUAL_PRESETS.map((p) => ({ value: p.id, label: p.name, hint: p.desc, swatch: p.swatch }))}
        />
      </Section>

      <Section index="03" title="Score" aside="Web Audio">
        <div className="flex flex-col gap-5">
          <Segmented
            label="Mood"
            value={studio.music}
            onChange={studio.setMusic}
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
                onChange={(e) => playback.setBpm(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </Field>
            <Field label="Scale" htmlFor="sb-scale">
              <select
                id="sb-scale"
                value={playback.scale}
                onChange={(e) => playback.setScale(e.target.value as ScaleName)}
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
          <p className="text-xs leading-relaxed text-faint">The mood applies to the next storyboard; tempo and scale change live.</p>
        </div>
      </Section>

      <div className="border-t border-line pt-6 pb-8">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => studio.generate()}
          loading={studio.isGenerating}
          icon={<Sparkles className="h-5 w-5" />}
        >
          {studio.isGenerating ? "Writing storyboard" : "Generate storyboard"}
        </Button>
        {studio.generateError && (
          <div className="mt-3">
            <Notice tone="error">{studio.generateError}</Notice>
          </div>
        )}
      </div>

      {storyboard && (
        <Section index="04" title="Render with Veo" aside="AI video">
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-muted">
              Send the whole storyboard to Google Veo for an 8-second 720p clip. Renders take a few minutes.
            </p>
            {(veo.status === "requesting" || veo.status === "rendering") && (
              <Progress value={veo.progress} label={veo.status === "requesting" ? "Starting" : "Rendering"} />
            )}
            {veo.status === "error" && (
              <Notice tone="error" title="No render">
                {veo.error}
              </Notice>
            )}
            {veo.status === "completed" && (
              <Notice tone="info" title="Render ready">
                It's playing in the frame. Use the Live / Veo switch to compare.
              </Notice>
            )}
            {veo.status !== "requesting" && veo.status !== "rendering" && (
              <Button onClick={studio.startVeo}>{veo.status === "idle" ? "Render this storyboard" : "Render again"}</Button>
            )}
          </div>
        </Section>
      )}

      {storyboard && (
        <Section index="05" title="Scene backdrop" aside={`Scene ${playback.sceneIndex + 1}`} id="backdrop">
          <div className="flex flex-col gap-4">
            <Field label="Model" htmlFor="hf-model">
              <select id="hf-model" value={studio.hfModel} onChange={(e) => studio.setHfModel(e.target.value)} className={inputClass}>
                {HF_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Backdrop prompt"
              htmlFor="hf-prompt"
              hint={
                <button
                  type="button"
                  className="underline decoration-line-strong underline-offset-4 hover:text-fg"
                  onClick={() => studio.setHfPrompt(storyboard.scenes[playback.sceneIndex].visualDescription)}
                >
                  Use scene description
                </button>
              }
            >
              <textarea
                id="hf-prompt"
                value={studio.hfPrompt}
                onChange={(e) => studio.setHfPrompt(e.target.value)}
                rows={3}
                placeholder="Leave empty to use the scene's own description."
                className={cx(inputClass, "resize-none")}
              />
            </Field>
            {studio.hfStatus && <Notice tone={studio.hfStatus.tone}>{studio.hfStatus.text}</Notice>}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button onClick={studio.generateBackdrop} loading={studio.isHfGenerating} icon={<ImagePlus className="h-4 w-4" />}>
                Generate backdrop
              </Button>
              <Button variant="ghost" onClick={studio.clearBackdrop} disabled={!studio.backdrops[playback.sceneIndex]}>
                Clear
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function Filmstrip({ studio }: { studio: Studio }) {
  const { storyboard, playback } = studio;
  if (!storyboard) return null;
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="eyebrow text-fg">Sequence</h2>
        <span className="eyebrow">
          {storyboard.scenes.length} scenes · {playback.sequenceDuration.toFixed(1)}s
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {storyboard.scenes.map((s, i) => {
          const active = i === playback.sceneIndex;
          return (
            <li key={`${s.sceneNumber}-${i}`}>
              <button
                type="button"
                onClick={() => playback.setSceneIndex(i)}
                aria-current={active ? "step" : undefined}
                className="group block w-full text-left"
              >
                <div
                  className={cx(
                    "relative aspect-video overflow-hidden ring-1 transition-[box-shadow,transform] duration-300",
                    active ? "ring-fg/70" : "ring-line group-hover:ring-line-strong",
                  )}
                >
                  <StoryboardStage scene={s} elapsed={s.duration * 0.6} isPlaying={false} backdropUrl={studio.backdrops[i]} thumbnail />
                  <span className={cx("absolute inset-x-0 top-0 h-[2px] origin-left bg-accent transition-transform duration-500", active ? "scale-x-100" : "scale-x-0")} />
                  <span className="absolute left-2 top-2 font-mono text-[11px] text-fg/90 [text-shadow:0_1px_2px_#000]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="absolute bottom-2 right-2 font-mono text-[11px] text-fg/90 [text-shadow:0_1px_2px_#000]">{s.duration.toFixed(1)}s</span>
                </div>
                <p className={cx("mt-2 font-display text-lg uppercase leading-none tracking-[0.01em] transition-colors", active ? "text-fg" : "text-muted group-hover:text-fg")}>
                  {s.title}
                </p>
                <p className="eyebrow mt-1.5 text-faint">{s.cameraMotion.type.replace("-", " ")}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function CrewNotes({ studio }: { studio: Studio }) {
  const notes = studio.storyboard?.crewDialogue ?? [];
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="eyebrow text-fg">Crew notes</h2>
        <span className="eyebrow">Director · Camera · Sound</span>
      </div>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {notes.map((n, i) => (
          <li key={i} className="grid grid-cols-[40px_1fr] gap-4 py-5">
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong font-mono text-xs text-fg/80"
            >
              {initials(n.name)}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] font-medium text-fg">{n.name.replace(/\s*\(.*\)/, "")}</span>
                <span className="eyebrow text-faint">{n.role.replace("-", " ")}</span>
              </p>
              <p className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-muted">{n.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Takes({ studio }: { studio: Studio }) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="eyebrow text-fg">Takes</h2>
        <span className="eyebrow">{studio.history.length || "None yet"}</span>
      </div>
      {studio.history.length === 0 ? (
        <p className="border-y border-line py-5 font-serif text-lg italic text-muted">Every storyboard you generate is kept here for this session.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {studio.history.map((take, i) => {
            const current = take === studio.storyboard;
            return (
              <li key={`${take.title}-${i}`}>
                <button
                  type="button"
                  onClick={() => studio.restore(take)}
                  className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-3.5 text-left"
                >
                  <span className="font-mono text-[11px] text-faint">T{String(studio.history.length - i).padStart(2, "0")}</span>
                  <span className={cx("truncate text-[15px] transition-colors", current ? "text-fg" : "text-muted group-hover:text-fg")}>
                    {take.title}
                  </span>
                  <span className={cx("eyebrow", current && "text-accent")}>{current ? "On stage" : take.visualStyle}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
