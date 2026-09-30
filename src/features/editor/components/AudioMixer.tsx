import { Headphones, Volume2, VolumeX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { IconButton } from "@/components/common/icon-button";
import { cn } from "@/lib/utils";
import { COPY } from "@/config/copy";
import type { Clip } from "../types/clip";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

/** Per-clip audio: volume, pan, fades, mute — driven live into the Web Audio graph. */
export function ClipAudioPanel({ clip }: { clip: Clip }) {
  const update = (patch: Partial<Clip["audio"]>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      audio: { ...c.audio, ...patch },
    }));

  const maxFade = Math.max(0.1, clip.duration / 2);

  return (
    <Section title={COPY.inspector.audio}>
      <PropertySlider
        label={COPY.inspector.volume}
        value={clip.audio.volume}
        min={0}
        max={2}
        step={0.01}
        defaultValue={1}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ volume: v })}
      />
      <PropertySlider
        label={COPY.inspector.pan}
        value={clip.audio.pan}
        min={-1}
        max={1}
        step={0.01}
        defaultValue={0}
        format={(v) => (v === 0 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)}
        onChange={(v) => update({ pan: v })}
      />
      <PropertySlider
        label={COPY.inspector.fadeIn}
        value={clip.audio.fadeIn}
        min={0}
        max={maxFade}
        step={0.05}
        defaultValue={0}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(v) => update({ fadeIn: v })}
      />
      <PropertySlider
        label={COPY.inspector.fadeOut}
        value={clip.audio.fadeOut}
        min={0}
        max={maxFade}
        step={0.05}
        defaultValue={0}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={(v) => update({ fadeOut: v })}
      />
      <div className="flex items-center justify-between">
        <Label htmlFor={`mute-${clip.id}`} className="text-xs font-normal text-muted-foreground">
          {COPY.inspector.muteClip}
        </Label>
        <Switch
          id={`mute-${clip.id}`}
          checked={clip.audio.muted}
          onCheckedChange={(v) => update({ muted: v })}
        />
      </div>
    </Section>
  );
}

/** Track-level mixer strip: mute/solo per audio-bearing track plus bulk clip gain. */
export function AudioMixer() {
  const tracks = useEditor((s) => s.tracks);
  const store = useEditorStore.getState;
  const audible = tracks.filter((t) => t.kind === "audio" || t.kind === "video");

  return (
    <div className="space-y-3 p-4">
      {audible.length === 0 && (
        <p className="text-sm text-muted-foreground">{COPY.mediaLibrary.empty}</p>
      )}
      {audible.map((track) => {
        const clipVolumes = track.clips.map((c) => c.audio.volume);
        const avg =
          clipVolumes.length > 0
            ? clipVolumes.reduce((a, b) => a + b, 0) / clipVolumes.length
            : 1;
        return (
          <div key={track.id} className="rounded-lg border bg-card p-3 shadow-elevation-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold">{track.name}</p>
              <div className="flex items-center gap-0.5">
                <IconButton
                  label={COPY.editor.mute}
                  tooltip={false}
                  className={cn("h-7 w-7", track.muted && "text-destructive")}
                  onClick={() => store().setTrackFlag(track.id, "muted", !track.muted)}
                  aria-pressed={track.muted}
                >
                  {track.muted ? <VolumeX className="!h-3.5 !w-3.5" /> : <Volume2 className="!h-3.5 !w-3.5" />}
                </IconButton>
                <IconButton
                  label={COPY.editor.solo}
                  tooltip={false}
                  className={cn("h-7 w-7", track.solo && "text-warning")}
                  onClick={() => store().setTrackFlag(track.id, "solo", !track.solo)}
                  aria-pressed={track.solo}
                >
                  <Headphones className="!h-3.5 !w-3.5" />
                </IconButton>
              </div>
            </div>
            {track.clips.length > 0 && (
              <div className="mt-2">
                <PropertySlider
                  label={COPY.inspector.volume}
                  value={avg}
                  min={0}
                  max={2}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => {
                    const trackId = track.id;
                    const s = store();
                    for (const clip of s.tracks.find((t) => t.id === trackId)?.clips ?? []) {
                      s.updateClip(clip.id, (c) => ({ ...c, audio: { ...c.audio, volume: v } }));
                    }
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
