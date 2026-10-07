import { useEffect, useRef, useState } from "react";
import { Download, Gamepad2 } from "lucide-react";
import type { CharacterLook, RigClip } from "../../types";
import { GAME_STATES, type GameState } from "../../project/forge/plans";
import { saveFile } from "../../lib/saveFile";
import { Button, Notice, Section, Segmented, cx } from "../../ui";
import { renderSpriteSheet, sheetPng, sheetZip, type SpriteSheet } from "./sprites";

/** Export the current character as a game sprite sheet with an atlas. */
export function SpriteExport({ look, clips = [] }: { look: CharacterLook; clips?: RigClip[] }) {
  const [states, setStates] = useState<Set<GameState>>(new Set(GAME_STATES.map((s) => s.id)));
  const [clipIds, setClipIds] = useState<Set<string>>(new Set());
  const [size, setSize] = useState<"64" | "128" | "256">("128");
  const [fps, setFps] = useState<"8" | "12" | "24">("12");
  const [facing, setFacing] = useState<"right" | "left">("right");
  const [sheet, setSheet] = useState<SpriteSheet | null>(null);
  const [sheetFor, setSheetFor] = useState<CharacterLook | null>(null);
  const [preview, setPreview] = useState<string>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const previewRef = useRef<HTMLCanvasElement>(null);
  const sheetUrl = useRef<string | null>(null);
  const [sheetSrc, setSheetSrc] = useState<string | null>(null);

  const stale = sheet && (sheetFor !== look);

  const build = async () => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      // Let the button state paint before the synchronous render work
      await new Promise((r) => setTimeout(r, 30));
      const chosen = clips.filter((c) => clipIds.has(c.id));
      const next = await renderSpriteSheet(look, { states: [...states], clips: chosen, frameSize: Number(size), fps: Number(fps), facing });
      setSheet(next);
      setSheetFor(look);
      if (!next.rows.some((r) => r.name === preview)) setPreview(next.rows[0].name);
      const blob = await sheetPng(next);
      if (sheetUrl.current) URL.revokeObjectURL(sheetUrl.current);
      sheetUrl.current = URL.createObjectURL(blob);
      setSheetSrc(sheetUrl.current);
    } catch (err: any) {
      setError(err?.message || "Couldn't build the sprite sheet.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => {
    if (sheetUrl.current) URL.revokeObjectURL(sheetUrl.current);
  }, []);

  // Play the chosen row of the finished sheet, exactly as a game would
  useEffect(() => {
    const canvas = previewRef.current;
    if (!sheet || !canvas) return;
    const row = sheet.rows.findIndex((r) => r.name === preview);
    if (row < 0) return;
    const count = sheet.rows[row].frames;
    canvas.width = sheet.cell.w;
    canvas.height = sheet.cell.h;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sheet.canvas, frame * sheet.cell.w, row * sheet.cell.h, sheet.cell.w, sheet.cell.h, 0, 0, sheet.cell.w, sheet.cell.h);
      frame = (frame + 1) % count;
    };
    draw();
    const timer = setInterval(draw, 1000 / Number(fps));
    return () => clearInterval(timer);
  }, [sheet, preview, fps]);

  const save = async (kind: "zip" | "png" | "json") => {
    if (!sheet) return;
    setError("");
    try {
      const name = `${sheet.baseName}.${kind}`;
      const blob =
        kind === "zip" ? await sheetZip(sheet, Number(fps)) : kind === "png" ? await sheetPng(sheet) : new Blob([JSON.stringify(sheet.atlas, null, 2)], { type: "application/json" });
      const outcome = await saveFile(name, blob);
      if (outcome === "saved") setSaved(name);
    } catch (err: any) {
      setError(err?.message || "Couldn't save the file.");
    }
  };

  const toggle = (s: GameState) =>
    setStates((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <div>
      <Section index="01" title="Animations" aside="All loop">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Animations to export">
          {GAME_STATES.map((s) => {
            const on = states.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.id)}
                className={cx("min-h-10 rounded-[3px] border px-3 text-[13px] transition-colors", on ? "border-fg/80 bg-fg/[0.06] text-fg" : "border-line text-muted hover:text-fg")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {clips.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <span className="eyebrow">Your motion clips</span>
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Motion clips to export">
              {clips.map((c) => {
                const on = clipIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setClipIds((prev) => {
                        const next = new Set(prev);
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                        return next;
                      })
                    }
                    className={cx("min-h-10 truncate rounded-[3px] border px-3 text-left text-[13px] transition-colors", on ? "border-fg/80 bg-fg/[0.06] text-fg" : "border-line text-muted hover:text-fg")}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-faint">Keyed and captured clips play on any body; a clip becomes its own looping row, named after it.</p>
          </div>
        )}
      </Section>
      <Section index="02" title="Format">
        <div className="flex flex-col gap-4">
          <Segmented label="Frame size (longest side)" value={size} onChange={setSize} options={[{ value: "64", label: "64 px" }, { value: "128", label: "128 px" }, { value: "256", label: "256 px" }]} />
          <Segmented label="Frame rate" value={fps} onChange={setFps} options={[{ value: "8", label: "8 fps" }, { value: "12", label: "12 fps" }, { value: "24", label: "24 fps" }]} />
          <Segmented label="Facing" value={facing} onChange={setFacing} options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} />
        </div>
      </Section>
      <div className="flex flex-col gap-4 border-t border-line pt-6 pb-8">
        <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={states.size === 0 && clipIds.size === 0} icon={<Gamepad2 className="h-5 w-5" />} onClick={build}>
          {sheet ? "Rebuild sprite sheet" : "Build sprite sheet"}
        </Button>
        {stale && <Notice tone="warn">The character changed since this sheet was built. Rebuild to include the changes.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {sheet && (
          <>
            <div className="flex gap-4">
              <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[3px] bg-[repeating-conic-gradient(#1b1b20_0%_25%,#141418_0%_50%)] bg-[length:16px_16px] ring-1 ring-line">
                <canvas ref={previewRef} className="max-h-full max-w-full" aria-label={`${preview} animation preview`} />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {sheet.rows.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => setPreview(r.name)}
                      aria-pressed={preview === r.name}
                      className={cx("max-w-full truncate rounded-full px-2.5 py-0.5 text-[12px]", preview === r.name ? "bg-fg text-ink" : "text-muted hover:text-fg")}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  {sheet.columns} × {sheet.rows.length} grid · {sheet.cell.w} × {sheet.cell.h} px cells · {sheet.canvas.width} × {sheet.canvas.height} px sheet
                </p>
              </div>
            </div>
            {sheetSrc && (
              <div className="max-h-48 overflow-auto rounded-[3px] bg-[repeating-conic-gradient(#1b1b20_0%_25%,#141418_0%_50%)] bg-[length:16px_16px] ring-1 ring-line">
                <img src={sheetSrc} alt="The full sprite sheet" className="max-w-none" style={{ width: Math.min(sheet.canvas.width, 900) }} />
              </div>
            )}
            <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={() => save("zip")}>
              Download .zip (sheet, atlas, notes)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => save("png")}>PNG only</Button>
              <Button onClick={() => save("json")}>Atlas JSON only</Button>
            </div>
            {saved && <Notice>Saved {saved}.</Notice>}
          </>
        )}
        <p className="text-xs leading-relaxed text-faint">
          One row per animation on a fixed grid. Phaser loads the atlas directly; Godot, Unity and GameMaker slice the grid. The zip's README has the exact import settings.
        </p>
      </div>
    </div>
  );
}
