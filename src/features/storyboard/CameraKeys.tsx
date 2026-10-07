import { useState } from "react";
import { Diamond, Trash2 } from "lucide-react";
import type { CameraKey, Easing, Scene } from "../../types";
import type { Studio } from "../useStudio";
import { EASINGS } from "../../project/rig";
import { Button, IconButton, Segmented, Slider, cx, inputClass } from "../../ui";
import { sceneStarts } from "../timeline/timeline";
import { cameraAt } from "./sceneModel";

const round = (v: number, d = 100) => Math.round(v * d) / d;

/**
 * Hand-placed camera for one scene: keys at moments in the scene, each with
 * zoom, pan, rise and the easing into the next key. Editing shows the camera
 * at the playhead on the picture.
 */
export function CameraKeys({ studio, index, onPreview }: { studio: Studio; index: number; onPreview: (on: boolean) => void }) {
  const scene: Scene = studio.board.scenes[index];
  const keys = [...(scene.cameraKeys ?? [])].sort((a, b) => a.t - b.t);
  const [selected, setSelected] = useState(0);
  const key = keys[Math.min(selected, keys.length - 1)];
  const start = sceneStarts(studio.board.scenes).starts[index] ?? 0;

  const write = (next: CameraKey[]) => {
    studio.updateScene(index, { cameraKeys: next.sort((a, b) => a.t - b.t) });
    onPreview(true);
  };
  const seek = (t: number) => studio.playback.seek(start + Math.min(t, scene.duration - 0.01));

  const setKey = (patch: Partial<CameraKey>) => {
    if (!key) return;
    const next = keys.map((k) => (k === key ? { ...k, ...patch } : k));
    write(next);
    if (patch.t !== undefined) {
      setSelected([...next].sort((a, b) => a.t - b.t).findIndex((k) => k.t === patch.t));
      seek(patch.t);
    }
  };

  const add = () => {
    const t = round(Math.min(scene.duration, Math.max(0, studio.playback.elapsed)));
    const existing = keys.findIndex((k) => Math.abs(k.t - t) < 0.05);
    if (existing >= 0) return setSelected(existing);
    const cam = cameraAt(scene, t);
    const next = [...keys, { t, zoom: round(cam.zoom), x: round(cam.x, 10), y: round(cam.y, 10), easing: "smooth" as Easing }];
    write(next);
    setSelected([...next].sort((a, b) => a.t - b.t).findIndex((k) => k.t === t));
  };

  const remove = () => {
    if (!key) return;
    const next = keys.filter((k) => k !== key);
    studio.updateScene(index, { cameraKeys: next.length ? next : undefined });
    setSelected(Math.max(0, selected - 1));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Camera keys">
        {keys.map((k, n) => (
          <button
            key={`${k.t}-${n}`}
            type="button"
            role="listitem"
            aria-pressed={k === key}
            onClick={() => {
              setSelected(n);
              seek(k.t);
              onPreview(true);
            }}
            className={cx(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
              k === key ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg",
            )}
          >
            <Diamond className="h-3 w-3" /> {k.t.toFixed(1)}s
          </button>
        ))}
        <Button size="sm" onClick={add}>
          + Key at playhead
        </Button>
      </div>

      {key && (
        <div className="flex flex-col gap-4 border-l-2 border-accent/40 pl-4">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow text-fg">Key {keys.indexOf(key) + 1} of {keys.length}</span>
            <IconButton label="Delete this camera key" onClick={remove}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
          <Slider label="Time" value={key.t} min={0} max={scene.duration} step={0.05} onChange={(t) => setKey({ t: round(t) })} format={(v) => `${v.toFixed(2)}s`} />
          <Slider label="Zoom" value={key.zoom} min={0.8} max={2} step={0.01} onChange={(zoom) => setKey({ zoom })} format={(v) => `${v.toFixed(2)}×`} />
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Pan" value={key.x} min={-60} max={60} onChange={(x) => setKey({ x })} />
            <Slider label="Rise" value={key.y} min={-40} max={40} onChange={(y) => setKey({ y })} />
          </div>
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Into the next key</span>
            <select value={key.easing} onChange={(e) => setKey({ easing: e.target.value as Easing })} className={inputClass}>
              {EASINGS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label} — {e.hint.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="text-xs leading-relaxed text-faint">
        Move the playhead on the timeline, frame the shot with zoom, pan and rise, and add a key. The camera holds before the first key and after the last.
      </p>
    </div>
  );
}

/** Switch between a preset move and hand-placed keys. */
export function CameraModeSwitch({ studio, index, onPreview }: { studio: Studio; index: number; onPreview: (on: boolean) => void }) {
  const scene = studio.board.scenes[index];
  const keyed = Boolean(scene.cameraKeys?.length);
  return (
    <Segmented
      label="Camera"
      value={keyed ? "keys" : "preset"}
      onChange={(v) => {
        if (v === "keys" && !keyed) {
          // Start from the preset's own move, as two keys
          const m = scene.cameraMotion;
          studio.updateScene(index, {
            cameraKeys: [
              { t: 0, zoom: m.scaleStart, x: m.xStart, y: m.yStart, easing: "smooth" },
              { t: scene.duration, zoom: m.scaleEnd, x: m.xEnd, y: m.yEnd, easing: "smooth" },
            ],
          });
          onPreview(true);
        }
        if (v === "preset") {
          studio.updateScene(index, { cameraKeys: undefined });
          onPreview(false);
        }
      }}
      options={[
        { value: "preset", label: "Preset move" },
        { value: "keys", label: "Keyframes" },
      ]}
    />
  );
}
