import type { Grade } from "../../types";
import type { Studio } from "../useStudio";
import { GRADE_PRESETS } from "../../project/rig";
import { Button, ColorField, Section, Segmented, Slider } from "../../ui";

const LABELS: Record<Grade["preset"], string> = {
  none: "Neutral",
  "teal-orange": "Teal & orange",
  noir: "Noir",
  violet: "Violet",
  gold: "Gold",
  vivid: "Vivid",
};

/** The film's colour grade: applied live to every scene, the preview and the export. */
export function GradePanel({ studio }: { studio: Studio }) {
  const grade = studio.project.grade;
  const set = (patch: Partial<Grade>) => studio.setGrade({ ...grade, ...patch });
  return (
    <Section index="02" title="Film grade" aside="Every scene">
      <div className="flex flex-col gap-5">
        <Segmented
          label="Preset"
          value={grade.preset}
          onChange={(preset) => studio.setGrade({ ...GRADE_PRESETS[preset] })}
          columns={3}
          options={(Object.keys(GRADE_PRESETS) as Grade["preset"][]).map((p) => ({ value: p, label: LABELS[p] }))}
        />
        <Slider label="Contrast" value={grade.contrast} min={60} max={160} onChange={(contrast) => set({ contrast })} format={(v) => `${v}%`} />
        <Slider label="Saturation" value={grade.saturation} min={0} max={200} onChange={(saturation) => set({ saturation })} format={(v) => `${v}%`} />
        <Slider label="Vignette" value={grade.vignette} min={0} max={100} onChange={(vignette) => set({ vignette })} format={(v) => `${v}%`} />
        <div className="grid grid-cols-2 items-end gap-4">
          <ColorField label="Tint" value={grade.tint} onChange={(tint) => set({ tint, tintAmount: grade.tintAmount || 12 })} />
          <Slider label="Tint amount" value={grade.tintAmount} min={0} max={40} onChange={(tintAmount) => set({ tintAmount })} format={(v) => `${v}%`} />
        </div>
        <Button size="sm" variant="ghost" className="self-start" onClick={() => studio.setGrade({ ...GRADE_PRESETS.none })}>
          Reset to neutral
        </Button>
      </div>
    </Section>
  );
}
