import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { COPY } from "@/config/copy";
import { TRANSITIONS } from "@/config/defaults";
import type { Clip, TransitionType } from "../types/clip";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

function TransitionEditor({
  clip,
  side,
}: {
  clip: Clip;
  side: "transitionIn" | "transitionOut";
}) {
  const transition = clip[side];
  const label = side === "transitionIn" ? COPY.inspector.transitionIn : COPY.inspector.transitionOut;

  const update = (patch: Partial<typeof transition>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      [side]: { ...c[side], ...patch },
    }));

  return (
    <div className="space-y-2">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Select
        value={transition.type}
        onValueChange={(v) => update({ type: v as TransitionType })}
      >
        <SelectTrigger className="h-8 text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRANSITIONS.types.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {transition.type !== "none" && (
        <PropertySlider
          label={COPY.inspector.duration}
          value={transition.duration}
          min={TRANSITIONS.minDuration}
          max={Math.min(TRANSITIONS.maxDuration, clip.duration)}
          step={0.05}
          defaultValue={TRANSITIONS.defaultDuration}
          format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) => update({ duration: v })}
        />
      )}
    </div>
  );
}

/** Crossfade / dip / slide / wipe / zoom transitions on either clip edge. */
export function TransitionPanel({ clip }: { clip: Clip }) {
  return (
    <Section title={COPY.inspector.transitions}>
      <TransitionEditor clip={clip} side="transitionIn" />
      <TransitionEditor clip={clip} side="transitionOut" />
    </Section>
  );
}
