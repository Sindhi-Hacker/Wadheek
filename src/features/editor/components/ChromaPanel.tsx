import { Pipette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/common/color-picker";
import { cn } from "@/lib/utils";
import type { Clip } from "../types/clip";
import { CHROMA_SWATCHES, defaultChromaSettings } from "../lib/chroma-key";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

/** Green-screen key-out for video clips. */
export function ChromaPanel({ clip }: { clip: Clip }) {
  const chroma = clip.chroma ?? defaultChromaSettings();
  const update = (patch: Partial<typeof chroma>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      chroma: { ...(c.chroma ?? defaultChromaSettings()), ...patch },
    }));

  return (
    <Section title="Green screen">
      <div className="flex items-center justify-between">
        <Label htmlFor={`chroma-${clip.id}`} className="text-xs font-normal text-muted-foreground">
          Enable key (chroma)
        </Label>
        <Switch
          id={`chroma-${clip.id}`}
          checked={chroma.enabled}
          onCheckedChange={(v) => update({ enabled: v })}
        />
      </div>
      {chroma.enabled && (
        <>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Key color</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {CHROMA_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  className={cn(
                    "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110",
                    chroma.color.toLowerCase() === swatch.color.toLowerCase()
                      ? "border-primary"
                      : "border-border"
                  )}
                  style={{ background: swatch.color }}
                  onClick={() => update({ color: swatch.color })}
                  aria-label={`Key ${swatch.label}`}
                  title={swatch.label}
                />
              ))}
              <ColorPicker
                value={chroma.color}
                onChange={(v) => update({ color: v })}
                label="Custom key color"
              />
            </div>
          </div>
          <PropertySlider
            label="Similarity"
            value={chroma.similarity}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.32}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ similarity: v })}
          />
          <PropertySlider
            label="Smoothness"
            value={chroma.smoothness}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.12}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ smoothness: v })}
          />
          <PropertySlider
            label="Spill suppression"
            value={chroma.spill}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.6}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ spill: v })}
          />
          <p className="flex items-start gap-1.5 text-[11px] leading-tight text-muted-foreground">
            <Pipette className="mt-0.5 h-3 w-3 shrink-0" />
            Pick the exact backdrop color for best results — keying compares chroma, so shadows
            and highlights stay intact.
          </p>
        </>
      )}
    </Section>
  );
}
