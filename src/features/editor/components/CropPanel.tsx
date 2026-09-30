import { COPY } from "@/config/copy";
import type { Clip, ClipCrop } from "../types/clip";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

const EDGES: { id: keyof ClipCrop; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
];

export function CropPanel({ clip }: { clip: Clip }) {
  return (
    <Section title={COPY.inspector.crop}>
      {EDGES.map((edge) => (
        <PropertySlider
          key={edge.id}
          label={edge.label}
          value={clip.crop[edge.id]}
          min={0}
          max={0.49}
          step={0.005}
          defaultValue={0}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) =>
            useEditorStore.getState().updateClip(clip.id, (c) => ({
              ...c,
              crop: { ...c.crop, [edge.id]: v },
            }))
          }
        />
      ))}
    </Section>
  );
}
