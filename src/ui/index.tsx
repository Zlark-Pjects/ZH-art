import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Layout ---------- */

/** A rail section: grouped by space and a hairline, not by boxes. */
export function Section({
  index,
  title,
  aside,
  children,
  className,
  id,
}: {
  index?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("border-t border-line pt-5 pb-8", className)}>
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-3 text-[15px] font-medium tracking-[-0.01em] text-fg">
          {index && <span className="eyebrow text-faint">{index}</span>}
          {title}
        </h2>
        {aside && <div className="eyebrow shrink-0">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** Two-column studio layout: the picture is the star, controls live in a slim rail. */
export function StudioLayout({ stage, rail, below }: { stage: ReactNode; rail: ReactNode; below?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 xl:sticky xl:top-[124px] xl:self-start">
        {stage}
        {below && <div className="mt-10 hidden xl:block">{below}</div>}
      </div>
      <aside className="mt-8 min-w-0 xl:mt-0" aria-label="Controls">
        {rail}
      </aside>
      {below && <div className="mt-4 xl:hidden">{below}</div>}
    </div>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[3px] font-medium transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-strong",
  secondary: "border border-line-strong text-fg hover:border-fg/50 hover:bg-fg/[0.04]",
  ghost: "text-muted hover:text-fg hover:bg-fg/[0.05]",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-14 px-6 font-display text-[19px] uppercase tracking-[0.04em]",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* ---------- Form controls ---------- */

export const inputClass =
  "w-full rounded-[3px] border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-faint outline-none transition-colors hover:border-line-strong focus:border-accent/70";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="eyebrow">
          {label}
        </label>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Radio group rendered as a row/grid of toggles. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  columns,
}: {
  label: string;
  value: T;
  onChange: (value: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: string; hint?: string; swatch?: string[] }[];
  columns?: number;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex flex-col gap-2">
      <span id={id} className="eyebrow">
        {label}
      </span>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.hint}
              onClick={() => onChange(opt.value)}
              className={cx(
                "flex min-h-10 items-center gap-2 rounded-[3px] border px-3 py-2 text-left text-[13px] transition-colors duration-200",
                active
                  ? "border-fg/80 bg-fg/[0.06] text-fg"
                  : "border-line text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {opt.swatch && (
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-fg/20"
                  style={{ background: `linear-gradient(135deg, ${opt.swatch.join(", ")})` }}
                />
              )}
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Feedback ---------- */

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-fg">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">{Math.round(value)}%</span>
      </div>
      <div
        className="h-[3px] w-full overflow-hidden bg-line"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full origin-left bg-accent transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})` }}
        />
      </div>
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: "info" | "warn" | "error";
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const color = tone === "error" ? "text-danger" : tone === "warn" ? "text-accent" : "text-muted";
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-[3px] border px-4 py-3 text-[13px] leading-relaxed",
        tone === "error" ? "border-danger/30 bg-danger/[0.06]" : tone === "warn" ? "border-accent/25 bg-accent/[0.05]" : "border-line bg-surface",
      )}
    >
      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", color)} aria-hidden />
      <div className="min-w-0 flex-1 text-fg/85">
        {title && <p className={cx("mb-0.5 font-medium", color)}>{title}</p>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-faint hover:text-fg" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Chip({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-full border border-line px-3 py-1 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {children}
    </button>
  );
}

/* ---------- Editor controls ---------- */

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="eyebrow">
          {label}
        </label>
        <span className="font-mono text-[11px] tabular-nums text-muted">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="group flex min-w-0 items-center gap-2" title={`${label}: ${value}`}>
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line-strong transition group-hover:ring-fg/60">
        <span className="absolute inset-0" style={{ background: value }} />
        <input id={id} type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </span>
      <span className="min-w-0">
        <span className="eyebrow block truncate">{label}</span>
        <span className="block font-mono text-[11px] text-muted">{value.slice(0, 7)}</span>
      </span>
    </label>
  );
}

export function RailTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: NoInfer<T>) => void;
  tabs: { value: NoInfer<T>; label: string }[];
}) {
  return (
    <div role="tablist" className="mb-2 grid border-b border-line" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              "relative py-3 text-[14px] transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            <span aria-hidden className={cx("absolute inset-x-0 -bottom-px h-[2px] bg-fg transition-transform duration-300", active ? "scale-x-100" : "scale-x-0")} />
          </button>
        );
      })}
    </div>
  );
}

export function IconButton({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
