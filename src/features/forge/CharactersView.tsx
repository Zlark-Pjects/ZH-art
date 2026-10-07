import { Suspense, lazy, useState } from "react";
import type { CharacterLook, Grade } from "../../types";
import { cx } from "../../ui";
import { ForgeView } from "./ForgeView";

const CreativeSuite = lazy(() => import("../../components/CreativeSuite"));

const VIEWS = [
  { id: "forge", label: "Forge", hint: "Build bodies from parts, generate and breed" },
  { id: "portrait", label: "Portrait & grade", hint: "Faces, expressions and the film's colour grade" },
] as const;

/** Characters tab: the Forge for whole bodies, the portrait studio for faces and grade. */
export function CharactersView(props: {
  characters: CharacterLook[];
  grade: Grade;
  onSaveCharacter: (c: CharacterLook) => void;
  onDeleteCharacter: (id: string) => void;
  onApplyGrade: (g: Grade) => void;
}) {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("forge");
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Character tools" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            title={v.hint}
            onClick={() => setView(v.id)}
            className={cx(
              "rounded-full border px-4 py-1.5 text-[14px] transition-colors",
              view === v.id ? "border-fg/70 bg-fg/[0.06] text-fg" : "border-line text-muted hover:text-fg",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "forge" ? (
        <ForgeView characters={props.characters} onSave={props.onSaveCharacter} />
      ) : (
        <Suspense fallback={<p className="eyebrow py-24 text-center">Loading…</p>}>
          <CreativeSuite {...props} />
        </Suspense>
      )}
    </div>
  );
}
