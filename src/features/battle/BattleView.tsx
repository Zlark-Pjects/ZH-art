/* Stickman Battle Royale: the page around the game: character and skill select,
   the match with phone and keyboard controls, and the result screen. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Battle, CHARS, GUNS, K, MAX_LEVEL, PLAYERS, loadProfile, saveProfile, upgradeCost, type CharDef, type Difficulty, type MatchResult, type Profile } from "./battle";
import { renderBattle, viewZoom } from "./battle-render";
import { setMuted, sfx } from "../city/audio";
import { cx } from "../../ui";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

function capture(e: React.PointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* synthetic events can't be captured */
  }
}

/* ---------- Menu ---------- */

function Fighter({ color, size = 64 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g strokeLinecap="round" fill="none">
        <path d="M32 36 L24 58 M32 36 L40 58" stroke="#1d1d24" strokeWidth="5" />
        <path d="M32 22 L32 38" stroke={color} strokeWidth="7" />
        <path d="M32 26 L46 30 M32 26 L22 34" stroke="#1d1d24" strokeWidth="4.5" />
        <path d="M44 30 L58 26" stroke="#9be36b" strokeWidth="5" />
        <circle cx="32" cy="14" r="9.5" fill="#f4e6d0" stroke="#1d1d24" strokeWidth="3" />
        <path d="M23 12 A9.5 9.5 0 0 1 41 12" stroke={color} strokeWidth="4" />
      </g>
    </svg>
  );
}

function Menu({ profile, setProfile, onPlay, onCity }: { profile: Profile; setProfile: (p: Profile) => void; onPlay: () => void; onCity?: () => void }) {
  const change = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    saveProfile(next);
    setProfile(next);
  };
  const level = (id: string) => profile.levels[id] ?? 1;
  const unlock = (c: CharDef) => profile.coins >= c.cost && change({ coins: profile.coins - c.cost, unlocked: [...profile.unlocked, c.id], pick: c.id });
  const upgrade = (c: CharDef) => {
    const cost = upgradeCost(level(c.id));
    if (profile.coins >= cost && level(c.id) < MAX_LEVEL) change({ coins: profile.coins - cost, levels: { ...profile.levels, [c.id]: level(c.id) + 1 } });
  };
  const diffs: Difficulty[] = ["easy", "normal", "hard"];
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#08080a] px-4 pb-10 pt-[max(16px,env(safe-area-inset-top))] text-fg [padding-left:max(16px,env(safe-area-inset-left))] [padding-right:max(16px,env(safe-area-inset-right))]">
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow text-accent">25 stick fighters · 1 island · 1 winner</p>
        <h1 className="font-display text-5xl uppercase leading-none tracking-tight sm:text-7xl">Stickman Battle Royale</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">Parachute in, grab a gun, fight with your fists, dodge, throw grenades, build a gel wall, and use your hero&apos;s skill. Stay inside the shrinking circle.</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          {[
            ["Coins", profile.coins],
            ["Wins", profile.wins],
            ["Matches", profile.matches],
            ["Eliminations", profile.kills],
            ["Best place", profile.matches ? `#${profile.best}` : "-"],
          ].map(([k, v]) => (
            <span key={k} className="rounded-full border border-line bg-surface px-3 py-1.5">
              <span className="text-faint">{k} </span>
              <b className="tabular-nums">{v}</b>
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="eyebrow text-faint">Your name</span>
            <input value={profile.name} maxLength={12} onChange={(e) => change({ name: e.target.value })} aria-label="Your name" className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </label>
          <div>
            <span className="eyebrow text-faint">Bots</span>
            <div role="radiogroup" aria-label="Difficulty" className="mt-1 flex gap-1.5">
              {diffs.map((d) => (
                <button key={d} role="radio" aria-checked={profile.difficulty === d} onClick={() => change({ difficulty: d })} className={cx("rounded-xl border px-4 py-2.5 text-sm capitalize", profile.difficulty === d ? "border-accent bg-accent text-ink" : "border-line bg-surface text-muted")}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <h2 className="eyebrow mt-7 text-faint">Pick your fighter and skill</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fighter">
          {CHARS.map((c) => {
            const owned = profile.unlocked.includes(c.id);
            const lv = level(c.id);
            const picked = profile.pick === c.id;
            return (
              <div key={c.id} className={cx("rounded-2xl border p-3", picked ? "border-accent bg-surface" : "border-line bg-surface/60")}>
                <button role="radio" aria-checked={picked} aria-label={`${c.name}: ${c.skill}`} disabled={!owned} onClick={() => change({ pick: c.id })} className="flex w-full gap-3 text-left disabled:opacity-60">
                  <span className="shrink-0 rounded-xl bg-black/40 p-1">
                    <Fighter color={c.color} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <b className="text-base">{c.name}</b>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink" style={{ background: c.color }}>
                        {c.skill}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">{c.skillText}</span>
                    <span className="mt-1 block text-xs text-faint">
                      <b className="text-muted">{c.passive}:</b> {c.passiveText}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1" aria-label={`Skill level ${lv} of ${MAX_LEVEL}`}>
                    {Array.from({ length: MAX_LEVEL }, (_, i) => (
                      <span key={i} className="h-2 w-5 rounded-full" style={{ background: i < lv ? c.color : "rgba(255,255,255,0.15)" }} />
                    ))}
                    <span className="ml-1 text-[11px] text-faint">Lv {lv}</span>
                  </span>
                  {owned ? (
                    <button onClick={() => upgrade(c)} disabled={lv >= MAX_LEVEL || profile.coins < upgradeCost(lv)} aria-label={`Upgrade ${c.name}`} className="rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-40">
                      {lv >= MAX_LEVEL ? "Maxed" : `Upgrade · ${upgradeCost(lv)} coins`}
                    </button>
                  ) : (
                    <button onClick={() => unlock(c)} disabled={profile.coins < c.cost} aria-label={`Unlock ${c.name}`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40">
                      Unlock · {c.cost} coins
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-faint">Each level makes the skill about 10% stronger and recharge 5% faster, and adds a little damage. Win coins by surviving and eliminating.</p>

        <button onClick={onPlay} className="mt-6 w-full rounded-2xl bg-accent px-6 py-4 font-display text-2xl uppercase tracking-wide text-ink active:scale-[0.99] sm:w-auto sm:px-16">
          Drop in
        </button>

        <details className="mt-6 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-fg">How to play</summary>
          <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            <li><b className="text-fg">Phone:</b> left stick moves, right stick aims, and pushing it all the way shoots.</li>
            <li><b className="text-fg">Buttons:</b> SKILL, ROLL (dodge), HEAL, GEL wall, GRENADE, RELOAD, MELEE, SWAP gun.</li>
            <li><b className="text-fg">Keyboard:</b> WASD move · mouse aim and click · Space roll (or dive in the air).</li>
            <li><b className="text-fg">Keys:</b> Q skill · R reload · H heal · G grenade · B gel wall · F melee · X swap · E pick up.</li>
            <li>Walk over ammo, armor, healing and grenades to take them. Guns need E (or PICK) when your hands are full.</li>
            <li>Roofs lift when you step inside. The red area hurts, and it keeps closing in. Look for the airdrop!</li>
          </ul>
        </details>
        {onCity && (
          <button onClick={onCity} className="mt-4 text-xs text-faint underline underline-offset-2">
            Open the city (the free-roam game)
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Touch controls ---------- */

function Stick({ size = 120, label, onMove, onEnd }: { size?: number; label: string; onMove: (x: number, y: number) => void; onEnd: () => void }) {
  const base = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const R = size / 2 - 8;
  const end = () => {
    base.current = null;
    setKnob(null);
    onEnd();
  };
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuetext="stick"
      style={{ width: size, height: size }}
      className="pointer-events-auto relative touch-none rounded-full border border-white/20 bg-black/30"
      onPointerDown={(e) => {
        capture(e);
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        move(e);
      }}
      onPointerMove={(e) => base.current && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" style={knob ? { transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` } : undefined} />
    </div>
  );
  function move(e: React.PointerEvent) {
    if (!base.current) return;
    const dx = (e.clientX - base.current.x) / R;
    const dy = (e.clientY - base.current.y) / R;
    const n = Math.hypot(dx, dy);
    const k = n > 1 ? 1 / n : 1;
    onMove(dx * k, dy * k);
    setKnob({ x: dx * k * R * 0.8, y: dy * k * R * 0.8 });
  }
}

interface Hud {
  cd: number;
  canPick: boolean;
  air: boolean;
  alive: boolean;
  skill: string;
  color: string;
  over: boolean;
}

function Btn({ label, text, onDown, size = 46, children, className }: { label: string; text?: string; onDown: () => void; size?: number; children?: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{ width: size, height: size }}
      className={cx("pointer-events-auto relative flex touch-none select-none items-center justify-center overflow-hidden rounded-full border border-white/25 bg-black/45 text-[10px] font-bold uppercase leading-none tracking-wide text-white backdrop-blur-sm active:bg-accent active:text-ink", className)}
      onPointerDown={(e) => (e.preventDefault(), onDown())}
    >
      {text}
      {children}
    </button>
  );
}

/* ---------- The match ---------- */

function Match({ profile, onExit, onAgain }: { profile: Profile; onExit: () => void; onAgain: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const game = useRef<Battle | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [leave, setLeave] = useState(false);
  const touch = useRef(coarse());
  const [muted, setMute] = useState(false);

  if (!game.current) {
    const g = new Battle({ ...profile });
    g.assist = touch.current ? 0.24 : 0.07;
    game.current = g;
  }
  const g = game.current;

  const press = useCallback((k: string) => game.current?.input.pressed.add(k), []);

  useEffect(() => {
    const cv = canvas.current!;
    const wrap = box.current!;
    const ctx = cv.getContext("2d")!;
    g.onEnd = (r) => {
      setResult(r);
      if (r.win) sfx.success();
      else sfx.fail();
    };
    if (new URLSearchParams(location.search).has("cheats")) {
      (window as unknown as { stickbr?: Battle }).stickbr = g;
    }
    let w = 0;
    let h = 0;
    let dpr = 1;
    const fit = () => {
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    /* keyboard */
    const keys = new Set<string>();
    const sync = () => {
      const i = g.input;
      i.mx = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      i.my = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
    };
    const MAP: Record<string, string> = { KeyQ: "skill", KeyR: "reload", KeyH: "heal", KeyG: "nade", KeyB: "gel", KeyF: "melee", KeyX: "swap", KeyE: "pickup", Digit1: "slot0", Digit2: "slot1" };
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.repeat) return;
      if (e.code === "Space") g.input.pressed.add(g.you.z > 0 ? "dive" : "roll");
      else if (MAP[e.code]) g.input.pressed.add(MAP[e.code]);
      else if (e.code === "Escape") setLeave((v) => !v);
      keys.add(e.code);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    /* mouse aim and fire */
    const aimAt = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const z = viewZoom(r.width, r.height);
      const sx = e.clientX - (r.left + r.width / 2);
      const sy = e.clientY - (r.top + r.height / 2) + 40 * z;
      g.input.aim = Math.atan2(sy / K, sx);
    };
    const pdown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      aimAt(e);
      if (e.button === 0) g.input.fire = true;
    };
    const pmove = (e: PointerEvent) => e.pointerType === "mouse" && aimAt(e);
    const pup = (e: PointerEvent) => e.pointerType === "mouse" && e.button === 0 && (g.input.fire = false);
    cv.addEventListener("pointerdown", pdown);
    window.addEventListener("pointermove", pmove);
    window.addEventListener("pointerup", pup);

    /* the loop */
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let lastHp = g.you.hp;
    let lastKills = 0;
    let lastShot = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      g.update(dt);
      renderBattle(ctx, g, w, h, dpr);
      // sounds
      const y = g.you;
      if (y.hp < lastHp - 0.5) sfx.hurt();
      lastHp = y.hp;
      if (y.kills > lastKills) sfx.coin();
      lastKills = y.kills;
      if (y.flash > 0.04 && now - lastShot > 70) {
        sfx.shoot();
        lastShot = now;
      }
      if (g.hit > 0.14) sfx.pop();
      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        const def = CHARS.find((c) => c.id === y.ch) ?? CHARS[0];
        const max = def.cd * g.cdMul(y);
        setHud({ cd: y.skillCd > 0 ? y.skillCd / max : 0, canPick: !!g.nearGun(y), air: y.z > 0, alive: y.alive, skill: def.skill, color: def.color, over: g.phase === "over" && g.overT > 1.4 });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cv.removeEventListener("pointerdown", pdown);
      window.removeEventListener("pointermove", pmove);
      window.removeEventListener("pointerup", pup);
    };
  }, [g]);

  const toggleMute = () => {
    setMute((m) => (setMuted(!m), !m));
  };
  const showTouch = touch.current;
  const small = "pointer-events-auto";
  return (
    <div className="fixed inset-0 select-none bg-black text-white">
      <div ref={box} className="absolute inset-0 pb-[env(safe-area-inset-bottom)]">
        <canvas ref={canvas} data-testid="battle" className="block h-full w-full touch-none" aria-label="Battle royale island" onContextMenu={(e) => e.preventDefault()} />
      </div>

      <div className="pointer-events-none absolute left-2 top-[62px] flex flex-col gap-1 pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]">
        <button className={cx(small, "rounded-full bg-black/50 px-3 py-1 text-[11px]")} onClick={() => setLeave(true)} aria-label="Leave match">
          Leave
        </button>
        <button className={cx(small, "rounded-full bg-black/50 px-3 py-1 text-[11px]")} onClick={toggleMute} aria-label={muted ? "Sound on" : "Mute"}>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      {hud && !hud.over && hud.alive && (
        <>
          {hud.air && (
            <div className="absolute inset-x-0 bottom-20 flex justify-center">
              <Btn label="Dive" text="Dive" size={64} onDown={() => press("dive")} />
            </div>
          )}
          {hud.canPick && !hud.air && (
            <div className="absolute inset-x-0 bottom-[138px] flex justify-center">
              <Btn label="Pick up" text="Pick" size={52} className="!bg-accent !text-ink" onDown={() => press("pickup")} />
            </div>
          )}
          {showTouch && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))]">
              <Stick
                label="Move"
                size={128}
                onMove={(x, y) => {
                  const n = Math.hypot(x, y / K);
                  const i = g.input;
                  const m = Math.hypot(x, y);
                  if (n > 0.01) {
                    i.mx = (x / n) * m;
                    i.my = (y / K / n) * m;
                  }
                }}
                onEnd={() => ((g.input.mx = 0), (g.input.my = 0))}
              />
              <div className="flex items-end gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <Btn label="Reload" text="Rld" onDown={() => press("reload")} />
                  <Btn label="Melee" text="Hit" onDown={() => press("melee")} />
                  <Btn label="Swap gun" text="Swap" onDown={() => press("swap")} />
                  <Btn label="Heal" text="Heal" onDown={() => press("heal")} />
                  <Btn label="Gel wall" text="Gel" onDown={() => press("gel")} />
                  <Btn label="Grenade" text="Nade" onDown={() => press("nade")} />
                  <Btn label="Roll" text="Roll" onDown={() => press("roll")} />
                  <Btn label={`Skill: ${hud.skill}`} text={hud.skill} size={62} className="col-span-2 !rounded-2xl" onDown={() => press("skill")}>
                    <span className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${hud.cd * 100}%` }} />
                  </Btn>
                </div>
                <Stick
                  label="Aim"
                  size={120}
                  onMove={(x, y) => {
                    const n = Math.hypot(x, y);
                    g.input.aim = Math.atan2(y / K, x);
                    g.input.fire = n > 0.6;
                  }}
                  onEnd={() => ((g.input.aim = null), (g.input.fire = false))}
                />
              </div>
            </div>
          )}
        </>
      )}

      {leave && !result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-label="Leave match" className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 text-center">
            <p className="font-display text-2xl uppercase">Leave the match?</p>
            <p className="mt-1 text-xs text-muted">You won&apos;t earn coins for this one.</p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-xl border border-line py-2.5 text-sm" onClick={() => setLeave(false)}>
                Keep playing
              </button>
              <button className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-ink" onClick={onExit}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {hud?.over && result && <ResultCard r={result} profile={profile} onAgain={onAgain} onExit={onExit} />}
    </div>
  );
}

function ResultCard({ r, profile, onAgain, onExit }: { r: MatchResult; profile: Profile; onAgain: () => void; onExit: () => void }) {
  const mins = Math.floor(r.time / 60);
  const secs = String(r.time % 60).padStart(2, "0");
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-black/75 p-4">
      <div role="dialog" aria-label="Match result" className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center">
        <p className={cx("eyebrow", r.win ? "text-accent" : "text-faint")}>{r.win ? "Winner winner" : "Eliminated"}</p>
        <p className="font-display text-7xl leading-none">#{r.place}</p>
        <p className="mt-1 text-sm text-muted">{r.win ? "You are the last stickman standing!" : `of ${PLAYERS}. ${r.killer === "the zone" ? "The zone got you." : `${r.killer} got you.`}`}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
          {[
            ["Eliminations", r.kills],
            ["Damage", r.dealt],
            ["Survived", `${mins}:${secs}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/30 p-2">
              <dt className="text-faint">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm">
          <b className="text-accent">+{r.coins} coins</b> <span className="text-faint">· you have {profile.coins + r.coins}</span>
        </p>
        <div className="mt-5 flex gap-2">
          <button className="flex-1 rounded-xl border border-line py-3 text-sm" onClick={onExit}>
            Menu
          </button>
          <button className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-ink" onClick={onAgain}>
            Drop again
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- The whole thing ---------- */

export function BattleView({ onCity }: { onCity?: () => void }) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [match, setMatch] = useState(0);
  // A match changes the profile (coins, wins); re-read it when coming back to the menu
  const back = () => {
    setProfile(loadProfile());
    setMatch(0);
  };
  const start = () => setMatch((m) => m + 1);
  void GUNS;
  if (match > 0) return <Match key={match} profile={profile} onExit={back} onAgain={() => (setProfile(loadProfile()), setMatch((m) => m + 1))} />;
  return <Menu profile={profile} setProfile={setProfile} onPlay={start} onCity={onCity} />;
}
