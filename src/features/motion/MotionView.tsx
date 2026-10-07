import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, Trash2 } from "lucide-react";
import type { CharacterLook, Easing, MotionId, RigClip } from "../../types";
import type { Studio } from "../useStudio";
import {
  DEFAULT_CHARACTER,
  EASINGS,
  INITIAL_JOINTS,
  MOTION_PRESETS,
  STANDING_POSE,
  clipLength,
  descendants,
  ease as easeFor,
  keyTimesOf,
  keyedPose,
  poseAt,
  type Pose,
} from "../../project/rig";
import { planOf } from "../../project/forge/plans";
import { newId } from "../../project/storage";
import { Button, Field, IconButton, Notice, RailTabs, Section, Segmented, Slider, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate } from "../../ui/FilmGate";
import { useMotionCapture } from "../mocap/useMotionCapture";
import { DEFAULT_CLEANUP, processTake, takeDuration, type CleanupOptions, type RawTake } from "../mocap/cleanup";
import { RigStage } from "./RigStage";
import { KeyTrack } from "./KeyTrack";
import { CapturePanel } from "./CapturePanel";

interface Key {
  id: string;
  time: number;
  pose: Pose;
  easing: Easing;
}

type Tab = "pose" | "keys" | "capture" | "clips";

const T_POSE: Pose = Object.fromEntries(INITIAL_JOINTS.map((j) => [j.id, { x: j.x, y: j.y }]));
const shift = (base: Pose, moves: Record<string, [number, number]>): Pose => ({
  ...base,
  ...Object.fromEntries(Object.entries(moves).map(([id, [x, y]]) => [id, { x, y }])),
});
const POSES: { id: string; label: string; pose: Pose }[] = [
  { id: "stand", label: "Stand", pose: STANDING_POSE },
  { id: "t", label: "T-pose", pose: T_POSE },
  {
    id: "action",
    label: "Action",
    pose: shift(T_POSE, {
      l_elbow: [100, 100], l_hand: [120, 60], r_elbow: [280, 200], r_hand: [310, 250], pelvis: [200, 280],
      l_knee: [130, 350], l_ankle: [110, 440], r_knee: [270, 390], r_ankle: [300, 450],
    }),
  },
  {
    id: "crouch",
    label: "Crouch",
    pose: shift(T_POSE, {
      pelvis: [200, 340], spine: [200, 300], neck: [200, 240], head: [200, 200], l_shoulder: [150, 250], r_shoulder: [250, 250],
      l_elbow: [100, 270], r_elbow: [300, 270], l_hand: [50, 290], r_hand: [350, 290], l_hip: [160, 350], r_hip: [240, 350],
      l_knee: [120, 400], r_knee: [280, 400], l_ankle: [140, 470], r_ankle: [260, 470],
    }),
  },
];

const clonePose = (p: Pose): Pose => Object.fromEntries(Object.entries(p).map(([id, v]) => [id, { ...v }]));

/**
 * Motion: pose a character on its skeleton, key it over time with per-key
 * easing, layer a procedural motion, or capture a performance from the
 * webcam or a video file. Clips saved here can be cast in any scene.
 */
export function MotionView({ studio }: { studio: Studio }) {
  const characters = studio.project.characters.length ? studio.project.characters : [DEFAULT_CHARACTER];
  const clips = studio.project.clips;
  const [characterId, setCharacterId] = useState(characters[0].id);
  const look: CharacterLook = characters.find((c) => c.id === characterId) ?? characters[0];
  const biped = planOf(look) === "biped";

  const [tab, setTab] = useState<Tab>("pose");
  const [base, setBase] = useState<Pose>(STANDING_POSE);
  const [keys, setKeys] = useState<Key[]>([]);
  const [length, setLength] = useState(2);
  const [motion, setMotion] = useState<MotionId | null>(null);
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeJoint, setActiveJoint] = useState<string | null>(null);
  const [onion, setOnion] = useState(true);
  const [follow, setFollow] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [take, setTake] = useState<RawTake | null>(null);
  const [cleanup, setCleanup] = useState<CleanupOptions>({ ...DEFAULT_CLEANUP, start: 0, end: 0 });

  const sorted = useMemo(() => [...keys].sort((a, b) => a.time - b.time), [keys]);
  const minLength = sorted.length ? sorted[sorted.length - 1].time + 0.05 : 0.5;
  const loopLength = Math.max(length, minLength);

  /** The clip as it would be saved. */
  const clip: RigClip = useMemo(
    () => ({
      id: editing ?? "draft",
      name: name || "Draft",
      pose: sorted[0]?.pose ?? base,
      motion,
      speed,
      intensity,
      keyframes: sorted.map((k) => k.pose),
      keyframeSeconds: sorted.length ? loopLength / sorted.length : 0.8,
      keyTimes: sorted.map((k) => Math.round(k.time * 1000) / 1000),
      keyEasing: sorted.map((k) => k.easing),
      length: Math.round(loopLength * 1000) / 1000,
    }),
    [editing, name, sorted, base, motion, speed, intensity, loopLength],
  );

  /* ----- webcam ----- */
  const mocap = useMotionCapture((frames, seconds) => {
    loadTake({ frames, times: frames.map((_, i) => Math.round(i * seconds * 1000) / 1000), source: "webcam" });
  });

  const loadTake = (t: RawTake) => {
    const end = takeDuration(t);
    const opts = { ...cleanup, start: 0, end };
    setTake(t);
    setCleanup(opts);
    applyTake(t, opts);
    setTab("capture");
  };

  const applyTake = (t: RawTake, opts: CleanupOptions) => {
    const out = processTake(t, opts);
    if (!out) return;
    setKeys(out.keys.map((pose, i) => ({ id: newId("key"), time: out.keyTimes[i], pose, easing: "linear" as Easing })));
    setLength(out.length);
    setMotion(null);
    setSelected(null);
    setTime(0);
  };

  const patchCleanup = (patch: Partial<CleanupOptions>) => {
    const next = { ...cleanup, ...patch };
    setCleanup(next);
    if (take) applyTake(take, next);
  };

  /* ----- playback ----- */
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => (t + dt) % loopLength);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, loopLength]);

  const togglePlay = () => {
    setSelected(null);
    setPlaying((p) => !p);
  };

  /* ----- what the stage shows ----- */
  // While the camera runs, the rig follows the performer (unless you're playing back keys)
  const live = mocap.status === "tracking" && (mocap.recordState !== "idle" || !playing) ? mocap.livePose.current : null;
  const selectedKey = sorted.find((k) => k.id === selected) ?? null;
  const editingPose: Pose = selectedKey ? selectedKey.pose : keys.length ? keyedPose(clip, time) ?? base : base;
  const shown: Pose = live ?? (playing ? poseAt(clip, time) : selectedKey ? selectedKey.pose : motion && !keys.length ? poseAt(clip, time) : editingPose);

  // Re-render while the camera is live, so the rig follows the performer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (mocap.status !== "tracking") return;
    let raf = 0;
    const loop = () => {
      setTick((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mocap.status]);

  const ghosts = useMemo(() => {
    if (!onion || playing || sorted.length < 2) return [];
    const at = selectedKey ? selectedKey.time : time;
    const before = [...sorted].reverse().find((k) => k.time < at - 1e-3) ?? sorted[sorted.length - 1];
    const after = sorted.find((k) => k.time > at + 1e-3) ?? sorted[0];
    const out: { pose: Pose; tone: "before" | "after" }[] = [];
    if (before && before.id !== selected) out.push({ pose: before.pose, tone: "before" });
    if (after && after.id !== selected && after.id !== before?.id) out.push({ pose: after.pose, tone: "after" });
    return out;
  }, [onion, playing, sorted, selectedKey, selected, time]);

  /* ----- editing ----- */
  /** Make sure there's a key to edit at the playhead (or edit the base pose without keys). */
  const keyForEdit = useCallback((): string | null => {
    if (!keys.length) return null;
    if (selected) return selected;
    const near = keys.find((k) => Math.abs(k.time - time) < 1 / 48);
    if (near) {
      setSelected(near.id);
      return near.id;
    }
    const k: Key = { id: newId("key"), time: Math.round(time * 24) / 24, pose: clonePose(keyedPose(clip, time) ?? base), easing: "smooth" };
    setKeys((ks) => [...ks, k]);
    setSelected(k.id);
    return k.id;
  }, [keys, selected, time, clip, base]);

  const dragKeyRef = useRef<string | null>(null);
  const onDrag = (id: string, x: number, y: number) => {
    setPlaying(false);
    const apply = (p: Pose): Pose => {
      const dx = x - p[id].x;
      const dy = y - p[id].y;
      const next = { ...p, [id]: { x, y } };
      if (follow) for (const c of descendants(id)) next[c] = { x: p[c].x + dx, y: p[c].y + dy };
      return next;
    };
    if (!keys.length) {
      setBase((b) => apply(b));
      return;
    }
    if (!dragKeyRef.current) dragKeyRef.current = keyForEdit();
    const target = dragKeyRef.current;
    setKeys((ks) => ks.map((k) => (k.id === target ? { ...k, pose: apply(k.pose) } : k)));
  };

  const setPoseEverywhere = (pose: Pose) => {
    setPlaying(false);
    if (!keys.length) {
      setBase(clonePose(pose));
      return;
    }
    const target = keyForEdit();
    setKeys((ks) => ks.map((k) => (k.id === target ? { ...k, pose: clonePose(pose) } : k)));
  };

  const addKey = () => {
    setPlaying(false);
    const at = Math.round(time * 24) / 24;
    const existing = keys.find((k) => Math.abs(k.time - at) < 1 / 48);
    if (existing) return setSelected(existing.id);
    const k: Key = { id: newId("key"), time: at, pose: clonePose(keys.length ? keyedPose(clip, time) ?? base : base), easing: "smooth" };
    setKeys((ks) => [...ks, k]);
    setSelected(k.id);
    if (keys.length === 0 && length < 1) setLength(2);
  };

  const deleteKey = () => {
    if (!selected) return;
    setKeys((ks) => ks.filter((k) => k.id !== selected));
    setSelected(null);
  };

  const selectKey = (id: string | null) => {
    setPlaying(false);
    setSelected(id);
    const k = keys.find((x) => x.id === id);
    if (k) setTime(k.time);
  };

  const retime = (id: string, t: number) => setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, time: Math.max(0, Math.min(loopLength, t)) } : k)));
  const patchKey = (patch: Partial<Key>) => selected && setKeys((ks) => ks.map((k) => (k.id === selected ? { ...k, ...patch } : k)));

  const reset = () => {
    setBase(STANDING_POSE);
    setKeys([]);
    setMotion(null);
    setSelected(null);
    setTime(0);
    setPlaying(false);
    setEditing(null);
    setName("");
    setTake(null);
    setLength(2);
  };

  /* ----- clips ----- */
  const save = (asNew: boolean) => {
    const id = asNew || !editing ? newId("clip") : editing;
    const fallback = MOTION_PRESETS.find((m) => m.id === motion)?.name ?? (take ? "Captured take" : keys.length ? "Keyed motion" : "Pose");
    const finalName = name.trim() || (editing && !asNew ? clips.find((c) => c.id === editing)?.name : "") || `${fallback} ${clips.length + 1}`;
    studio.upsertClip({ ...clip, id, name: finalName, pose: { ...STANDING_POSE, ...clip.pose } });
    setEditing(id);
    setName(finalName);
    setSavedNote(`Saved “${finalName}”. Cast it into a scene from the Storyboard's Scene panel.`);
  };

  const load = (c: RigClip) => {
    const times = keyTimesOf(c);
    setPlaying(false);
    setBase(clonePose(c.pose));
    setKeys(c.keyframes.map((pose, i) => ({ id: newId("key"), time: times[i], pose: clonePose({ ...c.pose, ...pose }), easing: c.keyEasing?.[i] ?? "smooth" })));
    setLength(c.keyframes.length ? clipLength(c) : 2);
    setMotion(c.motion);
    setSpeed(c.speed);
    setIntensity(c.intensity);
    setEditing(c.id);
    setName(c.name);
    setSelected(null);
    setTime(0);
    setTake(null);
    setSavedNote("");
  };

  useEffect(() => {
    if (!savedNote) return;
    const t = setTimeout(() => setSavedNote(""), 5000);
    return () => clearTimeout(t);
  }, [savedNote]);

  /* ----- layout ----- */
  const source = live ? "Live capture" : playing ? "Playing" : selectedKey ? `Editing key ${sorted.indexOf(selectedKey) + 1}` : keys.length ? "Drag a joint to key the pose here" : "Drag the joints to pose";

  const stage = (
    <FilmGate aspect="aspect-[4/3] sm:aspect-video" slate={`${look.name}${editing ? ` · ${clips.find((c) => c.id === editing)?.name ?? ""}` : ""}`} meta={source}>
      <RigStage
        pose={shown}
        look={look}
        time={time}
        showFigure={biped}
        editable={!live}
        ghosts={ghosts}
        activeJoint={activeJoint}
        onPick={setActiveJoint}
        onDrag={onDrag}
        onDrop={() => (dragKeyRef.current = null)}
      />
    </FilmGate>
  );

  const below = (
    <KeyTrack
      keys={sorted}
      length={loopLength}
      time={time}
      playing={playing}
      selected={selected}
      onion={onion}
      onToggle={togglePlay}
      onSeek={(t) => {
        setPlaying(false);
        setTime(t);
      }}
      onSelect={selectKey}
      onRetime={retime}
      onAdd={addKey}
      onDelete={deleteKey}
      onOnion={() => setOnion((o) => !o)}
    />
  );

  const rail = (
    <div>
      <RailTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pose", label: "Pose" },
          { value: "keys", label: "Keys" },
          { value: "capture", label: "Capture" },
          { value: "clips", label: "Clips" },
        ]}
      />

      {tab === "pose" && (
        <div>
          <Section index="01" title="Character">
            <div className="flex flex-col gap-3">
              <label htmlFor="mo-char" className="sr-only">Character</label>
              <select id="mo-char" value={look.id} onChange={(e) => setCharacterId(e.target.value)} className={inputClass}>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {planOf(c) !== "biped" ? " (not two-legged)" : ""}
                  </option>
                ))}
              </select>
              {!biped && (
                <Notice>
                  Motion clips drive two-legged characters. Four-legged, flying, serpent and floating characters bring their own idle, walk, run, jump and attack to scenes. You can still key the skeleton here and use it on a two-legged character.
                </Notice>
              )}
            </div>
          </Section>
          <Section index="02" title="Start from" aside={selectedKey ? `Key ${sorted.indexOf(selectedKey) + 1}` : keys.length ? "Key at playhead" : "Pose"}>
            <div className="grid grid-cols-4 gap-1.5">
              {POSES.map((p) => (
                <Button key={p.id} size="sm" onClick={() => setPoseEverywhere(p.pose)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <label className="mt-4 flex items-center justify-between gap-4 text-[14px] text-fg">
              <span>
                Limbs move together
                <span className="block text-xs text-faint">Dragging a shoulder carries the elbow and hand with it</span>
              </span>
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            </label>
          </Section>
          <Section index="03" title="Motion layer" aside="Plays over the keys">
            <div className="flex flex-col gap-4">
              <Segmented
                label="Motion"
                value={motion ?? "none"}
                onChange={(v) => {
                  setMotion(v === "none" ? null : (v as MotionId));
                  if (v !== "none") {
                    setSelected(null);
                    setPlaying(true);
                  }
                }}
                columns={3}
                options={[{ value: "none", label: "None" }, ...MOTION_PRESETS.map((m) => ({ value: m.id, label: m.name, hint: m.description }))]}
              />
              {motion && (
                <>
                  <Slider label="Speed" value={speed} min={0.25} max={3} step={0.05} onChange={setSpeed} format={(v) => `${v.toFixed(2)}×`} />
                  <Slider label="Strength" value={intensity} min={0} max={2} step={0.05} onChange={setIntensity} format={(v) => `${Math.round(v * 100)}%`} />
                </>
              )}
            </div>
          </Section>
          <div className="border-t border-line pt-6 pb-8">
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div>
          {selectedKey ? (
            <Section
              index="01"
              title={`Key ${sorted.indexOf(selectedKey) + 1} of ${sorted.length}`}
              aside={
                <span className="flex items-center">
                  <IconButton
                    label="Duplicate this key at the playhead + 0.5 s"
                    onClick={() => {
                      const k: Key = { ...selectedKey, id: newId("key"), time: Math.min(loopLength, selectedKey.time + 0.5), pose: clonePose(selectedKey.pose) };
                      setKeys((ks) => [...ks, k]);
                      if (k.time >= loopLength) setLength(loopLength + 0.5);
                      selectKey(k.id);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Delete this key" onClick={deleteKey}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </span>
              }
            >
              <div className="flex flex-col gap-5">
                <Slider label="Time" value={selectedKey.time} min={0} max={loopLength} step={1 / 24} onChange={(v) => { patchKey({ time: v }); setTime(v); }} format={(v) => `${v.toFixed(2)}s`} />
                <Segmented
                  label="Into the next key"
                  value={selectedKey.easing}
                  onChange={(easing) => patchKey({ easing })}
                  columns={2}
                  options={EASINGS.map((e) => ({ value: e.id, label: e.label, hint: e.hint }))}
                />
                <EasingCurve kind={selectedKey.easing} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => setKeys((ks) => ks.map((k) => ({ ...k, easing: selectedKey.easing })))}
                >
                  Use {EASINGS.find((e) => e.id === selectedKey.easing)?.label.toLowerCase()} on every key
                </Button>
              </div>
            </Section>
          ) : (
            <Section index="01" title="Keys">
              <p className="text-[13px] leading-relaxed text-muted">
                {keys.length
                  ? "Pick a diamond on the track to set its timing and easing. Drag joints to change the pose at the playhead; a key is added there if there isn't one."
                  : "Move the playhead, pose the character and press Key. Each key stores a whole pose; the rig moves between them with the easing you choose."}
              </p>
            </Section>
          )}
          <Section index="02" title="Loop">
            <div className="flex flex-col gap-4">
              <Slider label="Length" value={loopLength} min={Math.max(0.5, Math.ceil(minLength * 10) / 10)} max={Math.max(10, Math.ceil(minLength))} step={0.1} onChange={setLength} format={(v) => `${v.toFixed(1)}s`} />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={keys.length < 2}
                  onClick={() => setKeys(sorted.map((k, i) => ({ ...k, time: Math.round(((i * loopLength) / sorted.length) * 1000) / 1000 })))}
                >
                  Space keys evenly
                </Button>
                <Button size="sm" variant="ghost" disabled={!keys.length} onClick={() => { setKeys([]); setSelected(null); setTake(null); }}>
                  Clear keys
                </Button>
              </div>
              <p className="text-xs text-faint">The last key eases back into the first, so clips loop when cast in a scene.</p>
            </div>
          </Section>
        </div>
      )}

      {tab === "capture" && (
        <CapturePanel
          mocap={mocap}
          take={take}
          cleanup={cleanup}
          onCleanup={patchCleanup}
          onTake={loadTake}
          onPose={(pose) => setPoseEverywhere(pose)}
          keyCount={keys.length}
        />
      )}

      {tab === "clips" && (
        <div>
          <Section index="01" title={editing ? "Update clip" : "Save as clip"} aside={`${clips.length} in project`}>
            <div className="flex flex-col gap-4">
              <Field label="Name" htmlFor="clip-name">
                <input id="clip-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hero lands a kick" className={inputClass} />
              </Field>
              <p className="text-xs text-faint">
                {keys.length ? `${keys.length} keys over ${loopLength.toFixed(1)}s` : "A still pose"}
                {motion ? `, with ${MOTION_PRESETS.find((m) => m.id === motion)?.name.toLowerCase()} on top` : ""}.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => save(false)}>
                  {editing ? "Update clip" : "Save clip"}
                </Button>
                {editing && <Button onClick={() => save(true)}>Save as new</Button>}
              </div>
              {savedNote && <Notice>{savedNote}</Notice>}
            </div>
          </Section>
          <Section index="02" title="Clips in this project">
            {clips.length ? (
              <ul className="flex flex-col divide-y divide-line border-y border-line">
                {clips.map((c) => (
                  <li key={c.id} className={cx("flex items-center gap-2 py-2", c.id === editing && "text-accent")}>
                    <button type="button" onClick={() => load(c)} className="min-w-0 flex-1 truncate text-left text-[14px] hover:underline">
                      {c.name}
                    </button>
                    <span className="eyebrow text-faint">{c.keyframes.length ? `${c.keyframes.length} keys` : c.motion ? "motion" : "pose"}</span>
                    <IconButton label={`Delete ${c.name}`} onClick={() => { studio.removeClip(c.id); if (editing === c.id) setEditing(null); }}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No clips yet.</p>
            )}
            <p className="mt-3 text-xs text-faint">Click a clip to load it onto the rig.</p>
          </Section>
        </div>
      )}
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} below={below} />;
}

/** A small plot of the easing curve. */
function EasingCurve({ kind }: { kind: Easing }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const k = i / 40;
    return `${(k * 100).toFixed(1)},${(70 - easeFor(kind, k) * 50).toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="-4 0 108 90" className="h-24 w-full border border-line bg-surface" aria-hidden>
      <line x1="0" x2="100" y1="70" y2="70" stroke="#ffffff" strokeOpacity="0.1" />
      <line x1="0" x2="100" y1="20" y2="20" stroke="#ffffff" strokeOpacity="0.1" />
      <polyline points={pts} fill="none" stroke="#ffb224" strokeWidth="2" />
    </svg>
  );
}
