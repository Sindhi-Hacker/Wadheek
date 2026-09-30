import * as React from "react";
import { CircleDot, Eraser, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Clip, EasingId, KeyframeProperty } from "../types/clip";
import {
  EASINGS,
  KEYFRAME_PROPERTIES,
  MOTION_PRESETS,
  countKeyframes,
} from "../lib/keyframes";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { formatTimecode } from "../lib/time-format";
import { Section } from "./inspector-controls";

/**
 * Keyframe studio for the selected clip:
 * - one-click motion presets (Ken Burns, fly-in, bounce, shake, …)
 * - per-property keyframe tracks with easing + precise delete
 * - auto-key toggle and the live motion recorder
 */
export function KeyframePanel({ clip }: { clip: Clip }) {
  const { currentTime, fps, autoKeyframes, defaultKeyframeEasing, motionRecording } = useEditor(
    (s) => ({
      currentTime: s.currentTime,
      fps: s.settings.fps,
      autoKeyframes: s.autoKeyframes,
      defaultKeyframeEasing: s.defaultKeyframeEasing,
      motionRecording: s.motionRecording,
    })
  );
  const store = useEditorStore.getState;

  const keyframable = React.useMemo(
    () => Object.values(KEYFRAME_PROPERTIES).filter((p) => p.supports(clip)),
    [clip]
  );
  const activeTracks = keyframable.filter((p) => (clip.keyframes?.[p.id] ?? []).length > 0);
  const total = countKeyframes(clip);

  return (
    <>
      <Section
        title="Keyframes"
        action={
          total > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => store().clearClipKeyframes(clip.id)}
            >
              <Eraser className="mr-1 h-3 w-3" /> Clear all
            </Button>
          ) : undefined
        }
      >
        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
          <div>
            <Label htmlFor="auto-key" className="text-xs font-medium">
              Auto keyframes
            </Label>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              Edits write a keyframe at the playhead
            </p>
          </div>
          <Switch
            id="auto-key"
            checked={autoKeyframes}
            onCheckedChange={() => store().toggleAutoKeyframes()}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
          <div className="min-w-0">
            <Label className="text-xs font-medium">New keyframe easing</Label>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              Curve used when adding keyframes
            </p>
          </div>
          <Select
            value={defaultKeyframeEasing}
            onValueChange={(v) => store().setDefaultKeyframeEasing(v as EasingId)}
          >
            <SelectTrigger className="h-7 w-[124px] shrink-0 text-xs" aria-label="Default easing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EASINGS.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5">
          <div className="min-w-0">
            <Label className="text-xs font-medium">Motion recorder</Label>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              Arm it, then drag the clip in the preview
            </p>
          </div>
          <Button
            size="sm"
            variant={motionRecording ? "destructive" : "secondary"}
            className="h-7 shrink-0 gap-1 text-xs"
            aria-pressed={motionRecording}
            onClick={() => {
              store().setMotionRecording(!motionRecording);
              toast(
                motionRecording
                  ? "Motion recorder off"
                  : "Armed — drag the clip around the preview to record its path"
              );
            }}
          >
            <CircleDot className="h-3.5 w-3.5" />
            {motionRecording ? "Recording" : "Arm"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {total > 0
            ? `${total} keyframes across ${activeTracks.length} properties · playhead ${formatTimecode(currentTime, fps)}`
            : "Add keyframes with the ◇ buttons next to any property, or use a motion preset."}
        </p>
      </Section>

      <Section title="Motion presets">
        <div className="grid grid-cols-3 gap-1.5">
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                store().applyClipMotionPreset(clip.id, preset.id);
                toast.success(`${preset.label} applied — keyframes are fully editable`);
              }}
              className="flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Presets write editable keyframes — tweak them below or in the graph.
        </p>
      </Section>

      {activeTracks.length > 0 && (
        <Section title="Keyframe tracks">
          <div className="space-y-3">
            {activeTracks.map((def) => {
              const kfs = clip.keyframes?.[def.id] ?? [];
              return (
                <div key={def.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="block h-2 w-2 rotate-45 bg-primary" aria-hidden />
                      <span className="text-xs font-medium">{def.label}</span>
                      <span className="text-[10px] text-muted-foreground">({kfs.length})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => store().clearClipKeyframes(clip.id, def.id)}
                      aria-label={`Clear ${def.label} keyframes`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="divide-y">
                    {kfs.map((kf, i) => {
                      const isAtPlayhead =
                        Math.abs(kf.time - currentTime) <= 0.5 / Math.max(1, fps);
                      return (
                        <div
                          key={kf.id}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]",
                            isAtPlayhead && "bg-accent/50"
                          )}
                        >
                          <button
                            className="shrink-0 rounded-sm px-1 font-mono tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Jump to this keyframe"
                            onClick={() => store().setCurrentTime(kf.time)}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </button>
                          <span className="w-14 shrink-0 font-mono tabular-nums">
                            {formatTimecode(kf.time, fps)}
                          </span>
                          <span className="w-16 shrink-0 truncate font-mono tabular-nums text-muted-foreground">
                            {def.format(kf.value)}
                          </span>
                          <Select
                            value={kf.easing}
                            onValueChange={(v) =>
                              store().setClipKeyframeEasing(clip.id, def.id, kf.id, v as EasingId)
                            }
                          >
                            <SelectTrigger
                              className="h-6 flex-1 border-0 bg-transparent px-1 text-[11px] shadow-none"
                              aria-label={`Easing for keyframe ${i + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EASINGS.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => store().removeClipKeyframe(clip.id, def.id, kf.id)}
                            aria-label={`Delete keyframe ${i + 1}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}

/** Shown in the inspector when the clip has keyframes: quick graph access. */
export function KeyframeBadgeRow({ clip }: { clip: Clip }) {
  const total = countKeyframes(clip);
  if (total === 0) return null;
  const props = Object.entries(clip.keyframes ?? {})
    .filter(([, kfs]) => kfs && kfs.length > 0)
    .map(([prop]) => KEYFRAME_PROPERTIES[prop as KeyframeProperty]?.label ?? prop);
  return (
    <p className="px-4 pt-3 text-[11px] text-muted-foreground">
      ◇ {total} keyframes · {props.slice(0, 4).join(", ")}
      {props.length > 4 ? ` +${props.length - 4}` : ""}
    </p>
  );
}
