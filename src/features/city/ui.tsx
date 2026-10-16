/* Shared pieces of the city's interface: the modal shell, the hero editor (with Style shop
   prices) and the quiz. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Lock, X } from "lucide-react";
import { Button, cx, inputClass } from "../../ui";
import { BOTTOMS, HAIR_STYLES, HEADWEAR, HERO_PRESETS, SKINS, STYLE_PRICES, type Hero, type Question } from "./data";
import { drawHero } from "./stick";

export function Overlay({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center overflow-y-auto bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cx("relative max-h-full w-full animate-rise overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:max-h-[94%] sm:rounded-2xl sm:p-7", wide ? "max-w-3xl" : "max-w-xl")}
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

export function Heading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mb-5 pr-8">
      <p className="eyebrow text-accent">{eyebrow}</p>
      <h3 className="mt-1 font-display text-3xl uppercase leading-none sm:text-4xl">{children}</h3>
    </div>
  );
}

export function HeroPreview({ hero, size = 150, pose }: { hero: Hero; size?: number; pose?: "stand" | "wave" }) {
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
      c.fillStyle = "rgba(237,234,227,0.07)";
      c.beginPath();
      c.ellipse(size / 2, size * 0.86, size * 0.24, 5, 0, 0, Math.PI * 2);
      c.fill();
      drawHero(c, hero, size / 2, size * 0.86, 1, t * 8, pose ?? (Math.floor(t / 2.5) % 2 ? "walk" : "wave"), size / 95);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hero, size, pose]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label={`${hero.name || "Character"} preview`} role="img" />;
}

const COLORS = ["#ef5a3c", "#ffb224", "#5fa35a", "#3fa7ff", "#2f3a68", "#edeae3", "#30343c", "#4fa3a0", "#9b6bff", "#ff6b8a", "#2a2a30", "#ffd36b"];
const HAIR_COLORS = ["#141010", "#3b2416", "#5a3a1a", "#b5562a", "#e0b860", "#c9c9c9", "#9b6bff", "#3fa7ff", "#ff6b8a"];

type Mode = "new" | "edit" | "shop";

/**
 * The character editor. Some looks cost money: at the Style shop you can buy them; elsewhere
 * they show a lock.
 */
export function HeroEditor({ initial, owned, money, mode, onDone }: { initial: Hero | null; owned: string[]; money: number; mode: Mode; onDone: (h: Hero, bought: string[], cost: number) => void }) {
  const [hero, setHero] = useState<Hero>(initial ?? HERO_PRESETS[0].hero);
  const set = <K extends keyof Hero>(k: K, v: Hero[K]) => setHero((h) => ({ ...h, [k]: v }));
  // Your first look is free; after that, new looks are bought at the Style shop
  const priceOf = (key: string) => (mode === "new" || owned.includes(key) ? 0 : STYLE_PRICES[key] ?? 0);
  const keys = [`hair:${hero.hair}`, `headwear:${hero.headwear}`, `top:${hero.top}`];
  const unpaid = keys.filter((k) => priceOf(k) > 0);
  const cost = unpaid.reduce((s, k) => s + priceOf(k), 0);
  const presets = HERO_PRESETS.filter((p) => mode === "shop" || [`hair:${p.hero.hair}`, `headwear:${p.hero.headwear}`, `top:${p.hero.top}`].every((k) => priceOf(k) === 0));

  const chip = (group: string, value: string, label: ReactNode, onPick: () => void, active: boolean, swatch?: string) => {
    const price = priceOf(`${group}:${value}`);
    const locked = price > 0 && mode !== "shop";
    return (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={swatch ? `${group} ${value}${price ? ` $${price}` : ""}` : undefined}
        disabled={locked}
        onClick={onPick}
        title={locked ? `$${price} at the Style shop` : price ? `$${price}` : undefined}
        className={cx(
          "relative flex items-center gap-1 rounded-full border text-[13px] capitalize transition-colors disabled:opacity-40",
          swatch ? "h-8 w-8 justify-center" : "px-3 py-1.5",
          active ? "border-fg text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
        )}
        style={swatch ? { background: swatch } : undefined}
      >
        {label}
        {price > 0 && (
          <span className={cx("font-mono text-[10px]", swatch ? "absolute -bottom-3 left-1/2 -translate-x-1/2 text-accent" : "text-accent")}>
            {locked ? <Lock className="inline h-3 w-3" /> : `$${price}`}
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      <Heading eyebrow={mode === "shop" ? "Style shop" : mode === "new" ? "Welcome to Stickville City" : "Your look"}>{mode === "new" ? "Make your character" : mode === "shop" ? "New look" : "Change your look"}</Heading>
      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-line bg-ink">
            <HeroPreview hero={hero} />
          </div>
          {mode === "shop" && <p className="text-center font-mono text-[12px] text-muted">You have ${money.toLocaleString()}</p>}
        </div>
        <div className="flex flex-col gap-4">
          {presets.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Start from</span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button key={p.label} type="button" onClick={() => setHero({ ...p.hero, name: hero.name || p.hero.name })} className="rounded-full border border-line px-3 py-1 text-[13px] text-muted hover:border-line-strong hover:text-fg">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex flex-col gap-2">
            <span className="eyebrow">Name</span>
            <input id="hero-name" className={inputClass} value={hero.name} maxLength={16} onChange={(e) => set("name", e.target.value)} placeholder="Your name" aria-label="Character name" />
          </label>
          <Row label="Hair">{HAIR_STYLES.map((h) => chip("hair", h, h, () => set("hair", h), hero.hair === h))}</Row>
          <Row label="Hair colour">{HAIR_COLORS.map((h) => chip("hairColor", h, null, () => set("hairColor", h), hero.hairColor === h, h))}</Row>
          <Row label="Headwear">{HEADWEAR.map((h) => chip("headwear", h, h, () => set("headwear", h), hero.headwear === h))}</Row>
          <Row label="Skin">{SKINS.map((h) => chip("skin", h, null, () => set("skin", h), hero.skin === h, h))}</Row>
          <Row label="Top">{COLORS.map((h) => chip("top", h, null, () => set("top", h), hero.top === h, h))}</Row>
          <Row label="Bottoms">{BOTTOMS.map((h) => chip("bottom", h, h, () => set("bottom", h), hero.bottom === h))}</Row>
          <Row label="Bottoms colour">{COLORS.slice(0, 9).map((h) => chip("bottomColor", h, null, () => set("bottomColor", h), hero.bottomColor === h, h))}</Row>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        {cost > 0 && <span className={cx("font-mono text-[13px]", cost > money ? "text-danger" : "text-accent")}>Total ${cost}</span>}
        <Button variant="primary" disabled={cost > money} onClick={() => onDone({ ...hero, name: hero.name.trim() || "Hero" }, mode === "new" ? keys.filter((k) => STYLE_PRICES[k] && !owned.includes(k)) : unpaid, cost)}>
          {mode === "new" ? "Start playing" : cost ? `Buy for $${cost}` : "Save look"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={label}>
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap gap-1.5 pb-1">{children}</div>
    </div>
  );
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export { shuffle };

export function Quiz({
  eyebrow,
  title,
  questions,
  payEach,
  onAnswer,
  onFinish,
  single,
}: {
  eyebrow: string;
  title: string;
  questions: Question[];
  payEach?: number;
  onAnswer: (right: boolean) => void;
  onFinish: (score: number) => void;
  single?: boolean;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i];
  const order = useMemo(() => (q ? shuffle(q.options.map((_, k) => k)) : []), [q]);
  if (!q) {
    return (
      <div className="text-center">
        <Heading eyebrow={eyebrow}>Done</Heading>
        <p className="font-display text-6xl">
          {score}/{questions.length}
        </p>
        {payEach ? <p className="mt-2 text-[14px] text-muted">You earned ${score * payEach}.</p> : null}
        <Button variant="primary" className="mt-6" onClick={() => onFinish(score)}>
          Back to the city
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
      <Heading eyebrow={`${eyebrow}${single ? "" : ` · ${i + 1} of ${questions.length}`} · ${q.cat}`}>{title}</Heading>
      <p className="text-[17px] leading-snug">{q.q}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {order.map((k) => {
          const show = picked !== null;
          const right = k === q.answer;
          return (
            <button
              key={k}
              type="button"
              disabled={show}
              onClick={() => choose(k)}
              className={cx(
                "rounded-xl border px-4 py-3 text-left text-[15px] transition-colors",
                !show && "border-line-strong hover:border-accent hover:bg-accent/[0.06]",
                show && right && "border-ok bg-ok/10 text-ok",
                show && !right && k === picked && "border-danger bg-danger/10 text-danger",
                show && !right && k !== picked && "border-line opacity-50",
              )}
            >
              {q.options[k]}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-4" role="status">
          <p className={cx("text-[15px] font-medium", picked === q.answer ? "text-ok" : "text-danger")}>{picked === q.answer ? `Correct!${payEach ? ` +$${payEach}` : ""}` : "Not quite."}</p>
          {q.why && <p className="mt-1 text-[14px] leading-relaxed text-muted">{q.why}</p>}
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                if (single) onFinish(picked === q.answer ? 1 : 0);
                else {
                  setI(i + 1);
                  setPicked(null);
                }
              }}
            >
              {single ? "Continue" : i + 1 < questions.length ? "Next question" : "See score"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
