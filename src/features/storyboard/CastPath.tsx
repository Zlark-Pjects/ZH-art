import { useState } from "react";
import { Diamond, Trash2 } from "lucide-react";
import type { CastKey, CastMember, Easing } from "../../types";
import type { Studio } from "../useStudio";
import { EASINGS } from "../../project/rig";
import { Button, IconButton, Segmented, Slider, cx, inputClass } from "../../ui";
import { sceneStarts } from "../timeline/timeline";
import { castPosition } from "./sceneModel";

const round = (v: number, d = 10) => Math.round(v * d) / d;

/** Add or move the key at `t` (within a frame or two) to a position. */
export function keyCastAt(member: CastMember, t: number, x: number, y: number): CastKey[] {
  const keys = member.path ?? [];
  const at = round(t, 100);
  const near = keys.findIndex((k) => Math.abs(k.t - at) < 0.06);
  if (near >= 0) return keys.map((k, i) => (i === near ? { ...k, x, y } : k));
  return [...keys, { t: at, x, y, easing: "smooth" as Easing }].sort((a, b) => a.t - b.t);
}

/**
 * A cast member's movement through the scene: position keys with easing.
 * Dragging the character on the picture keys its position at the playhead.
 */
export function CastPath({ studio, sceneIndex, castIndex }: { studio: Studio; sceneIndex: number; castIndex: number }) {
  const scene = studio.board.scenes[sceneIndex];
  const member = scene.cast?.[castIndex];
  const [selected, setSelected] = useState(0);
  if (!member) return null;
  const keys = [...(member.path ?? [])].sort((a, b) => a.t - b.t);
  const key = keys[Math.min(selected, keys.length - 1)];
  const start = sceneStarts(studio.board.scenes).starts[sceneIndex] ?? 0;
  const moving = keys.length > 0;

  const write = (patch: Partial<CastMember>) =>
    studio.updateScene(sceneIndex, (s) => ({ ...s, cast: (s.cast ?? []).map((m, i) => (i === castIndex ? { ...m, ...patch } : m)) }));
  const seek = (t: number) => studio.playback.seek(start + Math.min(t, scene.duration - 0.01));

  const setKey = (patch: Partial<CastKey>) => {
    if (!key) return;
    const next = keys.map((k) => (k === key ? { ...k, ...patch } : k)).sort((a, b) => a.t - b.t);
    write({ path: next });
    if (patch.t !== undefined) {
      setSelected(next.findIndex((k) => k.t === patch.t));
      seek(patch.t);
    }
  };

  const addAtPlayhead = () => {
    const t = Math.min(scene.duration, Math.max(0, studio.playback.elapsed));
    const pos = castPosition(member, t);
    const next = keyCastAt(member, t, round(pos.x), round(pos.y));
    write({ path: next });
    setSelected(next.findIndex((k) => Math.abs(k.t - round(t, 100)) < 0.06));
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <Segmented
        label="Movement"
        value={moving ? "moves" : "still"}
        onChange={(v) => {
          if (v === "moves" && !moving) {
            // Start with a walk across: from where it stands to a third of the frame further on
            const toX = member.x < 60 ? Math.min(95, member.x + 35) : Math.max(5, member.x - 35);
            write({
              path: [
                { t: 0, x: member.x, y: member.y, easing: "smooth" },
                { t: round(scene.duration, 100), x: toX, y: member.y, easing: "smooth" },
              ],
              faceTravel: member.faceTravel ?? true,
            });
            setSelected(0);
          }
          if (v === "still") write({ path: undefined });
        }}
        options={[
          { value: "still", label: "Stays put" },
          { value: "moves", label: "Moves" },
        ]}
      />
      {moving && (
        <>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Position keys">
            {keys.map((k, n) => (
              <button
                key={`${k.t}-${n}`}
                type="button"
                role="listitem"
                aria-pressed={k === key}
                onClick={() => {
                  setSelected(n);
                  seek(k.t);
                }}
                className={cx(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  k === key ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg",
                )}
              >
                <Diamond className="h-3 w-3" /> {k.t.toFixed(1)}s
              </button>
            ))}
            <Button size="sm" onClick={addAtPlayhead}>
              + Key at playhead
            </Button>
          </div>
          {key && (
            <div className="flex flex-col gap-4 border-l-2 border-accent/40 pl-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-fg">
                  Key {keys.indexOf(key) + 1} of {keys.length}
                </span>
                <IconButton
                  label="Delete this position key"
                  onClick={() => {
                    const next = keys.filter((k) => k !== key);
                    write({ path: next.length ? next : undefined, ...(next.length ? {} : { x: key.x, y: key.y }) });
                    setSelected(Math.max(0, selected - 1));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
              <Slider label="Time" value={key.t} min={0} max={scene.duration} step={0.05} onChange={(t) => setKey({ t: round(t, 100) })} format={(v) => `${v.toFixed(2)}s`} />
              <div className="grid grid-cols-2 gap-4">
                <Slider label="Across" value={key.x} min={-10} max={110} onChange={(x) => setKey({ x })} format={(v) => `${Math.round(v)}%`} />
                <Slider label="Feet at" value={key.y} min={20} max={110} onChange={(y) => setKey({ y })} format={(v) => `${Math.round(v)}%`} />
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
          <label className="flex items-center justify-between gap-4 text-[14px] text-fg">
            Face the way it moves
            <input type="checkbox" checked={member.faceTravel ?? true} onChange={(e) => write({ faceTravel: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
          </label>
          <p className="text-xs leading-relaxed text-faint">
            Move the playhead and drag the character on the picture: its position is keyed at that moment. Keys can go off-frame (below 0% or past 100%) for entrances and exits.
          </p>
        </>
      )}
    </div>
  );
}
