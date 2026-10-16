/* The in-game phone: map, missions, races, jobs, people, garage, style, brain games, the
   Builder, radio, stats and settings. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Brain,
  ChevronLeft,
  Crosshair,
  Flag,
  Hammer,
  Map as MapIcon,
  Pizza,
  Radio as RadioIcon,
  Settings,
  Shirt,
  Star,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Button, cx } from "../../ui";
import { CONTACTS, CONTACT_ORDER, MISSIONS, PAINTS, PAINT_COST, PAINT_SWATCH, RACES, UPGRADES, type ContactId, type UpgradeId } from "./data";
import { SPECS, type City } from "./engine";
import { minimapImage } from "./render";
import { HeroPreview } from "./ui";
import type { Station } from "./music";
import { H, W, type Place } from "./map";

export type App = "home" | "map" | "missions" | "races" | "jobs" | "people" | "garage" | "style" | "brain" | "radio" | "stats" | "settings";

const APPS: { id: App | "builder"; label: string; icon: ReactNode; color: string }[] = [
  { id: "map", label: "Map", icon: <MapIcon />, color: "#5fa35a" },
  { id: "missions", label: "Missions", icon: <Crosshair />, color: "#6b7a3a" },
  { id: "races", label: "Races", icon: <Flag />, color: "#ef5a3c" },
  { id: "jobs", label: "Jobs", icon: <Pizza />, color: "#ffb224" },
  { id: "people", label: "People", icon: <Users />, color: "#3fa7ff" },
  { id: "garage", label: "Garage", icon: <Wrench />, color: "#3a3a42" },
  { id: "style", label: "Style", icon: <Shirt />, color: "#9b6bff" },
  { id: "brain", label: "Brain", icon: <Brain />, color: "#ff6b8a" },
  { id: "builder", label: "Builder", icon: <Hammer />, color: "#a0723a" },
  { id: "radio", label: "Radio", icon: <RadioIcon />, color: "#4fa3a0" },
  { id: "stats", label: "Stats", icon: <BarChart3 />, color: "#8e8b84" },
  { id: "settings", label: "Settings", icon: <Settings />, color: "#5d5b56" },
];

export interface PhoneActions {
  close: () => void;
  refresh: () => void;
  builder: () => void;
  trivia: (hard: boolean) => void;
  editLook: () => void;
  station: (s: Station) => void;
  volume: (v: number) => void;
  muted: boolean;
  mute: () => void;
  reset: () => void;
}

export function Phone({ game, app, setApp, actions }: { game: City; app: App; setApp: (a: App) => void; actions: PhoneActions }) {
  const s = game.save;
  const hours = Math.floor(game.dayPhase * 24);
  const mins = Math.floor((game.dayPhase * 24 * 60) % 60);
  const news = CONTACT_ORDER.filter((id) => game.hasNews(id)).length;
  const gps = (p: Place) => {
    game.gps = p;
    game.toast(`GPS set: ${p.label}`, "#8bd99b");
    actions.close();
  };
  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[380px] p-2 sm:p-4" onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-label="Phone" className="flex w-full flex-col overflow-hidden rounded-[28px] border-[6px] border-[#111114] bg-[#0f0f14] shadow-2xl">
        <div className="flex items-center justify-between px-5 pb-1 pt-3 font-mono text-[11px] text-muted">
          <span className="tabular-nums">
            {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}
          </span>
          <span className="tabular-nums text-ok">${s.money.toLocaleString()}</span>
          <button type="button" aria-label="Close phone" onClick={actions.close} className="text-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        {app !== "home" && (
          <button type="button" onClick={() => setApp("home")} className="flex items-center gap-1 px-4 py-1 text-[13px] text-accent">
            <ChevronLeft className="h-4 w-4" /> Apps
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          {app === "home" && (
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 pt-4">
              {APPS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.id === "people" && news > 0 ? `People (${news} new)` : a.label}
                  onClick={() => (a.id === "builder" ? actions.builder() : setApp(a.id))}
                  className="flex flex-col items-center gap-1.5 text-[11px] text-fg/90"
                >
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-inner [&_svg]:h-6 [&_svg]:w-6" style={{ background: a.color }}>
                    {a.icon}
                    {a.id === "people" && news > 0 && <span aria-hidden className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px]">{news}</span>}
                  </span>
                  {a.label}
                </button>
              ))}
              <div className="col-span-4 mt-2 rounded-2xl bg-white/[0.04] p-3 text-[12px] leading-snug text-muted">
                <span className="eyebrow text-accent">Next</span>
                <p className="mt-1 text-fg/90">{game.nextGoal()}</p>
              </div>
            </div>
          )}
          {app === "map" && <MapApp game={game} onPick={gps} />}
          {app === "missions" && <MissionsApp game={game} actions={actions} gps={gps} />}
          {app === "races" && (
            <List title="Street races">
              {RACES.map((r) => {
                const rec = s.races[r.id];
                const open = game.raceOpen(r);
                return (
                  <Card key={r.id} title={r.title} sub={`${r.vehicle === "bike" ? "Bikes only · " : ""}Prize $${r.prize[0]} · ${rec?.best ? `best ${rec.best.toFixed(1)} s · ${rec.wins} win${rec.wins === 1 ? "" : "s"}` : "not raced yet"}`} locked={!open && `Level ${r.level}`}>
                    <Button size="sm" disabled={!open} onClick={() => gps(game.map.places[`race_${r.id}`])}>
                      Set GPS
                    </Button>
                  </Card>
                );
              })}
              <p className="text-[12px] text-muted">Drive into the yellow circle at the start and press E. Hit every checkpoint ring; computer racers will try to beat you.</p>
            </List>
          )}
          {app === "jobs" && (
            <List title="Jobs">
              {game.job && (
                <Card title={`On shift: ${game.job.kind === "pizza" ? "Pizza run" : "Taxi"}`} sub={`Earned $${game.job.earned} so far`}>
                  <Button size="sm" variant="danger" onClick={() => (game.stopJob(), actions.refresh())}>
                    Stop
                  </Button>
                </Card>
              )}
              <Card title="Pizza delivery" sub={`5 deliveries against the clock; faster means bigger tips. ${s.deliveries} delivered so far.`}>
                <Button size="sm" onClick={() => gps(game.map.places.pizza)}>
                  Set GPS
                </Button>
              </Card>
              <Card title="Taxi" sub={`Pick up people waving by the road and drive them across town. ${s.stats.fares} fares so far. Needs a car.`}>
                <Button
                  size="sm"
                  disabled={!!game.job || !game.player.vehicle || game.player.vehicle.kind === "bike" || game.player.vehicle.kind === "heli"}
                  onClick={() => {
                    game.startJob("taxi");
                    actions.close();
                  }}
                >
                  Start
                </Button>
              </Card>
            </List>
          )}
          {app === "people" && (
            <List title="People">
              {CONTACT_ORDER.map((id) => (
                <PersonCard key={id} game={game} id={id} gps={gps} />
              ))}
            </List>
          )}
          {app === "garage" && <GarageApp game={game} actions={actions} />}
          {app === "style" && (
            <List title="Style">
              <div className="flex justify-center rounded-2xl bg-white/[0.04]">{s.hero && <HeroPreview hero={s.hero} size={130} />}</div>
              <Button onClick={actions.editLook}>Change your look</Button>
              <p className="text-[13px] text-muted">New hairstyles, hats and colours are sold at the Style shop downtown.</p>
              <Button size="sm" onClick={() => gps(game.map.places.style)}>
                GPS to the Style shop
              </Button>
            </List>
          )}
          {app === "brain" && (
            <List title="Brain games">
              <Card title="Quick quiz" sub="5 questions, $25 for each right answer. Every answer explains itself.">
                <Button size="sm" onClick={() => actions.trivia(false)}>
                  Play
                </Button>
              </Card>
              <Card title="Lab challenge" sub="Harder questions — algebra, physics, chemistry, money, coding — for $45 each." locked={!game.built("lab") && "Build a Science lab"}>
                <Button size="sm" disabled={!game.built("lab")} onClick={() => actions.trivia(true)}>
                  Play
                </Button>
              </Card>
              <p className="text-[12px] text-muted">Dr. Lin at the school has brain challenges too, and Maya runs café trivia. You can write your own questions in the Builder.</p>
            </List>
          )}
          {app === "radio" && (
            <List title="Radio">
              {(["lofi", "synth", "off"] as Station[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => actions.station(st)}
                  className={cx("rounded-2xl border px-4 py-3 text-left", s.station === st ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}
                >
                  <span className="block text-[15px] font-medium">{st === "lofi" ? "Chill FM · Lo-fi" : st === "synth" ? "Night Drive · Synthwave" : "Radio off"}</span>
                  <span className="block text-[12px] text-muted">{st === "off" ? "Just the city" : "Made live by your browser — never the same twice"}</span>
                </button>
              ))}
              <VolumeSlider onChange={actions.volume} />
            </List>
          )}
          {app === "stats" && <StatsApp game={game} />}
          {app === "settings" && <SettingsApp actions={actions} />}
        </div>
      </div>
    </div>
  );
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <h3 className="font-display text-2xl uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Card({ title, sub, locked, children }: { title: string; sub?: ReactNode; locked?: string | false; children?: ReactNode }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3", locked && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        {sub && <p className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</p>}
        {locked && <p className="mt-1 font-mono text-[11px] text-accent">🔒 {locked}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} className={cx("h-3.5 w-3.5", i <= n ? "fill-accent text-accent" : "text-faint")} />
      ))}
    </span>
  );
}

function MissionsApp({ game, actions, gps }: { game: City; actions: PhoneActions; gps: (p: Place) => void }) {
  const m = game.mission;
  const nearHq = Math.hypot(game.focus().x - game.map.places.hq.x, game.focus().y - game.map.places.hq.y) < 900;
  return (
    <List title="Missions">
      {m && (
        <Card title={`Now: ${m.def.title}`} sub={m.objective}>
          <Button size="sm" variant="danger" onClick={() => (game.quitMission(), actions.refresh())}>
            Quit
          </Button>
        </Card>
      )}
      {MISSIONS.map((d) => {
        const rec = game.save.missions[d.id];
        const open = game.missionOpen(d);
        const prev = MISSIONS[MISSIONS.indexOf(d) - 1];
        const why = game.rank().level < d.level ? `Level ${d.level}` : prev && !game.save.missions[prev.id] ? `Finish ${prev.title}` : d.needs && !game.built(d.needs) ? "Build a helipad" : false;
        const here = nearHq || d.kind === "sky";
        return (
          <Card key={d.id} title={d.title} sub={<>{d.brief}<span className="mt-1 block font-mono text-[11px] text-faint">${d.reward} · {d.xp} XP {rec && <Stars n={rec.stars} />}</span></>} locked={!open && why}>
            {open && (here ? (
              <Button size="sm" variant="primary" disabled={!!m} onClick={() => (game.startMission(d), actions.close())}>
                {rec ? "Replay" : "Start"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => gps(game.map.places.hq)}>
                GPS
              </Button>
            ))}
          </Card>
        );
      })}
      <p className="text-[12px] text-muted">Missions start at the army base (east side of the city), except Sky Patrol. Stars come from speed and skill.</p>
    </List>
  );
}

function PersonCard({ game, id, gps }: { game: City; id: ContactId; gps: (p: Place) => void }) {
  const c = CONTACTS[id];
  const step = game.currentStep(id);
  const q = game.save.quests[id];
  const news = game.hasNews(id);
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3">
      <div className="shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <HeroPreview hero={c.look} size={48} pose="stand" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">
          {c.name} {news && <span className="ml-1 rounded-full bg-accent px-1.5 font-mono text-[10px] text-ink">!</span>}
        </p>
        <p className="text-[12px] text-muted">{c.role}</p>
        <p className="mt-1 text-[12px] leading-snug text-fg/85">{step ? (q?.accepted ? step.text : "Has something for you") : "All done — thank you!"}</p>
      </div>
      <Button size="sm" onClick={() => gps({ ...game.contactPos(id), label: c.name })}>
        GPS
      </Button>
    </div>
  );
}

function GarageApp({ game, actions }: { game: City; actions: PhoneActions }) {
  const s = game.save;
  const buy = (u: UpgradeId) => {
    game.buyUpgrade(u);
    actions.refresh();
  };
  return (
    <List title="Garage">
      <p className="text-[12px] text-muted">Order parts online — they're fitted straight away. Rio's Mods shop downtown has the same stock.</p>
      {(Object.keys(UPGRADES) as UpgradeId[]).map((u) => (
        <Card key={u} title={UPGRADES[u].label} sub={UPGRADES[u].does}>
          {game.has(u) ? (
            <span className="font-mono text-[12px] text-ok">Owned</span>
          ) : (
            <Button size="sm" onClick={() => buy(u)}>
              ${game.upgradeCost(u)}
            </Button>
          )}
        </Card>
      ))}
      <div className={cx("rounded-2xl bg-white/[0.04] p-3", !game.built("garage") && "opacity-60")}>
        <p className="text-[14px] font-medium">Paint your car</p>
        <p className="text-[12px] text-muted">{game.built("garage") ? `$${PAINT_COST} for a new colour; colours you own are free to switch.` : "Build a garage on your block to own a car."}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAINTS.map((p) => {
            const owned = s.paints.includes(p);
            return (
              <button
                key={p}
                type="button"
                disabled={!game.built("garage")}
                aria-label={`Paint ${p}${owned ? "" : ` $${PAINT_COST}`}`}
                aria-pressed={s.paint === p}
                onClick={() => {
                  if (!owned && !game.spend(PAINT_COST)) return;
                  if (!owned) s.paints.push(p);
                  game.setPaint(p);
                  actions.refresh();
                }}
                className={cx("h-9 w-9 rounded-full ring-2", s.paint === p ? "ring-fg" : "ring-transparent")}
                style={{ background: PAINT_SWATCH[p] }}
              >
                {!owned && <span className="font-mono text-[9px] text-black/70">$</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[12px] text-muted">
        Your vehicles: dirt bike{game.built("garage") ? ", car" : ""}
        {game.built("helipad") ? ", helicopter" : ""}. You can also borrow any car in the street (press E next to it). Top speeds: car {Math.round((SPECS.car.max / 24) * 3.6)} km/h, bike {Math.round((SPECS.bike.max / 24) * 3.6)} km/h.
      </p>
    </List>
  );
}

function MapApp({ game, onPick }: { game: City; onPick: (p: Place) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const places = [
    ["home", "Your block"], ["cafe", "Maya's café"], ["pizza", "Pizza place"], ["mods", "Rio's Mods"], ["style", "Style shop"], ["hospital", "Hospital"],
    ["park", "Park & lake"], ["school", "School"], ["stunt", "Stunt park"], ["depot", "The Depot"], ["beach", "Beach"], ["hq", "Army base"], ["redgate", "Red Zone"],
  ] as const;
  useEffect(() => {
    const cv = ref.current!;
    const c = cv.getContext("2d")!;
    const img = minimapImage(game.map);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = (w * H) / W;
    cv.width = w * dpr;
    cv.height = h * dpr;
    c.scale(dpr, dpr);
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 0, 0, w, h);
    const k = w / W;
    const dot = (x: number, y: number, color: string, r = 4) => {
      c.fillStyle = color;
      c.strokeStyle = "#08080a";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x * k, y * k, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    };
    for (const [id] of places) dot(game.map.places[id].x, game.map.places[id].y, "#edeae3", 3);
    for (const id of CONTACT_ORDER) if (game.hasNews(id)) dot(game.contactPos(id).x, game.contactPos(id).y, "#ffb224", 4);
    if (game.gps) dot(game.gps.x, game.gps.y, "#8bd99b", 5);
    const f = game.focus();
    dot(f.x, f.y, "#ff6b8a", 5);
  }, [game]);
  return (
    <List title="Map">
      <canvas ref={ref} className="w-full rounded-xl" style={{ aspectRatio: `${W} / ${H}` }} aria-label="City map" role="img" />
      <p className="font-mono text-[11px] text-muted">
        <span className="text-[#ff6b8a]">●</span> you · <span className="text-accent">●</span> someone has news · <span className="text-ok">●</span> GPS
      </p>
      <div className="flex flex-wrap gap-1.5">
        {places.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onPick({ ...game.map.places[id], label })} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:border-accent hover:text-fg">
            {label}
          </button>
        ))}
      </div>
    </List>
  );
}

function StatsApp({ game }: { game: City }) {
  const s = game.save;
  const lv = game.rank();
  const stars = Object.values(s.missions).reduce((n, m) => n + m.stars, 0);
  const rows: [string, string | number][] = [
    ["Level", `${lv.level} (${lv.into}/${lv.need} XP)`],
    ["Money", `$${s.money.toLocaleString()}`],
    ["Mission stars", `${stars}/${MISSIONS.length * 3}`],
    ["Race wins", Object.values(s.races).reduce((n, r) => n + r.wins, 0)],
    ["Best stunt", s.bestStunt],
    ["Best drift", s.bestDrift],
    ["Pizzas delivered", s.deliveries],
    ["Taxi fares", s.stats.fares],
    ["Drones popped", s.stats.drones],
    ["Distance", `${(s.stats.metres / 1000).toFixed(1)} km`],
    ["Builder items", s.props.length],
  ];
  return (
    <List title="Stats">
      <dl className="divide-y divide-line rounded-2xl bg-white/[0.04] px-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 text-[13px]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </List>
  );
}

function VolumeSlider({ onChange }: { onChange: (v: number) => void }) {
  const [v, setV] = useState(50);
  return (
    <label className="mt-2 flex flex-col gap-1">
      <span className="eyebrow">Music volume</span>
      <input
        id="radio-volume"
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => {
          setV(Number(e.target.value));
          onChange(Number(e.target.value) / 100);
        }}
      />
    </label>
  );
}

function SettingsApp({ actions }: { actions: PhoneActions }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <List title="Settings">
      <Card title="Sound effects" sub={actions.muted ? "Off" : "On"}>
        <Button size="sm" onClick={actions.mute}>
          {actions.muted ? "Turn on" : "Turn off"}
        </Button>
      </Card>
      <div className="rounded-2xl bg-white/[0.04] p-3 text-[12px] leading-relaxed text-muted">
        <p className="text-[14px] font-medium text-fg">Controls</p>
        <p className="mt-1">
          <b className="text-fg">WASD / arrows</b> move & drive · <b className="text-fg">Mouse</b> aim, click to shoot (or F) · <b className="text-fg">E</b> use, get in & out · <b className="text-fg">Shift</b> sprint / nitro · <b className="text-fg">Space</b> handbrake drift · <b className="text-fg">A/D in the air</b> spin · <b className="text-fg">Tab</b> phone · <b className="text-fg">M</b> map · <b className="text-fg">H</b> go home
        </p>
        <p className="mt-1">Helicopter: move to take off, Space to land.</p>
      </div>
      {confirm ? (
        <Button variant="danger" onClick={actions.reset}>
          Yes, delete my city and start over
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          Start a new game…
        </Button>
      )}
    </List>
  );
}
