import { useRef, useState } from "react";
import { Copy, ImagePlus, Plus, Trash2, UserPlus, X } from "lucide-react";
import type { CameraMotion, CastMember, ElementSpec, ParticleSpec, Scene } from "../../types";
import type { Studio } from "../useStudio";
import { Button, ColorField, Field, IconButton, Notice, Section, Segmented, Slider, cx, inputClass } from "../../ui";
import type { StageSelection } from "./StoryboardStage";
import { TRANSITIONS } from "../timeline/timeline";

export const CAMERA_PRESETS: Record<CameraMotion["type"], { label: string; motion: Omit<CameraMotion, "type" | "speed"> }> = {
  "zoom-in": { label: "Push in", motion: { scaleStart: 1, scaleEnd: 1.18, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 } },
  "zoom-out": { label: "Pull out", motion: { scaleStart: 1.2, scaleEnd: 1, xStart: 0, xEnd: 0, yStart: 0, yEnd: 0 } },
  "pan-left": { label: "Pan left", motion: { scaleStart: 1.06, scaleEnd: 1.06, xStart: 20, xEnd: -20, yStart: 0, yEnd: 0 } },
  "pan-right": { label: "Pan right", motion: { scaleStart: 1.06, scaleEnd: 1.06, xStart: -20, xEnd: 20, yStart: 0, yEnd: 0 } },
  "orbit-left": { label: "Orbit left", motion: { scaleStart: 1.1, scaleEnd: 1.1, xStart: 15, xEnd: -15, yStart: -6, yEnd: 6 } },
  "orbit-right": { label: "Orbit right", motion: { scaleStart: 1.1, scaleEnd: 1.1, xStart: -15, xEnd: 15, yStart: 6, yEnd: -6 } },
  "parallax-tilt": { label: "Tilt", motion: { scaleStart: 1.1, scaleEnd: 1.2, xStart: 12, xEnd: -12, yStart: -10, yEnd: 10 } },
  drift: { label: "Drift", motion: { scaleStart: 1, scaleEnd: 1.08, xStart: -8, xEnd: 8, yStart: 0, yEnd: 0 } },
};

const SHAPES: ElementSpec["shape"][] = ["circle", "ring", "star", "polygon", "rect", "line", "spline"];
const MOVEMENTS: ElementSpec["movement"][] = ["none", "float", "rotate", "pulse", "glide"];
const PARTICLES: ParticleSpec["type"][] = ["none", "stars", "dust-motes", "sparks", "rain", "snow", "bubbles", "cherry-blossoms"];
const DEPTHS = [
  { value: "1", label: "Back" },
  { value: "2", label: "Middle" },
  { value: "3", label: "Front" },
];

const pretty = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function SceneInspector({
  studio,
  selection,
  setSelection,
  onNavigate,
}: {
  studio: Studio;
  selection: StageSelection;
  setSelection: (s: StageSelection) => void;
  onNavigate: (view: "characters" | "rig") => void;
}) {
  const index = studio.playback.sceneIndex;
  const scene = studio.board.scenes[index];
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  if (!scene) return null;

  const set = (patch: Partial<Scene>) => studio.updateScene(index, patch);
  const setCamera = (patch: Partial<CameraMotion>) => set({ cameraMotion: { ...scene.cameraMotion, ...patch } });
  const setParticles = (patch: Partial<ParticleSpec>) => set({ particles: { ...scene.particles, ...patch } });
  const setElement = (i: number, patch: Partial<ElementSpec>) =>
    set({ elements: scene.elements.map((el, k) => (k === i ? { ...el, ...patch } : el)) });
  const setCast = (i: number, patch: Partial<CastMember>) => set({ cast: (scene.cast ?? []).map((m, k) => (k === i ? { ...m, ...patch } : m)) });

  const gradient = [...scene.gradientColors, ...scene.gradientColors, ...scene.gradientColors].slice(0, 3);
  const selectedElement = selection?.kind === "element" ? scene.elements[selection.index] : undefined;
  const selectedCast = selection?.kind === "cast" ? scene.cast?.[selection.index] : undefined;

  const addElement = (shape: ElementSpec["shape"]) => {
    const el: ElementSpec = {
      type: "layered-shape",
      shape,
      color: scene.accentColor,
      size: 120,
      position: { x: 50, y: 50 },
      movement: "none",
      depth: 2,
    };
    set({ elements: [...scene.elements, el] });
    setSelection({ kind: "element", index: scene.elements.length });
  };

  const addCast = () => {
    const character = studio.project.characters[0];
    const clip = studio.project.clips[0];
    if (!character || !clip) return;
    const member: CastMember = { characterId: character.id, clipId: clip.id, x: 50, y: 88, scale: 0.55 };
    set({ cast: [...(scene.cast ?? []), member] });
    setSelection({ kind: "cast", index: scene.cast?.length ?? 0 });
  };

  return (
    <div>
      <Section index={String(index + 1).padStart(2, "0")} title="Words" aside={`Scene ${index + 1} of ${studio.board.scenes.length}`}>
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="sc-title">
            <input id="sc-title" value={scene.title} onChange={(e) => set({ title: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Narration" htmlFor="sc-narr" hint="Shown as the subtitle">
            <textarea id="sc-narr" value={scene.narration} onChange={(e) => set({ narration: e.target.value })} rows={3} className={cx(inputClass, "resize-none font-serif text-[16px] italic")} />
          </Field>
          <Slider label="Duration" value={scene.duration} min={1} max={20} step={0.1} onChange={(v) => set({ duration: Math.round(v * 10) / 10 })} format={(v) => `${v.toFixed(1)}s`} />
          {index > 0 && (
            <Segmented
              label="Arrives with"
              value={scene.transition ?? "cut"}
              onChange={(transition) => set({ transition })}
              columns={5}
              options={TRANSITIONS.map((t) => ({ value: t.id, label: t.label, hint: t.hint }))}
            />
          )}
        </div>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-4">
          {gradient.map((c, i) => (
            <ColorField
              key={i}
              label={["Sky", "Middle", "Ground"][i]}
              value={c}
              onChange={(v) => {
                const next = [...gradient];
                next[i] = v;
                set({ gradientColors: next, backgroundColor: next[0] });
              }}
            />
          ))}
          <ColorField label="Accent" value={scene.accentColor} onChange={(v) => set({ accentColor: v })} />
        </div>
      </Section>

      <Section title="Camera">
        <div className="flex flex-col gap-4">
          <Segmented
            label="Move"
            value={scene.cameraMotion.type}
            onChange={(type) => setCamera({ type, ...CAMERA_PRESETS[type].motion })}
            columns={4}
            options={(Object.keys(CAMERA_PRESETS) as CameraMotion["type"][]).map((k) => ({ value: k, label: CAMERA_PRESETS[k].label }))}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Slider label="Zoom from" value={scene.cameraMotion.scaleStart} min={0.8} max={1.6} step={0.01} onChange={(v) => setCamera({ scaleStart: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Zoom to" value={scene.cameraMotion.scaleEnd} min={0.8} max={1.6} step={0.01} onChange={(v) => setCamera({ scaleEnd: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Pan from" value={scene.cameraMotion.xStart} min={-60} max={60} onChange={(v) => setCamera({ xStart: v })} />
            <Slider label="Pan to" value={scene.cameraMotion.xEnd} min={-60} max={60} onChange={(v) => setCamera({ xEnd: v })} />
            <Slider label="Rise from" value={scene.cameraMotion.yStart} min={-40} max={40} onChange={(v) => setCamera({ yStart: v })} />
            <Slider label="Rise to" value={scene.cameraMotion.yEnd} min={-40} max={40} onChange={(v) => setCamera({ yEnd: v })} />
          </div>
        </div>
      </Section>

      <Section title="Shapes" aside={`${scene.elements.length}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {SHAPES.map((shape) => (
              <Button key={shape} size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => addElement(shape)}>
                {pretty(shape)}
              </Button>
            ))}
          </div>
          {scene.elements.length > 0 && (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {scene.elements.map((el, i) => {
                const active = selection?.kind === "element" && selection.index === i;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelection({ kind: "element", index: i })}
                      className={cx("flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left text-[14px]", active ? "text-fg" : "text-muted hover:text-fg")}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-fg/20" style={{ background: el.color }} />
                      <span className="truncate">{el.details || pretty(el.shape)}</span>
                      <span className="eyebrow ml-auto text-faint">{DEPTHS[(el.depth || 2) - 1]?.label}</span>
                    </button>
                    <IconButton label="Duplicate shape" onClick={() => set({ elements: [...scene.elements, { ...el, position: { x: Math.min(95, el.position.x + 6), y: el.position.y } }] })}>
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Delete shape"
                      onClick={() => {
                        set({ elements: scene.elements.filter((_, k) => k !== i) });
                        setSelection(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedElement && selection?.kind === "element" && (
            <div className="flex flex-col gap-4 rounded-[3px] border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-fg">Selected shape</span>
                <span className="text-xs text-faint">Drag it on the picture</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Shape" htmlFor="el-shape">
                  <select id="el-shape" value={selectedElement.shape} onChange={(e) => setElement(selection.index, { shape: e.target.value as ElementSpec["shape"] })} className={inputClass}>
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>
                        {pretty(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Motion" htmlFor="el-move">
                  <select id="el-move" value={selectedElement.movement} onChange={(e) => setElement(selection.index, { movement: e.target.value as ElementSpec["movement"] })} className={inputClass}>
                    {MOVEMENTS.map((m) => (
                      <option key={m} value={m}>
                        {pretty(m)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <ColorField label="Colour" value={selectedElement.color} onChange={(v) => setElement(selection.index, { color: v })} />
              <Segmented
                label="Depth"
                value={String(selectedElement.depth || 2)}
                onChange={(v) => setElement(selection.index, { depth: Number(v) })}
                options={DEPTHS}
              />
              <Slider label="Size" value={selectedElement.size} min={10} max={500} onChange={(v) => setElement(selection.index, { size: v })} />
              <div className="grid grid-cols-2 gap-4">
                <Slider label="Across" value={selectedElement.position.x} min={0} max={100} onChange={(v) => setElement(selection.index, { position: { ...selectedElement.position, x: v } })} format={(v) => `${Math.round(v)}%`} />
                <Slider label="Down" value={selectedElement.position.y} min={0} max={100} onChange={(v) => setElement(selection.index, { position: { ...selectedElement.position, y: v } })} format={(v) => `${Math.round(v)}%`} />
              </div>
              <Field label="Label" htmlFor="el-label">
                <input id="el-label" value={selectedElement.details ?? ""} onChange={(e) => setElement(selection.index, { details: e.target.value })} placeholder="What this shape is" className={inputClass} />
              </Field>
            </div>
          )}
        </div>
      </Section>

      <Section title="Cast" aside={`${scene.cast?.length ?? 0}`}>
        <div className="flex flex-col gap-4">
          {studio.project.characters.length === 0 || studio.project.clips.length === 0 ? (
            <Notice>
              Design a character and save a motion clip first.{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => onNavigate(studio.project.characters.length ? "rig" : "characters")}>
                {studio.project.characters.length ? "Open the motion rig" : "Open characters"}
              </button>
            </Notice>
          ) : (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={addCast}>
              Add a character to this scene
            </Button>
          )}
          {(scene.cast ?? []).map((m, i) => {
            const active = selection?.kind === "cast" && selection.index === i;
            const look = studio.project.characters.find((c) => c.id === m.characterId);
            return (
              <div key={i} className={cx("rounded-[3px] border p-4", active ? "border-fg/50 bg-surface" : "border-line")}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setSelection({ kind: "cast", index: i })} className="flex items-center gap-2 text-[14px] text-fg">
                    <span className="h-3 w-3 rounded-full" style={{ background: look?.costume }} />
                    {look?.name ?? "Missing character"}
                  </button>
                  <IconButton
                    label="Remove from scene"
                    onClick={() => {
                      set({ cast: scene.cast?.filter((_, k) => k !== i) });
                      setSelection(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
                {active && selectedCast && (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Character" htmlFor={`cast-char-${i}`}>
                        <select id={`cast-char-${i}`} value={m.characterId} onChange={(e) => setCast(i, { characterId: e.target.value })} className={inputClass}>
                          {studio.project.characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Clip" htmlFor={`cast-clip-${i}`}>
                        <select id={`cast-clip-${i}`} value={m.clipId} onChange={(e) => setCast(i, { clipId: e.target.value })} className={inputClass}>
                          {studio.project.clips.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Slider label="Height" value={m.scale} min={0.15} max={1} step={0.01} onChange={(v) => setCast(i, { scale: v })} format={(v) => `${Math.round(v * 100)}% of frame`} />
                    <div className="grid grid-cols-2 gap-4">
                      <Slider label="Across" value={m.x} min={0} max={100} onChange={(v) => setCast(i, { x: v })} format={(v) => `${Math.round(v)}%`} />
                      <Slider label="Feet at" value={m.y} min={20} max={110} onChange={(v) => setCast(i, { y: v })} format={(v) => `${Math.round(v)}%`} />
                    </div>
                    <label className="flex items-center justify-between text-[14px] text-fg">
                      Face the other way
                      <input type="checkbox" checked={Boolean(m.flip)} onChange={(e) => setCast(i, { flip: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Particles">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <Field label="Type" htmlFor="pt-type">
              <select id="pt-type" value={scene.particles.type} onChange={(e) => setParticles({ type: e.target.value as ParticleSpec["type"] })} className={inputClass}>
                {PARTICLES.map((p) => (
                  <option key={p} value={p}>
                    {pretty(p)}
                  </option>
                ))}
              </select>
            </Field>
            <ColorField label="Colour" value={scene.particles.color} onChange={(v) => setParticles({ color: v })} />
          </div>
          {scene.particles.type !== "none" && (
            <div className="grid grid-cols-3 gap-4">
              <Slider label="Count" value={scene.particles.count} min={5} max={48} onChange={(v) => setParticles({ count: v })} />
              <Slider label="Speed" value={scene.particles.speed} min={0.3} max={3} step={0.1} onChange={(v) => setParticles({ speed: v })} format={(v) => v.toFixed(1)} />
              <Slider label="Size" value={scene.particles.size} min={1} max={6} step={0.1} onChange={(v) => setParticles({ size: v })} format={(v) => v.toFixed(1)} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Backdrop image" aside="Optional">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-muted">Use your own photo or painting behind the shapes. The scene's camera move animates it.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploadError("");
              try {
                await studio.setBackdrop(index, file);
              } catch (err: any) {
                setUploadError(err?.message || "Couldn't use that image.");
              }
            }}
          />
          {studio.backdrops[index] && <img src={studio.backdrops[index]} alt="" className="aspect-video w-full rounded-[3px] object-cover ring-1 ring-line" />}
          {uploadError && <Notice tone="error">{uploadError}</Notice>}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button icon={<ImagePlus className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              {scene.backdrop ? "Replace image" : "Choose image"}
            </Button>
            <Button variant="ghost" onClick={() => studio.clearBackdrop(index)} disabled={!scene.backdrop}>
              Remove
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
