import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Download, FilePlus2, FolderOpen, Trash2, Upload } from "lucide-react";
import type { Studio } from "./useStudio";
import { cx } from "../ui";

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

/** Project title, save state and the project switcher. */
export function ProjectMenu({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const status = studio.saveState === "saved" ? "Saved" : studio.saveState === "saving" ? "Saving…" : "Not saved — storage full or blocked";

  const item = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-muted transition-colors hover:bg-fg/[0.05] hover:text-fg";

  return (
    <div ref={ref} className="relative flex min-w-0 items-center gap-2">
      <label htmlFor="project-title" className="sr-only">
        Project title
      </label>
      <input
        id="project-title"
        value={studio.board.title}
        onChange={(e) => studio.patchBoard({ title: e.target.value })}
        className="min-w-0 max-w-[16rem] flex-1 truncate rounded-[3px] border border-transparent bg-transparent px-2 py-1 text-[14px] text-fg outline-none hover:border-line focus:border-accent/70"
      />
      <span
        className={cx("eyebrow hidden shrink-0 lg:inline", studio.saveState === "unsaved" ? "text-danger" : "text-faint")}
        aria-live="polite"
      >
        {status}
      </span>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] px-2 text-[13px] text-muted hover:bg-fg/[0.05] hover:text-fg"
      >
        <FolderOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Projects</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-rise border border-line bg-surface py-2 shadow-2xl">
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              studio.create();
              setOpen(false);
            }}
          >
            <FilePlus2 className="h-4 w-4" /> New project
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              studio.duplicate();
              setOpen(false);
            }}
          >
            <Copy className="h-4 w-4" /> Duplicate this project
          </button>
          <button role="menuitem" className={item} onClick={() => studio.exportFile()}>
            <Download className="h-4 w-4" /> Save project file…
          </button>
          <button role="menuitem" className={item} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Open project file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                await studio.importFile(file);
                setError("");
                setOpen(false);
              } catch (err: any) {
                setError(err?.message || "Couldn't open that file.");
              }
            }}
          />
          {error && <p className="px-4 py-2 text-[13px] text-danger">{error}</p>}

          <p className="eyebrow mt-2 border-t border-line px-4 pb-1 pt-3">In this browser</p>
          <ul className="max-h-72 overflow-y-auto">
            {studio.projects.map((p) => {
              const current = p.id === studio.project.id;
              return (
                <li key={p.id} className="group flex items-center">
                  <button
                    role="menuitem"
                    className={cx(item, "min-w-0 flex-1", current && "text-fg")}
                    onClick={() => {
                      studio.open(p.id);
                      setOpen(false);
                    }}
                  >
                    <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", current ? "bg-accent" : "bg-transparent")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{p.title || "Untitled"}</span>
                    <span className="eyebrow shrink-0 text-faint">{ago(p.updatedAt)}</span>
                  </button>
                  {confirmDelete === p.id ? (
                    <button
                      className="mr-2 shrink-0 rounded-[3px] border border-danger/40 px-2 py-1 text-[12px] text-danger hover:bg-danger/10"
                      onClick={() => {
                        studio.remove(p.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      aria-label={`Delete ${p.title}`}
                      className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                      onClick={() => setConfirmDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
