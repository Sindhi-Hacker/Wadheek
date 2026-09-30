import { Button } from "@/components/ui/button";
import { COPY } from "@/config/copy";
import { FILTER_DEFS, FILTER_PRESETS } from "@/config/defaults";
import { cn } from "@/lib/utils";
import type { Clip, ClipFilters } from "../types/clip";
import { defaultFilters } from "../lib/clip-operations";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

export function FilterPanel({ clip }: { clip: Clip }) {
  const update = (patch: Partial<ClipFilters>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      filters: { ...c.filters, ...patch, presetId: patch.presetId ?? "custom" },
    }));

  const applyPreset = (presetId: string) => {
    const preset = FILTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      filters: { ...defaultFilters(), ...preset.values, presetId },
    }));
  };

  return (
    <Section
      title={COPY.inspector.filters}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => applyPreset("none")}
        >
          {COPY.inspector.resetAll}
        </Button>
      }
    >
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">{COPY.inspector.presets}</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors duration-fast hover:bg-accent",
                clip.filters.presetId === preset.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {FILTER_DEFS.map((def) => (
        <PropertySlider
          key={def.id}
          label={def.label}
          value={clip.filters[def.id]}
          min={def.min}
          max={def.max}
          step={def.step}
          defaultValue={def.def}
          onChange={(v) => update({ [def.id]: v } as Partial<ClipFilters>)}
        />
      ))}
    </Section>
  );
}
