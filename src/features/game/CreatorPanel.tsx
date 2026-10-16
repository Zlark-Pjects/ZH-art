import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileUp, Hand, Plus, Trash2, Upload, X } from "lucide-react";
import { Button, cx, inputClass } from "../../ui";
import { propPreview } from "./art";
import {
  ART,
  PROP_DEFS,
  WORLD_FORMAT,
  cleanPack,
  cleanProp,
  cleanQuestion,
  propDef,
  type Pack,
  type ToolGroup,
  type WorldFile,
} from "./creator";
import { MAX_PROPS, type Game } from "./engine";
import type { Question } from "./data";

const GROUPS: ToolGroup[] = ["Build", "Play", "Nature", "Town", "Story", "Mine"];
const SWATCHES = ["#8e8b84", "#ef5a3c", "#ffb224", "#5fa35a", "#3fa7ff", "#9b6bff", "#ff6b8a", "#edeae3", "#3a3a42", "#a0723a"];

/** Reads an image file into a pack, scaled to a sensible size and re-encoded small. */
async function imageToPack(file: File): Promise<Pack> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That file isn't an image the browser can read"));
    i.src = url;
  });
  const s = Math.min(0.5, 180 / img.naturalHeight, 400 / img.naturalWidth);
  const w = Math.max(8, Math.round(img.naturalWidth * s));
  const h = Math.max(8, Math.round(img.naturalHeight * s));
  const canvas = document.createElement("canvas");
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w * 2, h * 2);
  const webp = canvas.toDataURL("image/webp", 0.9);
  const src = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  return { id: Math.random().toString(36).slice(2, 10), name: file.name.replace(/\.[^.]+$/, "").slice(0, 32) || "Picture", w, h, ax: w / 2, ay: h, solid: false, src };
}

export function worldFile(game: Game, name: string): WorldFile {
  const used = new Set(game.save.props.map((p) => p.kind));
  return {
    format: WORLD_FORMAT,
    version: 1,
    name,
    props: game.save.props,
    packs: game.save.packs.filter((p) => used.has(`pack:${p.id}`)),
    questions: game.save.myQuestions,
  };
}

/** Adds (or replaces with) a world file's contents. Returns a short summary. */
export function applyWorld(game: Game, raw: unknown, replace: boolean) {
  const r = raw as Partial<WorldFile>;
  if (r?.format !== WORLD_FORMAT) throw new Error("That isn't a Stickville world file");
  const packs = (Array.isArray(r.packs) ? r.packs : []).map(cleanPack).filter((p): p is Pack => !!p);
  const kinds = new Set([...Object.keys(PROP_DEFS), ...packs.map((p) => `pack:${p.id}`), ...game.save.packs.map((p) => `pack:${p.id}`)]);
  if (replace) game.save.props = [];
  const room = MAX_PROPS - game.save.props.length;
  const props = (Array.isArray(r.props) ? r.props : [])
    .slice(0, room)
    .map((p) => cleanProp(p, game.save.nextPropId++, kinds))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const questions = (Array.isArray(r.questions) ? r.questions : []).map(cleanQuestion).filter((q): q is Question => !!q);
  for (const p of packs) if (!game.save.packs.some((q) => q.id === p.id)) game.save.packs.push(p);
  game.save.props.push(...props);
  const have = new Set(game.save.myQuestions.map((q) => q.q));
  game.save.myQuestions.push(...questions.filter((q) => !have.has(q.q)).slice(0, 200));
  game.selected = null;
  game.refreshProps();
  return `${props.length} item${props.length === 1 ? "" : "s"}, ${packs.length} imported sprite${packs.length === 1 ? "" : "s"}, ${questions.length} question${questions.length === 1 ? "" : "s"}`;
}

export function CreatorPanel({
  game,
  tool,
  setTool,
  onChange,
  onClose,
  openDialog,
}: {
  game: Game;
  tool: string | null;
  setTool: (t: string | null) => void;
  onChange: () => void;
  onClose: () => void;
  openDialog: (d: "world" | "quiz") => void;
}) {
  const [group, setGroup] = useState<ToolGroup>("Build");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const packs = game.save.packs;
  const selected = game.save.props.find((p) => p.id === game.selected) ?? null;
  const def = selected ? propDef(selected.kind, packs) : null;

  const items = useMemo(() => {
    if (group === "Mine") return packs.map((p) => ({ kind: `pack:${p.id}`, label: p.name, img: p.src }));
    return Object.entries(PROP_DEFS)
      .filter(([, d]) => d.group === group)
      .map(([kind, d]) => ({ kind, label: d.label, img: ART.props[kind] ? propPreview(kind) : undefined }));
  }, [group, packs]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(id);
  }, [message]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        if (/\.json$/i.test(file.name) || file.type === "application/json") {
          const data = JSON.parse(await file.text());
          if (data?.format === WORLD_FORMAT) {
            setMessage(`World added: ${applyWorld(game, data, false)}.`);
            continue;
          }
          if (data?.format !== "stickville-pack" || !Array.isArray(data.items)) throw new Error(`${file.name} isn't a Stickville pack or world file`);
          for (const item of data.items) {
            const p = cleanPack({ ...item, id: Math.random().toString(36).slice(2, 10) });
            if (p) {
              packs.push(p);
              added++;
            }
          }
        } else {
          packs.push(await imageToPack(file));
          added++;
        }
      }
      if (added) {
        setGroup("Mine");
        setTool(`pack:${packs[packs.length - 1].id}`);
        setMessage(`Imported ${added} item${added > 1 ? "s" : ""}. Click the world to place ${added > 1 ? "them" : "it"}.`);
      }
      game.refreshProps();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't import that file");
    }
    if (fileRef.current) fileRef.current.value = "";
    onChange();
  };

  const update = (patch: Parameters<Game["updateProp"]>[1]) => {
    if (!selected) return;
    game.updateProp(selected.id, patch);
    onChange();
  };

  return (
    <section aria-label="Creator" className="border border-accent/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="eyebrow text-accent">Creator</span>
          <span className="truncate text-[13px] text-muted">
            {tool ? `Click the world to place: ${propDef(tool, packs)?.label ?? ""}` : "Drag items to move them, or drag empty space to look around"} · {game.save.props.length}/{MAX_PROPS} items
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <input ref={fileRef} type="file" aria-label="Import file" accept=".json,application/json,image/png,image/webp,image/jpeg,image/gif" multiple hidden onChange={(e) => void importFiles(e.target.files)} />
          <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} title="A .stickpack.json from the Blender add-on, a PNG, or a world file">
            Import
          </Button>
          <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => openDialog("world")}>
            World file
          </Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => openDialog("quiz")}>
            Quiz maker
          </Button>
          {confirmClear ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                game.save.props = [];
                game.selected = null;
                game.refreshProps();
                setConfirmClear(false);
                onChange();
              }}
            >
              Remove all {game.save.props.length}?
            </Button>
          ) : (
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmClear(true)} disabled={!game.save.props.length}>
              Clear
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2 [scrollbar-width:none]" role="tablist" aria-label="Item groups">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === group}
            onClick={() => setGroup(g)}
            className={cx("shrink-0 border-b-2 px-3 pb-2 text-[13px]", g === group ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {g === "Mine" ? `My imports (${packs.length})` : g}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto p-3" role="radiogroup" aria-label="Item to place">
        <ToolChip active={tool === null} label="Move" onClick={() => setTool(null)}>
          <Hand className="h-5 w-5" />
        </ToolChip>
        {items.map((it) => (
          <ToolChip key={it.kind} active={tool === it.kind} label={it.label} onClick={() => setTool(tool === it.kind ? null : it.kind)}>
            {it.img ? <img src={it.img} alt="" className="max-h-9 max-w-12 object-contain" /> : <Glyph kind={it.kind} />}
          </ToolChip>
        ))}
        {group === "Mine" && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-line-strong p-2 text-center text-[12px] text-muted hover:border-accent hover:text-fg"
          >
            <FileUp className="h-5 w-5" />
            Import from Blender or a PNG
          </button>
        )}
      </div>

      {message && (
        <p role="status" className="border-t border-line px-3 py-2 text-[13px] text-accent">
          {message}
        </p>
      )}

      {selected && def && (
        <div className="flex flex-col gap-3 border-t border-line p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 sm:w-56">
            <p className="text-[14px] font-medium">{def.label}</p>
            <p className="text-[12px] leading-snug text-muted">{def.hint}</p>
          </div>
          {(selected.kind === "sign" || selected.kind === "person") && (
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="eyebrow">{selected.kind === "sign" ? "Message" : "What they say"}</span>
              <input id="creator-text" className={inputClass} maxLength={200} value={selected.text ?? ""} onChange={(e) => update({ text: e.target.value })} />
            </label>
          )}
          {(selected.kind === "block" || selected.kind === "person" || selected.kind === "flag") && (
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Colour</span>
              <div className="flex flex-wrap gap-1">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={selected.color === c} onClick={() => update({ color: c })} className={cx("h-7 w-7 rounded-full ring-2", selected.color === c ? "ring-fg" : "ring-transparent")} style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
          {selected.kind === "block" && (
            <>
              <Stepper label="Width" value={selected.w ?? 120} min={20} max={1200} step={20} onChange={(w) => update({ w })} />
              <Stepper label="Height" value={selected.h ?? 40} min={10} max={600} step={10} onChange={(h) => update({ h })} />
            </>
          )}
          {selected.kind === "ramp" && (
            <Button size="sm" onClick={() => update({ dir: selected.dir === -1 ? 1 : -1 })}>
              Flip direction
            </Button>
          )}
          <div className="flex gap-1.5 sm:ml-auto">
            <Button
              size="sm"
              onClick={() => {
                game.duplicateProp(selected.id);
                onChange();
              }}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                game.removeProp(selected.id);
                onChange();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ToolChip({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-[3px] border p-2 text-[11px] transition-colors",
        active ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      <span className="flex h-9 items-center justify-center">{children}</span>
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}

function Glyph({ kind }: { kind: string }) {
  const box = "rounded-[2px]";
  switch (kind) {
    case "block":
      return <span className={cx(box, "h-4 w-9 bg-[#8e8b84] ring-1 ring-black/40")} />;
    case "ramp":
      return <span className="h-0 w-0 border-b-[18px] border-l-[36px] border-b-[#a0723a] border-l-transparent" />;
    case "trampoline":
      return <span className={cx(box, "h-2 w-9 border-x-4 border-[#ff6b8a] bg-[#3fa7ff]")} />;
    case "boost":
      return <span className="font-mono text-[15px] font-bold text-accent">»»</span>;
    case "coin":
      return <span className="h-5 w-5 rounded-full bg-accent ring-4 ring-inset ring-[#ffe08a]" />;
    case "start":
    case "finish":
      return <span className="h-5 w-9 bg-[repeating-conic-gradient(#edeae3_0_25%,#1d1d24_0_50%)] bg-[length:8px_8px]" />;
    case "sign":
      return <span className={cx(box, "bg-[#c9a26a] px-1.5 py-0.5 font-mono text-[9px] text-black")}>ABC</span>;
    case "person":
      return <span className="text-[22px] leading-none">웃</span>;
    case "flag":
      return <span className="h-4 w-6 border-l-2 border-[#5d5b56] bg-accent" />;
    default:
      return <span className="text-faint">?</span>;
  }
}

function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </Button>
        <span className="w-12 text-center font-mono text-[13px] tabular-nums">{value}</span>
        <Button size="sm" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </Button>
      </div>
    </div>
  );
}

/* ---------- Dialogs ---------- */

export function WorldDialog({ game, onDone }: { game: Game; onDone: () => void }) {
  const [name, setName] = useState(`${game.save.hero?.name ?? "My"}'s world`);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const json = useMemo(() => JSON.stringify(worldFile(game, name)), [game, name]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "world"}.stickworld.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setNote("Copied. Paste it to a friend: they open World file → paste → Add.");
    } catch {
      setText(json);
      setNote("Your browser blocked copying: the code is in the box below — select it all and copy.");
    }
  };
  const load = (replace: boolean) => {
    try {
      setNote(`Loaded ${applyWorld(game, JSON.parse(text), replace)}.`);
      setText("");
    } catch (e) {
      setNote(e instanceof Error && e.message.includes("Stickville") ? e.message : "That code isn't a complete world file. Paste the whole thing.");
    }
  };
  return (
    <div>
      <p className="eyebrow text-accent">Creator</p>
      <h3 className="mt-1 font-display text-3xl uppercase leading-none">World file</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        Save everything you've placed, your imported models and your quiz questions as one file. Share it, or keep it as a backup. {game.save.props.length} items right now.
      </p>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="eyebrow">World name</span>
        <input id="world-name" className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={download}>
          Save world file
        </Button>
        <Button icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>
          Copy as code
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-faint">If saving doesn't start (some embedded players block downloads), use Copy as code.</p>
      <label className="mt-6 flex flex-col gap-1.5">
        <span className="eyebrow">Paste a world code</span>
        <textarea id="world-code" className={cx(inputClass, "h-24 font-mono text-[11px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"format":"stickville-world", …}' />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={!text.trim()} onClick={() => load(false)}>
          Add to my world
        </Button>
        <Button variant="danger" disabled={!text.trim()} onClick={() => load(true)}>
          Replace my items
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onDone}>
          Close
        </Button>
      </div>
      {note && (
        <p role="status" className="mt-3 text-[13px] text-accent">
          {note}
        </p>
      )}
    </div>
  );
}

export function QuizMaker({ game, onDone }: { game: Game; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [why, setWhy] = useState("");
  const [, setN] = useState(0);
  const mine = game.save.myQuestions;
  const filled = options.filter((o) => o.trim());
  const valid = q.trim() && filled.length >= 2 && options[answer]?.trim();
  const add = () => {
    const opts = options.map((o) => o.trim());
    const kept = opts.filter(Boolean);
    const question = cleanQuestion({ q: q.trim(), options: kept, answer: kept.indexOf(opts[answer]), why: why.trim() });
    if (!question) return;
    mine.push(question);
    game.refreshProps();
    setQ("");
    setOptions(["", "", "", ""]);
    setAnswer(0);
    setWhy("");
    setN((n) => n + 1);
  };
  return (
    <div>
      <p className="eyebrow text-accent">Creator</p>
      <h3 className="mt-1 font-display text-3xl uppercase leading-none">Quiz maker</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">Write your own questions. They show up in the school quiz and on intel terminals, mixed in with the built-in ones.</p>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Question</span>
          <input id="quiz-q" className={inputClass} maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="How many legs does a spider have?" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Answers (pick the right one)">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" id={`quiz-right-${i}`} name="quiz-right" checked={answer === i} onChange={() => setAnswer(i)} aria-label={`Answer ${i + 1} is right`} />
              <input
                id={`quiz-opt-${i}`}
                className={inputClass}
                maxLength={80}
                value={o}
                onChange={(e) => setOptions(options.map((x, k) => (k === i ? e.target.value : x)))}
                placeholder={["Six", "Eight", "Ten", "Four"][i]}
                aria-label={`Answer ${i + 1}`}
              />
            </div>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Why (shown after answering)</span>
          <input id="quiz-why" className={inputClass} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Spiders are arachnids: eight legs, not six like insects." />
        </label>
        <div className="flex justify-between gap-2">
          <Button variant="primary" disabled={!valid} onClick={add} icon={<Plus className="h-4 w-4" />}>
            Add question
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
      {mine.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {mine.map((m, i) => (
            <li key={`${m.q}-${i}`} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0 text-[13px]">
                {m.q} <span className="text-ok">→ {m.options[m.answer]}</span>
              </span>
              <button
                type="button"
                aria-label={`Delete question: ${m.q}`}
                className="text-faint hover:text-danger"
                onClick={() => {
                  mine.splice(i, 1);
                  game.refreshProps();
                  setN((n) => n + 1);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
