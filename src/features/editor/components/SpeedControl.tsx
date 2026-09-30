import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { COPY } from "@/config/copy";
import { SPEED_RANGE } from "@/config/defaults";
import { cn } from "@/lib/utils";
import type { Clip } from "../types/clip";
import { getAsset } from "@/features/media/media-store";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

/** Per-clip speed 0.25x–4x with source-length-aware duration recalc. */
export function SpeedControl({ clip }: { clip: Clip }) {
  const setSpeed = (speed: number) => {
    useEditorStore.getState().updateClip(clip.id, (c) => {
      const media = getAsset(c.mediaId);
      let duration = (c.duration * c.speed) / speed;
      if (media && c.kind !== "image" && media.duration > 0) {
        const maxDur = (media.duration - c.inOffset) / speed;
        duration = Math.min(duration, maxDur);
      }
      return { ...c, speed, duration: Math.max(0.05, duration) };
    });
  };

  return (
    <Section title={COPY.inspector.speed}>
      <PropertySlider
        label={COPY.inspector.speed}
        value={clip.speed}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
        defaultValue={1}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={setSpeed}
      />
      <div className="flex flex-wrap gap-1.5">
        {SPEED_RANGE.presets.map((preset) => (
          <button
            key={preset}
            onClick={() => setSpeed(preset)}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-xs transition-colors duration-fast hover:bg-accent",
              clip.speed === preset
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}
          >
            {preset}x
          </button>
        ))}
      </div>
      {clip.kind !== "image" && clip.kind !== "text" && (
        <div className="flex items-center justify-between">
          <Label htmlFor={`pitch-${clip.id}`} className="text-xs font-normal text-muted-foreground">
            {COPY.inspector.preservePitch}
          </Label>
          <Switch
            id={`pitch-${clip.id}`}
            checked={clip.audio.preservePitch}
            onCheckedChange={(v) =>
              useEditorStore.getState().updateClip(clip.id, (c) => ({
                ...c,
                audio: { ...c.audio, preservePitch: v },
              }))
            }
          />
        </div>
      )}
    </Section>
  );
}
