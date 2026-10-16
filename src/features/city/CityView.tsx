import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, Crosshair, Hammer, Maximize2, RotateCw, Smartphone, Trash2, Upload, Volume2, VolumeX, Zap } from "lucide-react";
import { Button, cx, inputClass } from "../../ui";
import { CONTACTS, HARD_QUESTIONS, MISSIONS, PLOTS, PLOT_ORDER, QUESTIONS, RACES, UPGRADES, type ContactId, type Question, type UpgradeId } from "./data";
import { City, newSave, type CityEvent, type Pack, type Save } from "./engine";
import { render, previewUrl } from "./render";
import { preload } from "./art";
import { setMuted, sfx } from "./audio";
import { Radio, type Station } from "./music";
import { K, ART } from "./map";
import { Phone, type App } from "./Phone";
import { STICKERS } from "./extras";
import { HeroEditor, HeroPreview, Heading, Overlay, Quiz, shuffle } from "./ui";

const SAVE_KEY = "zh-art:stickcity";
const MUTE_KEY = "zh-art:stickcity-muted";
const PHOTO_KEY = "zh-art:stickcity-photos";
const FILTERS: [string, string][] = [["None", "none"], ["Warm", "sepia(0.35) saturate(1.3) brightness(1.05)"], ["Vivid", "saturate(1.7) contrast(1.1)"], ["Mono", "grayscale(1) contrast(1.15)"], ["Dream", "brightness(1.1) saturate(1.3) hue-rotate(-20deg) blur(0.4px)"], ["Night", "hue-rotate(190deg) saturate(1.4) brightness(0.85)"]];

function loadPhotos(): string[] {
  try {
    const p = JSON.parse(localStorage.getItem(PHOTO_KEY) ?? "[]");
    return Array.isArray(p) ? p.filter((x) => typeof x === "string" && x.startsWith("data:image/")) : [];
  } catch {
    return [];
  }
}

function savePhotos(list: string[]) {
  // Drop the oldest photos until they fit in the browser's storage
  for (let n = list.length; n >= 0; n--) {
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(list.slice(list.length - n)));
      return list.slice(list.length - n);
    } catch {
      /* too big: try with one fewer */
    }
  }
  return [];
}

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = { ...newSave(), ...JSON.parse(raw) } as Save;
      if (s.v === 2 && Array.isArray(s.plots)) return s;
    }
  } catch {
    /* a broken save starts a new game */
  }
  return newSave();
}

function persist(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

type Modal =
  | { type: "hero"; mode: "new" | "edit" | "shop" }
  | { type: "talk"; id: ContactId; lines: string[]; done?: string; riddle?: Question }
  | { type: "riddle"; id: ContactId; question: Question }
  | { type: "plot"; index: number }
  | { type: "shop"; shop: "mods" | "armory" }
  | { type: "quiz"; title: string; eyebrow: string; questions: Question[]; hard: boolean; cafe?: boolean }
  | { type: "terminal"; index: number; question: Question }
  | { type: "result"; ok: boolean; title: string; text: string; stars?: number }
  | { type: "world" }
  | { type: "quiz-maker" };

export function CityView({ active }: { active: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<City | null>(null);
  const radio = useMemo(() => new Radio(), []);
  const [modal, setModal] = useState<Modal | null>(null);
  const [phone, setPhone] = useState(false);
  const [app, setApp] = useState<App>("home");
  const [tool, setTool] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [photo, setPhoto] = useState<{ filter: number } | null>(null);
  const photoRef = useRef<{ filter: number } | null>(null);
  photoRef.current = photo;
  const [photos, setPhotos] = useState<string[]>(loadPhotos);
  const [flash, setFlash] = useState(false);
  const [sticker, setSticker] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const snapRef = useRef<() => void>(() => {});
  const exitCameraRef = useRef<() => void>(() => {});
  const [, setTick] = useState(0);
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const warned = useRef(0);

  const onEvent = useCallback((e: CityEvent) => {
    const g = gameRef.current;
    if (!g) return;
    switch (e.type) {
      case "save":
        if (!persist(g.save) && performance.now() - warned.current > 15000) {
          warned.current = performance.now();
          g.toast("Can't save: browser storage is full. Remove some Builder imports.", "#ff5a4e");
        }
        break;
      case "talk": {
        const r = g.talk(e.id);
        setModal({ type: "talk", id: e.id, lines: r.lines, done: r.done, riddle: r.riddle });
        break;
      }
      case "plot":
        setModal({ type: "plot", index: e.index });
        break;
      case "shop":
        setModal(e.shop === "style" ? { type: "hero", mode: "shop" } : { type: "shop", shop: e.shop });
        break;
      case "trivia":
        setModal({ type: "quiz", title: e.hard ? "Brain challenge" : "Trivia", eyebrow: e.hard ? "Dr. Lin" : "Quick quiz", questions: pickQuestions(g.save, e.hard), hard: e.hard });
        break;
      case "terminal":
        setModal({ type: "terminal", index: e.index, question: e.question });
        break;
      case "sticker":
        setSticker(e.index);
        break;
      case "result":
        setModal({ type: "result", ok: e.ok, title: e.title, text: e.text, stars: e.stars });
        break;
    }
  }, []);

  if (!gameRef.current) gameRef.current = new City(loadSave(), (e) => onEvent(e));
  const game = gameRef.current;

  useEffect(() => {
    // ?cheats exposes the game in the console (and to the end-to-end tests)
    try {
      if (new URLSearchParams(location.search).has("cheats")) Object.assign(window, { stickcity: game, stickcityData: { MISSIONS, RACES } });
    } catch {
      /* ignore */
    }
    preload();
    if (!game.save.hero) setModal({ type: "hero", mode: "new" });
  }, [game]);
  useEffect(() => setMuted(muted), [muted]);
  useEffect(() => {
    game.paused = !active || !!modal || phone || !!photo;
  }, [active, modal, phone, photo, game]);
  useEffect(() => {
    if (!active) radio.stop();
  }, [active, radio]);
  useEffect(() => () => radio.stop(), [radio]);
  useEffect(() => {
    game.builder = building;
    if (!building) {
      game.ghost = null;
      game.selected = null;
      game.camOffset = { x: 0, y: 0 };
      setTool(null);
    }
  }, [building, game]);

  // Frame loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let statT = 0;
    let inside = false;
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
      render(ctx, game, w, h, dpr, { hud: !photoRef.current });
      const nowInside = !!game.player.vehicle;
      if (nowInside !== inside) {
        inside = nowInside;
        radio.setInside(inside);
      }
      statT -= dt;
      if (statT <= 0 && wrapRef.current) {
        statT = 0.25;
        const d = wrapRef.current.dataset;
        const f = game.focus();
        d.money = String(game.save.money);
        d.x = String(Math.round(f.x));
        d.y = String(Math.round(f.y));
        d.vehicle = game.player.vehicle?.kind ?? "";
        d.mission = game.mission?.def.id ?? "";
        d.props = String(game.save.props.length);
        d.prompt = game.prompt?.text ?? "";
        const n = game.extras.unread();
        setUnread((u) => (u === n ? u : n));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, active, radio]);

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

  const startRadio = useCallback(
    (s: Station) => {
      game.save.station = s;
      radio.play(s);
      persist(game.save);
      refresh();
    },
    [game, radio, refresh],
  );

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const held: Record<string, "up" | "down" | "left" | "right" | "brake" | "boost" | "fire" | undefined> = {
      KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
      Space: "brake", ShiftLeft: "boost", ShiftRight: "boost", KeyF: "fire",
    };
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    };
    let radioStarted = false;
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (modal) {
        if (e.key === "Escape" && !(modal.type === "hero" && modal.mode === "new")) setModal(null);
        return;
      }
      if (photoRef.current) {
        if (e.key === "Escape") exitCameraRef.current();
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          snapRef.current();
        }
        return;
      }
      if (e.code === "Tab" || e.code === "KeyP") {
        e.preventDefault();
        setPhone((p) => !p);
        setApp("home");
        return;
      }
      if (e.code === "KeyM") {
        setPhone(true);
        setApp("map");
        return;
      }
      if (phone) {
        if (e.key === "Escape") setPhone(false);
        return;
      }
      if (!radioStarted && game.save.station !== "off") {
        radioStarted = true;
        radio.play(game.save.station);
      }
      if (game.builder) {
        if ((e.key === "Delete" || e.key === "Backspace") && game.selected !== null) {
          game.save.props = game.save.props.filter((q) => q.id !== game.selected);
          game.selected = null;
          game.refreshProps();
          refresh();
          e.preventDefault();
          return;
        }
        if (e.code === "KeyR" && game.selected !== null) {
          const q = game.save.props.find((r) => r.id === game.selected);
          if (q && q.heading !== undefined) q.heading = (q.heading + 1) % 16;
          refresh();
          return;
        }
        if (e.key === "Escape") {
          if (tool) setTool(null);
          else setBuilding(false);
          return;
        }
      }
      const k = held[e.code];
      if (k) game.input[k] = true;
      if (e.code === "KeyE" || e.code === "Enter") game.input.pressed.add("action");
      if (e.code === "KeyF") game.input.pressed.add("fire");
      if (e.code === "KeyH") game.input.pressed.add("home");
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = held[e.code];
      if (k) game.input[k] = false;
    };
    const blur = () => Object.assign(game.input, { up: false, down: false, left: false, right: false, brake: false, boost: false, fire: false });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      blur();
    };
  }, [active, modal, phone, game, radio, tool, refresh]);

  // Mouse: aim and shoot; in the Builder, place and drag
  const drag = useRef<{ id?: number; dx: number; dy: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const toGround = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = game.view;
    const x = v.x + (e.clientX - r.left - r.width / 2) / v.scale;
    const sy = v.y * K + (e.clientY - r.top - r.height / 2) / v.scale;
    return { x, y: sy / K, sx: e.clientX, sy: e.clientY };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modal || phone) return;
    if (photo) {
      capture(e);
      drag.current = { dx: 0, dy: 0, sx: e.clientX, sy: e.clientY, ox: game.camOffset.x, oy: game.camOffset.y };
      return;
    }
    if (game.save.station !== "off" && radio.station === "off") radio.play(game.save.station);
    const w = toGround(e);
    if (!building) {
      if (e.pointerType === "mouse" && e.button === 0) {
        game.input.aim = { x: w.x, y: w.y + 20 };
        game.input.fire = true;
      }
      return;
    }
    capture(e);
    const hit = game.propAt(w.x, w.y);
    if (hit && (!tool || hit.id === game.selected)) {
      game.selected = hit.id;
      drag.current = { id: hit.id, dx: hit.x - w.x, dy: hit.y - w.y, sx: w.sx, sy: w.sy, ox: 0, oy: 0 };
    } else if (tool) game.addProp(tool, w.x, w.y + 10);
    else {
      game.selected = null;
      drag.current = { dx: 0, dy: 0, sx: w.sx, sy: w.sy, ox: game.camOffset.x, oy: game.camOffset.y };
    }
    refresh();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (photo) {
      const d = drag.current;
      if (d) game.camOffset = { x: d.ox - (e.clientX - d.sx) / game.view.scale, y: d.oy - (e.clientY - d.sy) / game.view.scale / K };
      return;
    }
    const w = toGround(e);
    if (!building) {
      if (e.pointerType === "mouse") game.input.aim = { x: w.x, y: w.y + 20 };
      return;
    }
    game.ghost = tool && !drag.current ? { x: Math.round(w.x / 8) * 8, y: Math.round((w.y + 10) / 8) * 8, kind: tool } : null;
    const d = drag.current;
    if (!d) return;
    if (d.id !== undefined) {
      const q = game.save.props.find((r) => r.id === d.id);
      if (q) {
        q.x = Math.round((w.x + d.dx) / 8) * 8;
        q.y = Math.round((w.y + d.dy) / 8) * 8;
      }
    } else game.camOffset = { x: d.ox - (w.sx - d.sx) / game.view.scale, y: d.oy - (w.sy - d.sy) / game.view.scale / K };
  };
  const onPointerUp = () => {
    game.input.fire = false;
    if (drag.current?.id !== undefined) game.refreshProps();
    drag.current = null;
  };

  const close = () => {
    setModal(null);
    refresh();
  };
  const openCamera = () => {
    setPhone(false);
    setBuilding(false);
    setPhoto({ filter: 0 });
  };
  const exitCamera = () => {
    setPhoto(null);
    game.camOffset = { x: 0, y: 0 };
  };
  const snap = () => {
    const cv = canvasRef.current;
    if (!cv || !photo) return;
    const w = 800;
    const h = Math.round((cv.height / cv.width) * w);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const c = out.getContext("2d")!;
    c.filter = FILTERS[photo.filter][1];
    c.drawImage(cv, 0, 0, w, h);
    c.filter = "none";
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = "600 14px Geist, system-ui, sans-serif";
    c.fillText("Stickville City", 14, h - 14);
    const url = out.toDataURL("image/jpeg", 0.8);
    setPhotos((list) => savePhotos([...list, url].slice(-10)));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    sfx.page();
    game.extras.bump("photo");
    game.toast("Photo saved to your phone's Camera app", "#8bd99b");
  };
  snapRef.current = snap;
  exitCameraRef.current = exitCamera;
  const toggleMute = () =>
    setMutedState((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !m;
    });
  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-accent">Play</p>
          <h2 className="font-display text-4xl uppercase leading-none sm:text-5xl">Stickville City</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            An open city of stick people. Drive, race and drift, deliver pizza, run army missions, help the people you meet, build your block — and build the city itself.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<Smartphone className="h-4 w-4" />} onClick={() => (setPhone((p) => !p), setApp("home"))} aria-label={unread ? `Phone (${unread} new messages)` : "Phone"}>
            Phone
            {unread > 0 && <span className="ml-0.5 rounded-full bg-ink px-1.5 font-mono text-[10px] text-accent">{unread}</span>}
          </Button>
          <Button size="sm" variant={building ? "primary" : "secondary"} aria-pressed={building} icon={<Hammer className="h-4 w-4" />} onClick={() => setBuilding((b) => !b)}>
            Builder
          </Button>
          <Button size="sm" variant="ghost" aria-label={muted ? "Sound on" : "Mute"} icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} onClick={toggleMute} />
          <Button size="sm" variant="ghost" aria-label="Full screen" icon={<Maximize2 className="h-4 w-4" />} onClick={fullscreen} />
        </div>
      </div>

      <div ref={wrapRef} data-testid="stickcity" className="relative overflow-hidden rounded-2xl border border-line bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Stickville City. ${game.save.hero?.name ?? ""}, level ${game.rank().level}, $${game.save.money}.`}
          className={cx("block aspect-[3/4] w-full touch-none select-none sm:aspect-video [:fullscreen_&]:h-screen [:fullscreen_&]:aspect-auto", building ? (tool ? "cursor-crosshair" : "cursor-grab") : "cursor-crosshair")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            game.ghost = null;
            game.input.aim = null;
            game.input.fire = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={photo ? { filter: FILTERS[photo.filter][1] } : undefined}
        />
        <TouchControls game={game} hidden={!!modal || phone || !!photo} onPhone={() => (setPhone(true), setApp("home"))} />
        {photo && (
          <PhotoBar
            filter={photo.filter}
            setFilter={(i) => setPhoto({ filter: i })}
            zoom={(k) => (game.cam.zoom = Math.max(0.5, Math.min(2.2, game.cam.zoom * k)))}
            snap={snap}
            exit={exitCamera}
          />
        )}
        {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white/80" />}
        {sticker !== null && <StickerCard index={sticker} onDone={() => setSticker(null)} />}
        {phone && (
          <div className="absolute inset-0 z-30 bg-black/30" onClick={() => setPhone(false)}>
            <Phone
              game={game}
              app={app}
              setApp={setApp}
              actions={{
                close: () => setPhone(false),
                refresh,
                builder: () => {
                  setPhone(false);
                  setBuilding(true);
                },
                trivia: (hard) => {
                  setPhone(false);
                  setModal({ type: "quiz", title: hard ? "Lab challenge" : "Quick quiz", eyebrow: hard ? "Science lab" : "Brain", questions: pickQuestions(game.save, hard), hard });
                },
                editLook: () => {
                  setPhone(false);
                  setModal({ type: "hero", mode: "edit" });
                },
                station: startRadio,
                volume: (v) => radio.setVolume(v),
                muted,
                mute: toggleMute,
                photo: openCamera,
                photos,
                deletePhoto: (i) => setPhotos((list) => savePhotos(list.filter((_, k) => k !== i))),
                reset: () => {
                  try {
                    localStorage.removeItem(SAVE_KEY);
                  } catch {
                    /* ignore */
                  }
                  location.reload();
                },
              }}
            />
          </div>
        )}
        {modal && (
          <Overlay onClose={modal.type === "hero" && modal.mode === "new" ? undefined : close} wide={modal.type === "hero"} light={modal.type === "quiz" || modal.type === "riddle" || modal.type === "terminal"}>
            {modal.type === "hero" && (
              <HeroEditor
                initial={game.save.hero}
                owned={game.save.style}
                money={game.save.money}
                mode={modal.mode}
                onDone={(h, bought, cost) => {
                  if (cost && !game.spend(cost)) return;
                  game.save.style.push(...bought);
                  game.save.hero = h;
                  persist(game.save);
                  if (modal.mode === "new") {
                    game.toast(`Welcome to Stickville City, ${h.name}!`, "#ffb224", true);
                    game.toast("Talk to Nana Bea — she's waving next to your block", "#edeae3");
                    if (game.save.station !== "off") radio.play(game.save.station);
                  }
                  close();
                }}
              />
            )}
            {modal.type === "talk" && <TalkDialog game={game} modal={modal} setModal={setModal} close={close} />}
            {modal.type === "riddle" && (
              <Quiz
                eyebrow={CONTACTS[modal.id].name}
                title="Riddle"
                questions={[modal.question]}
                single
                onAnswer={(right) => {
                  game.answerRiddle(modal.id, right);
                  if (right) sfx.right();
                  else sfx.wrong();
                }}
                onFinish={close}
              />
            )}
            {modal.type === "plot" && <PlotDialog game={game} index={modal.index} close={close} />}
            {modal.type === "shop" && <ShopDialog game={game} shop={modal.shop} refresh={refresh} />}
            {modal.type === "quiz" && (
              <Quiz
                eyebrow={modal.eyebrow}
                title={modal.title}
                questions={modal.questions}
                payEach={modal.hard ? 45 : 25}
                onAnswer={(right) => {
                  game.answerTrivia(right, modal.hard);
                  if (right) sfx.right();
                  else sfx.wrong();
                }}
                onFinish={(score) => {
                  if (modal.cafe) game.finishTrivia(score);
                  close();
                }}
              />
            )}
            {modal.type === "terminal" && (
              <Quiz
                eyebrow="Intel terminal · answer to unlock"
                title="Enter the code"
                questions={[modal.question]}
                single
                onAnswer={(right) => game.answerTerminal(modal.index, right)}
                onFinish={close}
              />
            )}
            {modal.type === "result" && (
              <div className="text-center">
                <p className={cx("eyebrow", modal.ok ? "text-ok" : "text-danger")}>{modal.ok ? "Success" : "Failed"}</p>
                <h3 className="mt-2 font-display text-5xl uppercase">{modal.title}</h3>
                {modal.stars !== undefined && (
                  <p className="mt-3 text-4xl tracking-widest" aria-label={`${modal.stars} of 3 stars`}>
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={i <= modal.stars! ? "text-accent" : "text-faint"}>
                        ★
                      </span>
                    ))}
                  </p>
                )}
                <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted">{modal.text}</p>
                <Button variant="primary" className="mt-6" onClick={close}>
                  Continue
                </Button>
              </div>
            )}
            {modal.type === "world" && <WorldDialog game={game} close={close} />}
            {modal.type === "quiz-maker" && <QuizMaker game={game} close={close} />}
          </Overlay>
        )}
      </div>

      {building && <BuilderBar game={game} tool={tool} setTool={setTool} refresh={refresh} openDialog={(d) => setModal({ type: d })} close={() => setBuilding(false)} />}

      <p className="eyebrow text-faint">
        WASD drive & walk · mouse aim + click shoot · E use · Shift nitro/sprint · Space drift · Tab phone · M map · H home. Saves in this browser.
      </p>
    </div>
  );
}

/** Keep getting a pointer's moves after it leaves the element; harmless if the browser refuses. */
function capture(e: React.PointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* no active pointer (e.g. a synthetic event) */
  }
}

function pickQuestions(save: Save, hard: boolean) {
  const mine = shuffle(save.myQuestions).slice(0, 2);
  const pool = hard ? HARD_QUESTIONS : [...QUESTIONS, ...HARD_QUESTIONS.slice(0, 12)];
  return shuffle([...mine, ...shuffle(pool).slice(0, 5 - mine.length)]);
}

/* ---------- Dialogs ---------- */

function TalkDialog({ game, modal, setModal, close }: { game: City; modal: Extract<Modal, { type: "talk" }>; setModal: (m: Modal) => void; close: () => void }) {
  const c = CONTACTS[modal.id];
  const extra: ReactNode[] = [];
  if (modal.id === "okafor") {
    extra.push(
      <div key="m" className="mt-4 flex flex-col gap-2">
        <p className="eyebrow">Missions</p>
        {MISSIONS.map((d) => {
          const open = game.missionOpen(d);
          const rec = game.save.missions[d.id];
          return (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
              <span className={cx("text-[14px]", !open && "text-faint")}>
                {d.title} {rec && <span className="text-accent">{"★".repeat(rec.stars)}</span>}
              </span>
              <Button
                size="sm"
                variant={open ? "primary" : "secondary"}
                disabled={!open || !!game.mission}
                onClick={() => {
                  game.startMission(d);
                  close();
                }}
              >
                {open ? (rec ? "Replay" : "Start") : `🔒 Lv ${d.level}`}
              </Button>
            </div>
          );
        })}
      </div>,
    );
  }
  if (modal.id === "maya")
    extra.push(
      <Button
        key="t"
        className="mt-4"
        onClick={() => setModal({ type: "quiz", title: "Café trivia", eyebrow: "Maya's café", questions: pickQuestions(game.save, false), hard: false, cafe: true })}
      >
        Play café trivia ($25 a right answer)
      </Button>,
    );
  if (modal.id === "rio") extra.push(<Button key="s" className="mt-4" onClick={() => setModal({ type: "shop", shop: "mods" })}>Open the Mods shop</Button>);
  if (modal.id === "lin") extra.push(<Button key="b" className="mt-4" onClick={() => setModal({ type: "quiz", title: "Brain challenge", eyebrow: "Dr. Lin", questions: pickQuestions(game.save, true), hard: true })}>Brain challenge ($45 a right answer)</Button>);
  return (
    <div>
      <div className="flex items-center gap-4 pr-8">
        <div className="shrink-0 rounded-full bg-white/[0.06]">
          <HeroPreview hero={c.look} size={84} pose="wave" />
        </div>
        <div>
          <p className="eyebrow text-accent">{c.role}</p>
          <h3 className="font-display text-3xl uppercase leading-none">{c.name}</h3>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {modal.lines.map((l, i) => (
          <p key={i} className="w-fit max-w-[90%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-4 py-2 text-[15px] leading-snug">
            {l}
          </p>
        ))}
        {modal.done && <p className="w-fit max-w-[90%] rounded-2xl rounded-tl-sm bg-ok/15 px-4 py-2 text-[15px] leading-snug text-ok">{modal.done}</p>}
      </div>
      {modal.riddle && (
        <Button className="mt-4" variant="primary" onClick={() => setModal({ type: "riddle", id: modal.id, question: modal.riddle! })}>
          Answer the riddle
        </Button>
      )}
      {extra}
      <div className="mt-5 flex justify-end">
        <Button variant={modal.riddle ? "ghost" : "primary"} onClick={close}>
          {modal.riddle ? "Later" : "Okay"}
        </Button>
      </div>
    </div>
  );
}

function PlotDialog({ game, index, close }: { game: City; index: number; close: () => void }) {
  const k = game.save.plots[index];
  if (k) {
    const p = PLOTS[k];
    return (
      <div>
        <Heading eyebrow={`Your block · plot ${index + 1}`}>{p.label}</Heading>
        <p className="text-[14px] leading-relaxed">{p.does}</p>
        <div className="mt-4 rounded-xl border-l-2 border-accent bg-accent/[0.06] px-4 py-3">
          <p className="eyebrow text-accent">Did you know?</p>
          <p className="mt-1 text-[14px] leading-relaxed text-fg/90">{p.fact}</p>
        </div>
        <div className="mt-6 flex justify-between">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              game.sell(index);
              close();
            }}
          >
            Sell (+${Math.floor(p.cost / 2)})
          </Button>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Heading eyebrow={`Plot ${index + 1} · you have $${game.save.money.toLocaleString()}`}>Build</Heading>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PLOT_ORDER.map((kind) => {
          const p = PLOTS[kind];
          const owned = game.built(kind) && kind !== "park" && kind !== "solar";
          const cost = kind === "lab" && game.quest("lin").step >= 2 ? Math.round(p.cost * 0.6) : p.cost;
          const afford = game.save.money >= cost;
          return (
            <li key={kind}>
              <button
                type="button"
                disabled={owned || !afford}
                aria-label={`Build ${p.label}`}
                onClick={() => game.build(index, kind) && close()}
                className={cx("flex h-full w-full flex-col gap-1 rounded-xl border p-3 text-left", owned || !afford ? "border-line opacity-50" : "border-line-strong hover:border-accent hover:bg-accent/[0.05]")}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-medium">{p.label}</span>
                  <span className={cx("font-mono text-[12px]", afford ? "text-ok" : "text-danger")}>${cost.toLocaleString()}</span>
                </span>
                <span className="text-[13px] leading-snug text-muted">{p.does}</span>
                {owned && <span className="eyebrow text-faint">Already built</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13px] text-muted">Tip: a home and a solar farm pay you every minute, even while you're out racing.</p>
    </div>
  );
}

function ShopDialog({ game, shop, refresh }: { game: City; shop: "mods" | "armory"; refresh: () => void }) {
  const items = (Object.keys(UPGRADES) as UpgradeId[]).filter((u) => UPGRADES[u].shop === shop);
  return (
    <div>
      <Heading eyebrow={shop === "mods" ? "Rio's Mods" : "Army base"}>{shop === "mods" ? "Mods shop" : "Armory"}</Heading>
      <ul className="flex flex-col gap-2">
        {items.map((u) => (
          <li key={u} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-3">
            <div>
              <p className="text-[15px] font-medium">{UPGRADES[u].label}</p>
              <p className="text-[13px] text-muted">{UPGRADES[u].does}</p>
            </div>
            {game.has(u) ? (
              <span className="font-mono text-[12px] text-ok">Owned</span>
            ) : (
              <Button size="sm" variant="primary" onClick={() => (game.buyUpgrade(u), refresh())}>
                ${game.upgradeCost(u)}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {shop === "mods" && <p className="mt-4 text-[13px] text-muted">Paint jobs are in your phone → Garage once you've built a garage.</p>}
    </div>
  );
}

/* ---------- Builder ---------- */

const SPECIAL: [string, string][] = [["ramp", "Ramp"], ["boost", "Boost pad"], ["coin", "Coin"], ["sign", "Sign"], ["person", "Person"], ["wall", "Wall"]];
const SWATCHES = ["#8e8b84", "#ef5a3c", "#ffb224", "#5fa35a", "#3fa7ff", "#9b6bff", "#ff6b8a", "#edeae3", "#2a2a30"];

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
  const s = Math.min(0.5, 160 / img.naturalHeight, 260 / img.naturalWidth);
  const w = Math.max(8, Math.round(img.naturalWidth * s));
  const h = Math.max(8, Math.round(img.naturalHeight * s));
  const cv = document.createElement("canvas");
  cv.width = w * 2;
  cv.height = h * 2;
  cv.getContext("2d")!.drawImage(img, 0, 0, w * 2, h * 2);
  const webp = cv.toDataURL("image/webp", 0.9);
  return { id: Math.random().toString(36).slice(2, 10), name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "Picture", w, h, ax: w / 2, ay: h, solid: false, src: webp.startsWith("data:image/webp") ? webp : cv.toDataURL("image/png") };
}

const isImage = (v: unknown) => typeof v === "string" && /^data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 4_000_000;

function cleanPack(raw: Record<string, unknown>): Pack | null {
  const src = raw.src ?? raw.png;
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (!isImage(src) || !(w > 2 && w < 2000) || !(h > 2 && h < 2000)) return null;
  return { id: Math.random().toString(36).slice(2, 10), name: String(raw.name ?? "Imported").slice(0, 24), w, h, ax: Number.isFinite(Number(raw.ax)) ? Number(raw.ax) : w / 2, ay: Number.isFinite(Number(raw.ay)) ? Number(raw.ay) : h, solid: raw.solid === true, src: src as string };
}

function BuilderBar({ game, tool, setTool, refresh, openDialog, close }: { game: City; tool: string | null; setTool: (t: string | null) => void; refresh: () => void; openDialog: (d: "world" | "quiz-maker") => void; close: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const sel = game.save.props.find((q) => q.id === game.selected) ?? null;
  const art = Object.keys(ART.props).filter((k) => k !== "drone");
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let n = 0;
    try {
      for (const file of Array.from(files)) {
        if (/\.json$/i.test(file.name)) {
          const data = JSON.parse(await file.text());
          if (data?.format === "stickville-world") {
            setMsg(`Loaded ${applyWorld(game, data, false)}`);
            continue;
          }
          if (data?.format !== "stickville-pack" || !Array.isArray(data.items)) throw new Error(`${file.name} isn't a Stickville pack or world file`);
          for (const it of data.items) {
            const p = cleanPack(it);
            if (p) {
              game.save.packs.push(p);
              n++;
            }
          }
        } else {
          game.save.packs.push(await imageToPack(file));
          n++;
        }
      }
      if (n) {
        setTool(`pack:${game.save.packs[game.save.packs.length - 1].id}`);
        setMsg(`Imported ${n} item${n > 1 ? "s" : ""}. Click the city to place.`);
      }
      game.refreshProps();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't import that file");
    }
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  };
  const chip = (kind: string, label: string, img?: string) => (
    <button
      key={kind}
      type="button"
      role="radio"
      aria-checked={kind === "__move" ? tool === null : tool === kind}
      aria-label={label}
      title={label}
      onClick={() => setTool(kind === "__move" || tool === kind ? null : kind)}
      className={cx("flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border p-2 text-[11px]", (kind === "__move" ? tool === null : tool === kind) ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg")}
    >
      <span className="flex h-9 items-center justify-center">{img ? <img src={img} alt="" className="max-h-9 max-w-12 object-contain" /> : <span className="font-mono text-[13px] text-accent">{label.slice(0, 3)}</span>}</span>
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
  const update = (patch: Partial<NonNullable<typeof sel>>) => {
    if (!sel) return;
    Object.assign(sel, patch);
    game.refreshProps();
    refresh();
  };
  return (
    <section aria-label="Builder" className="rounded-2xl border border-accent/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="text-[13px] text-muted">
          <span className="eyebrow mr-2 text-accent">Builder</span>
          {tool ? "Click the city to place it" : "Drag things to move them · drag empty ground to look around"} · {game.save.props.length}/400
        </span>
        <div className="flex flex-wrap gap-1.5">
          <input ref={fileRef} type="file" aria-label="Import file" accept=".json,application/json,image/png,image/webp,image/jpeg,image/gif" multiple hidden onChange={(e) => void importFiles(e.target.files)} />
          <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()} title="A .stickpack.json from the Blender add-on, a picture, or a world file">
            Import
          </Button>
          <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => openDialog("world")}>
            World code
          </Button>
          <Button size="sm" onClick={() => openDialog("quiz-maker")}>
            Quiz maker
          </Button>
          <Button size="sm" variant="primary" onClick={close}>
            Done
          </Button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3" role="radiogroup" aria-label="Item to place">
        {chip("__move", "Move")}
        {SPECIAL.map(([k, l]) => chip(k, l, k === "ramp" ? previewUrl("ramp") : undefined))}
        {art.map((k) => chip(k, k[0].toUpperCase() + k.slice(1), previewUrl(k)))}
        {game.save.packs.map((p) => chip(`pack:${p.id}`, p.name, p.src))}
      </div>
      {msg && <p role="status" className="border-t border-line px-3 py-2 text-[13px] text-accent">{msg}</p>}
      {sel && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line p-3">
          <p className="text-[14px] font-medium">{sel.kind.startsWith("pack:") ? game.save.packs.find((p) => `pack:${p.id}` === sel.kind)?.name : sel.kind}</p>
          {(sel.kind === "sign" || sel.kind === "person") && (
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="eyebrow">{sel.kind === "sign" ? "Message" : "What they say"}</span>
              <input id="builder-text" className={inputClass} maxLength={200} value={sel.text ?? ""} onChange={(e) => update({ text: e.target.value })} />
            </label>
          )}
          {(sel.kind === "person" || sel.kind === "wall") && (
            <div className="flex flex-wrap gap-1">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => update({ color: c })} className={cx("h-7 w-7 rounded-full ring-2", sel.color === c ? "ring-fg" : "ring-transparent")} style={{ background: c }} />
              ))}
            </div>
          )}
          {sel.heading !== undefined && (
            <Button size="sm" icon={<RotateCw className="h-4 w-4" />} onClick={() => update({ heading: ((sel.heading ?? 0) + 1) % 16 })}>
              Rotate (R)
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              game.save.props = game.save.props.filter((q) => q.id !== sel.id);
              game.selected = null;
              game.refreshProps();
              refresh();
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </section>
  );
}

function applyWorld(game: City, raw: { props?: unknown; packs?: unknown; questions?: unknown }, replace: boolean) {
  const packs = (Array.isArray(raw.packs) ? raw.packs : []).map((p) => {
    const c = cleanPack(p as Record<string, unknown>);
    if (c && typeof (p as { id?: unknown }).id === "string") c.id = String((p as { id: string }).id).slice(0, 40);
    return c;
  }).filter((p): p is Pack => !!p);
  for (const p of packs) if (!game.save.packs.some((q) => q.id === p.id)) game.save.packs.push(p);
  const kinds = new Set([...Object.keys(ART.props), ...SPECIAL.map(([k]) => k), ...game.save.packs.map((p) => `pack:${p.id}`)]);
  if (replace) game.save.props = [];
  let n = 0;
  for (const r of Array.isArray(raw.props) ? raw.props : []) {
    const q = r as Record<string, unknown>;
    const x = Number(q.x);
    const y = Number(q.y);
    if (typeof q.kind !== "string" || !kinds.has(q.kind) || !Number.isFinite(x) || !Number.isFinite(y) || game.save.props.length >= 400) continue;
    game.save.props.push({
      id: game.save.nextPropId++,
      kind: q.kind,
      x,
      y,
      heading: Number.isFinite(Number(q.heading)) ? Math.max(0, Math.min(15, Math.round(Number(q.heading)))) : undefined,
      text: typeof q.text === "string" ? q.text.slice(0, 200) : undefined,
      color: typeof q.color === "string" && /^#[0-9a-f]{6}$/i.test(q.color) ? q.color : undefined,
    });
    n++;
  }
  let qn = 0;
  for (const r of Array.isArray(raw.questions) ? raw.questions : []) {
    const q = r as Question;
    if (typeof q?.q === "string" && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length && !game.save.myQuestions.some((m) => m.q === q.q)) {
      game.save.myQuestions.push({ cat: "My questions", q: q.q.slice(0, 200), options: q.options.slice(0, 4).map((o) => String(o).slice(0, 80)), answer: q.answer, why: typeof q.why === "string" ? q.why.slice(0, 300) : "" });
      qn++;
    }
  }
  game.refreshProps();
  return `${n} item${n === 1 ? "" : "s"}, ${packs.length} model${packs.length === 1 ? "" : "s"}, ${qn} question${qn === 1 ? "" : "s"}`;
}

function WorldDialog({ game, close }: { game: City; close: () => void }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const used = new Set(game.save.props.map((q) => q.kind));
  const json = JSON.stringify({ format: "stickville-world", version: 2, props: game.save.props, packs: game.save.packs.filter((p) => used.has(`pack:${p.id}`)), questions: game.save.myQuestions });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setNote("Copied! Send it to a friend: they open Builder → World code → paste → Add.");
    } catch {
      setText(json);
      setNote("Copying was blocked. The code is in the box: select it all and copy.");
    }
  };
  return (
    <div>
      <Heading eyebrow="Builder">World code</Heading>
      <p className="text-[14px] leading-relaxed text-muted">Everything you've built ({game.save.props.length} items), your imported models and your quiz questions, as one code you can share or keep as a backup.</p>
      <Button className="mt-3" variant="primary" icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>
        Copy my world code
      </Button>
      <label className="mt-5 flex flex-col gap-1.5">
        <span className="eyebrow">Paste a world code</span>
        <textarea id="world-code" className={cx(inputClass, "h-24 font-mono text-[11px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder='{"format":"stickville-world", …}' />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={!text.trim()}
          onClick={() => {
            try {
              setNote(`Loaded ${applyWorld(game, JSON.parse(text), false)}.`);
              setText("");
            } catch {
              setNote("That isn't a complete world code. Paste the whole thing.");
            }
          }}
        >
          Add to my city
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={close}>
          Close
        </Button>
      </div>
      {note && <p role="status" className="mt-3 text-[13px] text-accent">{note}</p>}
    </div>
  );
}

function QuizMaker({ game, close }: { game: City; close: () => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [why, setWhy] = useState("");
  const [, setN] = useState(0);
  const mine = game.save.myQuestions;
  const valid = q.trim() && opts.filter((o) => o.trim()).length >= 2 && opts[answer]?.trim();
  return (
    <div>
      <Heading eyebrow="Builder">Quiz maker</Heading>
      <p className="text-[14px] text-muted">Your questions turn up in quizzes, Dr. Lin's challenges and the Codebreaker terminals.</p>
      <div className="mt-4 flex flex-col gap-3">
        <input id="quiz-q" className={inputClass} maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Question, e.g. How many legs does a spider have?" aria-label="Question" />
        <div className="grid gap-2 sm:grid-cols-2">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="quiz-right" checked={answer === i} onChange={() => setAnswer(i)} aria-label={`Answer ${i + 1} is right`} />
              <input id={`quiz-opt-${i}`} className={inputClass} maxLength={80} value={o} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`Answer ${i + 1}`} aria-label={`Answer ${i + 1}`} />
            </div>
          ))}
        </div>
        <input id="quiz-why" className={inputClass} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why (shown after answering)" aria-label="Explanation" />
        <div className="flex justify-between">
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const trimmed = opts.map((o) => o.trim());
              const kept = trimmed.filter(Boolean);
              mine.push({ cat: "My questions", q: q.trim(), options: kept, answer: kept.indexOf(trimmed[answer]), why: why.trim() });
              game.refreshProps();
              setQ("");
              setOpts(["", "", "", ""]);
              setWhy("");
              setAnswer(0);
              setN((n) => n + 1);
            }}
          >
            Add question
          </Button>
          <Button variant="ghost" onClick={close}>
            Done
          </Button>
        </div>
      </div>
      {mine.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {mine.map((m, i) => (
            <li key={`${m.q}-${i}`} className="flex justify-between gap-3 py-2 text-[13px]">
              <span>
                {m.q} <span className="text-ok">→ {m.options[m.answer]}</span>
              </span>
              <button type="button" aria-label={`Delete ${m.q}`} className="text-faint hover:text-danger" onClick={() => (mine.splice(i, 1), game.refreshProps(), setN((n) => n + 1))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Touch ---------- */

function TouchControls({ game, hidden, onPhone }: { game: City; hidden: boolean; onPhone: () => void }) {
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  if (hidden) return null;
  const hold = (key: "fire" | "boost" | "brake", press?: "fire") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      capture(e);
      game.input[key] = true;
      if (press) game.input.pressed.add(press);
    },
    onPointerUp: () => (game.input[key] = false),
    onPointerCancel: () => (game.input[key] = false),
  });
  const btn = "flex h-14 w-14 select-none items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-sm active:bg-accent active:text-ink touch-none";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 [@media(pointer:fine)]:hidden">
      <div
        aria-label="Move"
        role="slider"
        aria-valuetext="joystick"
        className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border border-white/20 bg-black/30"
        onPointerDown={(e) => {
          capture(e);
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          if (!base.current) return;
          const dx = (e.clientX - base.current.x) / 50;
          const dy = (e.clientY - base.current.y) / 50;
          const n = Math.hypot(dx, dy);
          const k = n > 1 ? 1 / n : 1;
          game.input.stick = { x: dx * k, y: dy * k };
          setKnob({ x: dx * k * 40, y: dy * k * 40 });
        }}
        onPointerUp={() => {
          base.current = null;
          game.input.stick = null;
          setKnob(null);
        }}
        onPointerCancel={() => {
          base.current = null;
          game.input.stick = null;
          setKnob(null);
        }}
      >
        <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" style={knob ? { transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` } : undefined} />
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-2">
        <button type="button" aria-label="Phone" className={cx(btn, "h-11 w-11 self-end")} onPointerDown={(e) => (e.preventDefault(), onPhone())}>
          <Smartphone className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Use" className={cx(btn, "font-mono text-lg font-semibold")} onPointerDown={(e) => (e.preventDefault(), game.input.pressed.add("action"))}>
          E
        </button>
        <button type="button" aria-label="Fire" className={btn} {...hold("fire", "fire")}>
          <Crosshair className="h-6 w-6" />
        </button>
        <span />
        <button type="button" aria-label="Drift" className={cx(btn, "font-mono text-xs")} {...hold("brake")}>
          DRIFT
        </button>
        <button type="button" aria-label="Boost" className={btn} {...hold("boost")}>
          <Zap className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}


/* ---------- Photo mode and sticker card ---------- */

function PhotoBar({ filter, setFilter, zoom, snap, exit }: { filter: number; setFilter: (i: number) => void; zoom: (k: number) => void; snap: () => void; exit: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
      <div className="flex max-w-full gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Filter">
        {FILTERS.map(([label], i) => (
          <button key={label} type="button" role="radio" aria-checked={filter === i} onClick={() => setFilter(i)} className={cx("shrink-0 rounded-full px-3 py-1 text-[13px]", filter === i ? "bg-white text-ink" : "bg-black/40 text-white")}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(0.85)} className="h-11 w-11 rounded-full bg-black/50 text-xl text-white">
          −
        </button>
        <button type="button" aria-label="Take photo" onClick={snap} className="h-16 w-16 rounded-full border-4 border-white bg-white/30 active:bg-white" />
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.18)} className="h-11 w-11 rounded-full bg-black/50 text-xl text-white">
          +
        </button>
      </div>
      <p className="text-[12px] text-white/80">Drag to frame · Space to snap · Esc to leave</p>
      <button type="button" onClick={exit} className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[13px] text-white">
        Done
      </button>
    </div>
  );
}

function StickerCard({ index, onDone }: { index: number; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 8000);
    return () => window.clearTimeout(id);
  }, [index, onDone]);
  const k = STICKERS[index];
  return (
    <div role="status" className="absolute bottom-4 left-4 z-20 max-w-xs animate-rise rounded-2xl bg-[#fbf8f1] p-4 text-[#1d1d24] shadow-2xl sm:bottom-6 sm:left-6 [@media(pointer:coarse)]:bottom-40">
      <button type="button" aria-label="Dismiss" onClick={onDone} className="absolute right-3 top-2 text-[#5a5650]">
        ✕
      </button>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a35a00]">Sticker found · did you know?</p>
      <p className="mt-1 text-[17px] font-semibold">
        {k.icon} {k.title}
      </p>
      <p className="mt-1 pr-3 text-[14px] leading-snug text-[#3a3a42]">{k.fact}</p>
    </div>
  );
}
