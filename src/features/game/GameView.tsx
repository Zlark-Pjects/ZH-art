import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Crosshair, HelpCircle, Home, Maximize2, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { Button, cx, inputClass } from "../../ui";
import {
  BOTTOMS,
  BUILDINGS,
  BUILDING_ORDER,
  FACTS,
  HAIR_STYLES,
  HEADWEAR,
  HERO_PRESETS,
  MISSIONS,
  QUESTIONS,
  SKINS,
  VEHICLES,
  rankOf,
  type Hero,
  type Question,
} from "./data";
import { Game, MAX_USER_RAMPS, RAMP_COST, newSave, type GameEvent, type SaveData } from "./engine";
import { drawHero, render } from "./render";
import { setMuted } from "./audio";

const SAVE_KEY = "zh-art:stickville";
const MUTE_KEY = "zh-art:stickville-muted";

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = { ...newSave(), ...JSON.parse(raw) } as SaveData;
      if (s.v === 1 && Array.isArray(s.plots)) return s;
    }
  } catch {
    /* a broken save starts a new game */
  }
  return newSave();
}

function persist(s: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: the game still plays */
  }
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

type Modal =
  | { type: "creator" }
  | { type: "build"; plot: number }
  | { type: "building"; plot: number }
  | { type: "missions" }
  | { type: "quiz"; questions: Question[]; terminal?: number }
  | { type: "journal" }
  | { type: "help" }
  | { type: "mission-end"; ok: boolean; title: string; text: string };

export function GameView({ active }: { active: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [fact, setFact] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const onEvent = useCallback((e: GameEvent) => {
    const g = gameRef.current;
    if (!g) return;
    switch (e.type) {
      case "save":
        persist(g.save);
        break;
      case "build":
        setModal({ type: "build", plot: e.plot });
        break;
      case "building":
        // A building finishing shows its note; walking up to one shows it too
        setModal({ type: "building", plot: e.plot });
        break;
      case "missions":
        setModal({ type: "missions" });
        break;
      case "school":
        setModal({ type: "quiz", questions: shuffle(QUESTIONS).slice(0, 5) });
        break;
      case "intel":
        setModal({ type: "quiz", questions: shuffle(QUESTIONS).slice(0, 1), terminal: e.terminal });
        break;
      case "fact":
        setFact(e.index);
        break;
      case "mission-end":
        setModal({ type: "mission-end", ok: e.ok, title: e.title, text: e.text });
        break;
    }
  }, []);

  if (!gameRef.current) {
    gameRef.current = new Game(loadSave(), (e) => onEvent(e));
  }
  const game = gameRef.current;

  useEffect(() => {
    if (!game.save.hero) setModal({ type: "creator" });
  }, [game]);

  useEffect(() => setMuted(muted), [muted]);

  // Pause whenever a menu is open, the tab is hidden or the page is in the background
  useEffect(() => {
    game.paused = !active || !!modal;
  }, [active, modal, game]);

  // The frame loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let statT = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden || !active) return;
      game.update(dt);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      render(ctx, game, w, h, dpr);
      statT -= dt;
      if (statT <= 0 && wrapRef.current) {
        statT = 0.25;
        const d = wrapRef.current.dataset;
        d.coins = String(game.save.coins);
        d.x = String(Math.round(game.focus().x));
        d.vehicle = game.player.vehicle?.kind ?? "";
        d.mission = game.mission?.def.id ?? "";
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, active]);

  // Save when leaving the page
  useEffect(() => {
    const save = () => persist(game.save);
    window.addEventListener("pagehide", save);
    const id = window.setInterval(save, 15000);
    return () => {
      window.removeEventListener("pagehide", save);
      window.clearInterval(id);
      save();
    };
  }, [game]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    type Held = "left" | "right" | "up" | "down" | "fire";
    const map: Record<string, Held | undefined> = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", KeyF: "fire", KeyJ: "fire",
    };
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (modal) {
        if (e.key === "Escape" && (modal.type !== "creator" || game.save.hero)) setModal(null);
        return;
      }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const inp = game.input;
      const k = map[e.code];
      if (k) inp[k] = true;
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") inp.pressed.add("jump");
      if (e.code === "KeyE" || e.code === "Enter") inp.pressed.add("action");
      if (e.code === "KeyF" || e.code === "KeyJ") inp.pressed.add("fire");
      if (e.code === "KeyR") inp.pressed.add("ramp");
      if (e.code === "KeyH") inp.pressed.add("home");
      if (e.code === "KeyJ" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.code === "Space") inp.up = true;
    };
    const up = (e: KeyboardEvent) => {
      const inp = game.input;
      const k = map[e.code];
      if (k) inp[k] = false;
      if (e.code === "Space") inp.up = false;
    };
    const blur = () => Object.assign(game.input, { left: false, right: false, up: false, down: false, fire: false });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      blur();
    };
  }, [active, modal, game]);

  const close = () => {
    setModal(null);
    refresh();
  };

  const toggleMute = () => {
    setMutedState((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !m;
    });
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const rank = rankOf(game.save.xp);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-accent">Play</p>
          <h2 className="font-display text-4xl uppercase leading-none sm:text-5xl">Stickville</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            Build your town, ride bikes and cars, race the hills, run missions in the desert, and learn something on the way. Every coin you earn builds something new.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<UserRound className="h-4 w-4" />} onClick={() => setModal({ type: "creator" })}>
            Character
          </Button>
          <Button size="sm" icon={<BookOpen className="h-4 w-4" />} onClick={() => setModal({ type: "journal" })}>
            Journal
          </Button>
          <Button size="sm" icon={<HelpCircle className="h-4 w-4" />} onClick={() => setModal({ type: "help" })}>
            How to play
          </Button>
          <Button size="sm" variant="ghost" aria-label={muted ? "Sound on" : "Mute"} icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} onClick={toggleMute} />
          <Button size="sm" variant="ghost" aria-label="Full screen" icon={<Maximize2 className="h-4 w-4" />} onClick={fullscreen} />
        </div>
      </div>

      <div
        ref={wrapRef}
        data-testid="stickville"
        className="relative overflow-hidden rounded-[3px] border border-line bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Stickville game. ${game.save.hero?.name ?? "Hero"}, ${rank.name}, ${game.save.coins} coins.`}
          className="block aspect-[4/5] w-full touch-none select-none sm:aspect-video [:fullscreen_&]:h-screen [:fullscreen_&]:aspect-auto"
        />
        <TouchControls game={game} hidden={!!modal} />
        {fact !== null && <FactCard index={fact} onDone={() => setFact(null)} />}
        {modal && (
          <Overlay onClose={modal.type === "creator" && !game.save.hero ? undefined : close}>
            {modal.type === "creator" && (
              <Creator
                initial={game.save.hero}
                onDone={(h) => {
                  game.save.hero = h;
                  persist(game.save);
                  close();
                }}
              />
            )}
            {modal.type === "build" && <BuildMenu game={game} plot={modal.plot} onClose={close} />}
            {modal.type === "building" && <BuildingCard game={game} plot={modal.plot} onClose={close} />}
            {modal.type === "missions" && <MissionBoard game={game} onClose={close} />}
            {modal.type === "quiz" && (
              <Quiz
                questions={modal.questions}
                intel={modal.terminal !== undefined}
                onAnswer={(right) => {
                  if (modal.terminal !== undefined) game.answerIntel(modal.terminal, right);
                  else game.answerQuiz(right);
                  persist(game.save);
                }}
                onClose={close}
              />
            )}
            {modal.type === "journal" && <Journal save={game.save} />}
            {modal.type === "help" && <Help />}
            {modal.type === "mission-end" && (
              <div className="text-center">
                <p className={cx("eyebrow", modal.ok ? "text-ok" : "text-danger")}>{modal.ok ? "Mission complete" : "Mission failed"}</p>
                <h3 className="mt-2 font-display text-4xl uppercase">{modal.title}</h3>
                <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted">{modal.text}</p>
                <Button variant="primary" className="mt-6" onClick={close}>
                  Continue
                </Button>
              </div>
            )}
          </Overlay>
        )}
      </div>

      <p className="eyebrow text-faint">
        Keys: A/D or ←/→ move · W/Space jump · E use / get in &amp; out · W/S lean in the air · F fire · R ramp · H home. Progress saves in this browser.
      </p>
    </div>
  );
}

/* ---------- Overlay shell ---------- */

function Overlay({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center overflow-y-auto bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-2xl animate-rise overflow-y-auto border border-line bg-surface p-5 sm:max-h-[94%] sm:p-7"
      >
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function Heading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mb-5 pr-8">
      <p className="eyebrow text-accent">{eyebrow}</p>
      <h3 className="mt-1 font-display text-3xl uppercase leading-none sm:text-4xl">{children}</h3>
    </div>
  );
}

/* ---------- Character creator ---------- */

function HeroPreview({ hero, size = 160 }: { hero: Hero; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext("2d");
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      c.fillStyle = "rgba(237,234,227,0.06)";
      c.beginPath();
      c.ellipse(size / 2, size * 0.86, size * 0.26, 6, 0, 0, Math.PI * 2);
      c.fill();
      const pose = Math.floor(t / 2.5) % 2 ? "walk" : "wave";
      drawHero(c, hero, size / 2, size * 0.86, 1, t * 8, pose, size / 95);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hero, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label={`${hero.name || "Your hero"} preview`} role="img" />;
}

function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-label={`${label} ${o}`}
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={cx("h-7 w-7 rounded-full ring-2 transition", o === value ? "ring-fg" : "ring-transparent hover:ring-line-strong")}
            style={{ background: o }}
          />
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={label}>
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={cx(
              "rounded-[3px] border px-2.5 py-1.5 text-[13px] capitalize transition-colors",
              o === value ? "border-fg/80 bg-fg/[0.06] text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const COLORS = ["#ff6b8a", "#ef5a3c", "#ffb224", "#5fa35a", "#3fa7ff", "#2f3a68", "#9b6bff", "#edeae3", "#30343c"];
const HAIR_COLORS = ["#141010", "#3b2416", "#5a3a1a", "#b5562a", "#e0b860", "#c9c9c9", "#9b6bff", "#3fa7ff"];

function Creator({ initial, onDone }: { initial: Hero | null; onDone: (h: Hero) => void }) {
  const [hero, setHero] = useState<Hero>(initial ?? HERO_PRESETS[0].hero);
  const set = <K extends keyof Hero>(k: K, v: Hero[K]) => setHero((h) => ({ ...h, [k]: v }));
  const randomise = () => {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
    setHero((h) => ({
      ...h,
      hair: pick(HAIR_STYLES),
      hairColor: pick(HAIR_COLORS),
      headwear: pick(HEADWEAR),
      skin: pick(SKINS),
      top: pick(COLORS),
      bottom: pick(BOTTOMS),
      bottomColor: pick(COLORS),
    }));
  };
  return (
    <div>
      <Heading eyebrow={initial ? "Your hero" : "Welcome to Stickville"}>{initial ? "Change your look" : "Make your hero"}</Heading>
      <div className="grid gap-6 sm:grid-cols-[170px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="border border-line bg-ink">
            <HeroPreview hero={hero} />
          </div>
          <Button size="sm" variant="ghost" onClick={randomise}>
            Surprise me
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Start from</span>
            <div className="flex flex-wrap gap-1.5">
              {HERO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setHero({ ...p.hero, name: hero.name && !HERO_PRESETS.some((q) => q.hero.name === hero.name) ? hero.name : p.hero.name })}
                  className="rounded-full border border-line px-3 py-1 text-[13px] text-muted hover:border-line-strong hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Name</span>
            <input className={inputClass} value={hero.name} maxLength={16} onChange={(e) => set("name", e.target.value)} placeholder="Your name" aria-label="Hero name" />
          </label>
          <Choice label="Hair" value={hero.hair} options={HAIR_STYLES} onChange={(v) => set("hair", v)} />
          <Swatches label="Hair colour" value={hero.hairColor} options={HAIR_COLORS} onChange={(v) => set("hairColor", v)} />
          <Choice label="Headwear" value={hero.headwear} options={HEADWEAR} onChange={(v) => set("headwear", v)} />
          <Swatches label="Skin" value={hero.skin} options={SKINS} onChange={(v) => set("skin", v)} />
          <Swatches label="Top" value={hero.top} options={COLORS} onChange={(v) => set("top", v)} />
          <Choice label="Bottoms" value={hero.bottom} options={BOTTOMS} onChange={(v) => set("bottom", v)} />
          <Swatches label="Bottoms colour" value={hero.bottomColor} options={COLORS} onChange={(v) => set("bottomColor", v)} />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={() => onDone({ ...hero, name: hero.name.trim() || "Hero" })}>
          {initial ? "Save look" : "Start playing"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Build ---------- */

function BuildMenu({ game, plot, onClose }: { game: Game; plot: number; onClose: () => void }) {
  const coins = game.save.coins;
  return (
    <div>
      <Heading eyebrow={`Plot ${plot + 1} · ${coins} coins`}>Build something</Heading>
      <ul className="grid gap-2 sm:grid-cols-2">
        {BUILDING_ORDER.map((k) => {
          const b = BUILDINGS[k];
          const owned = game.save.plots.includes(k) && k !== "house" && k !== "park" && k !== "solar";
          const locked = b.needs && !game.has(b.needs);
          const afford = coins >= b.cost;
          const disabled = owned || !!locked || !afford;
          return (
            <li key={k}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => game.build(plot, k) && onClose()}
                aria-label={`Build ${b.label}`}
                className={cx(
                  "flex h-full w-full flex-col gap-1 rounded-[3px] border p-3 text-left transition-colors",
                  disabled ? "border-line opacity-50" : "border-line-strong hover:border-accent hover:bg-accent/[0.05]",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-[15px] font-medium">
                    <span className="h-3 w-3 rounded-sm" style={{ background: b.color }} aria-hidden />
                    {b.label}
                  </span>
                  <span className={cx("font-mono text-[12px]", afford ? "text-accent" : "text-danger")}>{b.cost}¢</span>
                </span>
                <span className="text-[13px] leading-snug text-muted">{b.does}</span>
                {owned && <span className="eyebrow text-faint">Already built</span>}
                {locked && <span className="eyebrow text-faint">Needs a {BUILDINGS[b.needs!].label.toLowerCase()}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13px] text-muted">Tip: houses, parks and solar farms pay income every minute — build them early and they pay for everything else.</p>
    </div>
  );
}

function BuildingCard({ game, plot, onClose }: { game: Game; plot: number; onClose: () => void }) {
  const k = game.save.plots[plot];
  if (!k) return null;
  const b = BUILDINGS[k];
  const unlocks = k === "garage" ? "car" : k === "barracks" ? "jeep" : k === "helipad" ? "heli" : null;
  return (
    <div>
      <Heading eyebrow={`Plot ${plot + 1}`}>{b.label}</Heading>
      <p className="text-[14px] leading-relaxed text-fg/90">{b.does}</p>
      {unlocks && <p className="mt-2 text-[14px] text-ok">Unlocked: {VEHICLES[unlocks].label}. {VEHICLES[unlocks].seats}.</p>}
      {k === "workshop" && <p className="mt-2 text-[14px] text-muted">Press R in the hills or desert to place a ramp ({RAMP_COST} coins, up to {MAX_USER_RAMPS}).</p>}
      <div className="mt-5 border-l-2 border-accent bg-accent/[0.05] px-4 py-3">
        <p className="eyebrow text-accent">Builder's note</p>
        <p className="mt-1 text-[14px] leading-relaxed text-fg/90">{b.fact}</p>
      </div>
      <div className="mt-6 flex justify-between gap-3">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            game.demolish(plot);
            onClose();
          }}
        >
          Demolish (+{Math.floor(b.cost / 2)}¢)
        </Button>
        <Button variant="primary" onClick={onClose}>
          Nice
        </Button>
      </div>
    </div>
  );
}

/* ---------- Missions ---------- */

function MissionBoard({ game, onClose }: { game: Game; onClose: () => void }) {
  const active = game.mission;
  return (
    <div>
      <Heading eyebrow={`Barracks · ${rankOf(game.save.xp).name}`}>Mission board</Heading>
      {active && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-accent/40 bg-accent/[0.05] px-4 py-3">
          <span className="text-[14px]">In progress: {active.def.title}</span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              game.abandonMission();
              onClose();
            }}
          >
            Abandon
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {MISSIONS.map((m, i) => {
          const done = game.save.done[m.id] ?? 0;
          const prev = MISSIONS[i - 1];
          const locked = (prev && !game.save.done[prev.id]) || !game.missionAvailable(m);
          return (
            <li key={m.id} className={cx("flex flex-col gap-3 rounded-[3px] border p-4 sm:flex-row sm:items-center", locked ? "border-line opacity-50" : "border-line-strong")}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3 text-[15px] font-medium">
                  <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {m.title}
                  {done > 0 && <span className="eyebrow text-ok">Done ×{done}</span>}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-muted">{m.brief}</p>
                <p className="mt-1 font-mono text-[11px] text-faint">
                  {m.time}s · +{m.reward}¢ · +{m.xp} XP{locked ? (m.needs && !game.has(m.needs) ? ` · needs a ${BUILDINGS[m.needs].label.toLowerCase()}` : " · finish the previous mission") : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant={locked ? "secondary" : "primary"}
                disabled={locked || !!active}
                onClick={() => {
                  game.startMission(m);
                  onClose();
                }}
              >
                {done ? "Replay" : "Start"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Quiz ---------- */

function Quiz({ questions, intel, onAnswer, onClose }: { questions: Question[]; intel: boolean; onAnswer: (right: boolean) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i];
  const finished = i >= questions.length;
  const order = useMemo(() => (q ? shuffle(q.options.map((_, k) => k)) : []), [q]);

  if (finished) {
    return (
      <div className="text-center">
        <Heading eyebrow="School">Quiz done</Heading>
        <p className="font-display text-6xl">
          {score}/{questions.length}
        </p>
        <p className="mt-2 text-[14px] text-muted">+{score * 8} coins and +{score * 6} XP. Come back any time for new questions.</p>
        <Button variant="primary" className="mt-6" onClick={onClose}>
          Back to town
        </Button>
      </div>
    );
  }

  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const right = k === q.answer;
    if (right) setScore((s) => s + 1);
    onAnswer(right);
  };

  return (
    <div>
      <Heading eyebrow={intel ? "Intel terminal · answer to unlock" : `School · question ${i + 1} of ${questions.length} · ${q.cat}`}>{intel ? "Enter the code" : "Quiz"}</Heading>
      <p className="text-[17px] leading-snug">{q.q}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {order.map((k) => {
          const isRight = k === q.answer;
          const show = picked !== null;
          return (
            <button
              key={k}
              type="button"
              disabled={show}
              onClick={() => choose(k)}
              className={cx(
                "rounded-[3px] border px-4 py-3 text-left text-[15px] transition-colors",
                !show && "border-line-strong hover:border-accent hover:bg-accent/[0.05]",
                show && isRight && "border-ok bg-ok/10 text-ok",
                show && !isRight && k === picked && "border-danger bg-danger/10 text-danger",
                show && !isRight && k !== picked && "border-line opacity-50",
              )}
            >
              {q.options[k]}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4" role="status">
          <p className={cx("text-[15px] font-medium", picked === q.answer ? "text-ok" : "text-danger")}>{picked === q.answer ? "Correct!" : "Not quite."}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{q.why}</p>
          <div className="mt-4 flex justify-end">
            {intel ? (
              <Button variant="primary" onClick={onClose}>
                {picked === q.answer ? "Download files" : "Try again later"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setI(i + 1);
                  setPicked(null);
                }}
              >
                {i + 1 < questions.length ? "Next question" : "See score"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Journal and help ---------- */

function Journal({ save }: { save: SaveData }) {
  const r = rankOf(save.xp);
  const missions = MISSIONS.filter((m) => save.done[m.id]).length;
  const stats = [
    ["Rank", r.name],
    ["XP", `${save.xp}${r.next ? ` / ${r.next}` : ""}`],
    ["Coins", save.coins],
    ["Buildings", save.plots.filter(Boolean).length],
    ["Missions", `${missions}/${MISSIONS.length}`],
    ["Quiz answers right", save.quizRight],
    ["Flips landed", save.flips],
    ["Best race", save.bestRace ? `${save.bestRace.toFixed(2)} s` : "—"],
  ];
  return (
    <div>
      <Heading eyebrow={save.hero?.name ?? "Hero"}>Journal</Heading>
      <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-surface p-3">
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-1 font-mono text-[15px]">{v}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-6 text-[15px] font-medium">
        Facts found <span className="font-mono text-[12px] text-muted">{save.facts.length}/{FACTS.length}</span>
      </h4>
      <p className="mt-1 text-[13px] text-muted">Glowing books are hidden around the world — some up high, so you'll need a ramp or a helicopter.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {FACTS.map((f, i) =>
          save.facts.includes(i) ? (
            <li key={i} className="border border-line p-3">
              <p className="text-[14px] font-medium text-accent">{f.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-fg/85">{f.text}</p>
            </li>
          ) : (
            <li key={i} className="border border-dashed border-line p-3 text-[13px] text-faint">
              ??? — not found yet
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function Help() {
  const rows = [
    ["Build", "Walk up to a FOR SALE plot in town and press E. Houses, parks and solar farms earn coins every minute; other buildings unlock vehicles, quizzes and missions."],
    ["Ride", "Press E next to a vehicle. A/D drive, W/S lean in the air. Land a full flip on the bike for stunt coins — land wheels-down or you'll wipe out."],
    ["Race", "Drive through the RACE START gate at the end of town and reach the FINISH flag at the end of the hills. Faster = more coins, and your average speed is shown."],
    ["Missions", "Build barracks, then press E at it for the mission board: recon, supply runs, drone drills, codebreaking, rescues, an airlift and a final defence."],
    ["Learn", "Build a school for quizzes (every answer explains itself), crack intel terminals with knowledge, and collect glowing fact books hidden around the world."],
    ["Fly", "Build a helipad (after barracks). In the helicopter, W climbs and S descends."],
    ["Help", "H takes you home and returns all vehicles to their spots. Health refills over time, or instantly at a hospital."],
  ];
  return (
    <div>
      <Heading eyebrow="Stickville">How to play</Heading>
      <dl className="divide-y divide-line border-y border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[6rem_1fr]">
            <dt className="text-[14px] font-medium">{k}</dt>
            <dd className="text-[13px] leading-relaxed text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 font-mono text-[12px] leading-relaxed text-faint">
        Keyboard: A/D or ←/→ move · W, ↑ or Space jump · E use · F fire · R ramp · H home. On a phone, use the buttons on screen.
      </p>
    </div>
  );
}

function FactCard({ index, onDone }: { index: number; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 7000);
    return () => window.clearTimeout(id);
  }, [index, onDone]);
  const f = FACTS[index];
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[5] max-w-xs animate-rise border border-accent/50 bg-surface/95 p-4 shadow-xl" role="status">
      <button type="button" className="absolute right-2 top-2 text-faint hover:text-fg" aria-label="Dismiss fact" onClick={onDone}>
        <X className="h-4 w-4" />
      </button>
      <p className="eyebrow text-accent">Did you know? · {f.title}</p>
      <p className="mt-1 pr-4 text-[13px] leading-snug">{f.text}</p>
    </div>
  );
}

/* ---------- Touch controls ---------- */

function TouchControls({ game, hidden }: { game: Game; hidden: boolean }) {
  const hold = (key: "left" | "right" | "up" | "down" | "fire", press?: "jump" | "fire") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      game.input[key] = true;
      if (press) game.input.pressed.add(press);
    },
    onPointerUp: () => (game.input[key] = false),
    onPointerCancel: () => (game.input[key] = false),
    onLostPointerCapture: () => (game.input[key] = false),
  });
  const tap = (press: "action" | "ramp" | "home") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      game.input.pressed.add(press);
    },
  });
  const btn = "flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm active:bg-accent active:text-ink select-none touch-none";
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 [@media(pointer:fine)]:hidden">
      <div className="pointer-events-auto flex gap-2">
        <button type="button" aria-label="Left" className={btn} {...hold("left")}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <button type="button" aria-label="Right" className={btn} {...hold("right")}>
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-2">
        <button type="button" aria-label="Home" className={cx(btn, "h-11 w-11 self-end")} {...tap("home")}>
          <Home className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Use" className={cx(btn, "font-mono text-lg font-semibold")} {...tap("action")}>
          E
        </button>
        <button type="button" aria-label="Jump" className={btn} {...hold("up", "jump")}>
          <ArrowUp className="h-6 w-6" />
        </button>
        <button type="button" aria-label="Ramp" className={cx(btn, "h-11 w-11 font-mono text-sm")} {...tap("ramp")}>
          R
        </button>
        <button type="button" aria-label="Fire" className={btn} {...hold("fire", "fire")}>
          <Crosshair className="h-6 w-6" />
        </button>
        <button type="button" aria-label="Down" className={btn} {...hold("down")}>
          <ArrowDown className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
