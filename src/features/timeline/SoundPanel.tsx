import { useRef } from "react";
import { Music2, Trash2, Upload } from "lucide-react";
import type { Studio } from "../useStudio";
import { MUSIC_PRESETS, SCALES, type ScaleName } from "../../lib/presets";
import { Button, Field, IconButton, Notice, Section, Segmented, Slider, cx, inputClass } from "../../ui";
import { Spectrum } from "../storyboard/Spectrum";
import { useSongUpload } from "./useSongUpload";

/** Rail panel for sound: a song of your own, and the generated score. */
export function SoundPanel({ studio }: { studio: Studio }) {
  const { playback } = studio;
  const music = studio.project.music ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const songUpload = useSongUpload(studio);
  const scoreOn = !music || music.withScore;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) songUpload.upload(f);
        }}
      />
      <Section index="01" title="Song" aside={music ? `${music.bpm} bpm` : "Optional"}>
        <div className="flex flex-col gap-4">
          {music ? (
            <>
              <div className="flex items-center gap-3 rounded-[3px] border border-line px-3 py-2.5">
                <Music2 className="h-4 w-4 shrink-0 text-[#3fbf98]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-fg">{music.name}</p>
                  <p className="text-xs text-faint">
                    {Math.floor(music.duration / 60)}:{String(Math.round(music.duration % 60)).padStart(2, "0")} · {music.beats.length} beats found
                  </p>
                </div>
                <IconButton label="Remove the song" onClick={() => { playback.stop(); studio.removeMusic(); }}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <Slider label="Volume" value={Math.round(music.volume * 100)} min={0} max={100} onChange={(v) => studio.patchMusic({ volume: v / 100 })} format={(v) => `${v}%`} />
              <Slider
                label="Film starts at"
                value={music.offset}
                min={0}
                max={Math.max(0, Math.floor(music.duration - 1))}
                step={0.1}
                onChange={(v) => studio.patchMusic({ offset: v })}
                format={(v) => `${v.toFixed(1)}s into the song`}
              />
              <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
                Keep the generated score underneath
                <input type="checkbox" checked={music.withScore} onChange={(e) => studio.patchMusic({ withScore: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
              </label>
              <Button size="sm" variant="ghost" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} disabled={songUpload.busy} className="self-start">
                {songUpload.busy ? "Finding the beat…" : "Replace song"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted">
                Add your own track. ZH-art finds its beat on this device, so cuts can snap to it, and the song plays with the film and goes into the exported video.
              </p>
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} loading={songUpload.busy}>
                {songUpload.busy ? "Finding the beat…" : "Add a song"}
              </Button>
              <p className="text-xs text-faint">MP3, WAV, M4A or OGG, up to 40 MB. Only use music you have the rights to.</p>
            </>
          )}
          {songUpload.error && <Notice tone="error">{songUpload.error}</Notice>}
          {studio.songError && <Notice tone="error">{studio.songError}</Notice>}
        </div>
      </Section>

      <Section index="02" title="Generated score" aside={scoreOn ? "Web Audio" : "Off"}>
        <div className={cx("flex flex-col gap-5", !scoreOn && "opacity-50")}>
          {!scoreOn && <p className="text-xs text-faint">Muted while the song plays. Turn on “Keep the generated score underneath” to layer it.</p>}
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
          <p className="text-xs leading-relaxed text-faint">Without a song, the score's tempo is the beat that cuts snap to.</p>
        </div>
      </Section>
    </div>
  );
}
