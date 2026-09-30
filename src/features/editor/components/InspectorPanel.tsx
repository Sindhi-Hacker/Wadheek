import { MousePointerClick } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { TimecodeInput } from "@/components/common/timecode-input";
import { COPY } from "@/config/copy";
import { BLEND_MODES } from "@/config/defaults";
import type { Clip } from "../types/clip";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";
import { FilterPanel } from "./FilterPanel";
import { TextOverlayEditor } from "./TextOverlayEditor";
import { TransitionPanel } from "./TransitionPanel";
import { SpeedControl } from "./SpeedControl";
import { CropPanel } from "./CropPanel";
import { ClipAudioPanel, AudioMixer } from "./AudioMixer";

function TransformSection({ clip }: { clip: Clip }) {
  const update = (patch: Partial<Clip["transform"]>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      transform: { ...c.transform, ...patch },
    }));

  return (
    <Section title={COPY.inspector.transform}>
      <PropertySlider
        label={`${COPY.inspector.position} X`}
        value={clip.transform.x}
        min={-1}
        max={1}
        step={0.005}
        defaultValue={0}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ x: v })}
      />
      <PropertySlider
        label={`${COPY.inspector.position} Y`}
        value={clip.transform.y}
        min={-1}
        max={1}
        step={0.005}
        defaultValue={0}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ y: v })}
      />
      <PropertySlider
        label={COPY.inspector.scale}
        value={clip.transform.scale}
        min={0.05}
        max={4}
        step={0.01}
        defaultValue={1}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ scale: v })}
      />
      <PropertySlider
        label={COPY.inspector.rotation}
        value={clip.transform.rotation}
        min={-180}
        max={180}
        step={1}
        defaultValue={0}
        format={(v) => `${Math.round(v)} deg`}
        onChange={(v) => update({ rotation: v })}
      />
      <PropertySlider
        label={COPY.inspector.opacity}
        value={clip.transform.opacity}
        min={0}
        max={1}
        step={0.01}
        defaultValue={1}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ opacity: v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-normal text-muted-foreground">
          {COPY.inspector.blendMode}
        </Label>
        <Select
          value={clip.blendMode}
          onValueChange={(v) =>
            useEditorStore.getState().updateClip(clip.id, (c) => ({ ...c, blendMode: v }))
          }
        >
          <SelectTrigger className="h-8 text-xs" aria-label={COPY.inspector.blendMode}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {mode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Section>
  );
}

function TimingSection({ clip }: { clip: Clip }) {
  const fps = useEditor((s) => s.settings.fps);
  return (
    <Section title={COPY.inspector.timing}>
      <div className="space-y-1.5">
        <Label className="text-xs font-normal text-muted-foreground">{COPY.inspector.clipName}</Label>
        <Input
          value={clip.label}
          className="h-8 text-xs"
          onChange={(e) =>
            useEditorStore.getState().updateClip(clip.id, (c) => ({ ...c, label: e.target.value }))
          }
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">{COPY.inspector.start}</Label>
          <TimecodeInput
            value={clip.start}
            fps={fps}
            className="w-full"
            onChange={(t) =>
              useEditorStore.getState().updateClip(clip.id, (c) => ({ ...c, start: Math.max(0, t) }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">
            {COPY.inspector.duration}
          </Label>
          <TimecodeInput
            value={clip.duration}
            fps={fps}
            className="w-full"
            onChange={(t) =>
              useEditorStore.getState().updateClip(clip.id, (c) => ({
                ...c,
                duration: Math.max(0.05, t),
              }))
            }
          />
        </div>
      </div>
    </Section>
  );
}

/** Context-sensitive inspector: sections adapt to the current selection. */
export function InspectorPanel() {
  const { selection, tracks } = useEditor((s) => ({ selection: s.selection, tracks: s.tracks }));

  const clips: Clip[] = [];
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (selection.includes(clip.id)) clips.push(clip);
    }
  }
  const clip = clips[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <Tabs defaultValue="properties" className="flex h-full min-h-0 flex-col">
        <div className="border-b px-3 pt-2">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="properties" className="flex-1 text-xs">
              {COPY.editor.inspector}
            </TabsTrigger>
            <TabsTrigger value="mixer" className="flex-1 text-xs">
              {COPY.inspector.audio}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="properties" className="mt-0 min-h-0 flex-1">
          {!clip ? (
            <div className="p-4">
              <EmptyState
                icon={MousePointerClick}
                title={COPY.inspector.empty}
                description={COPY.inspector.emptyBody}
                className="border-0 bg-transparent py-10"
              />
            </div>
          ) : (
            <ScrollArea className="h-full">
              {clips.length > 1 && (
                <p className="border-b bg-accent/40 px-4 py-2 text-xs text-muted-foreground">
                  {clips.length} {COPY.inspector.multi}
                </p>
              )}
              <TimingSection clip={clip} />
              {clip.kind !== "audio" && <TransformSection clip={clip} />}
              {clip.kind === "text" && <TextOverlayEditor clip={clip} />}
              {(clip.kind === "video" || clip.kind === "image") && <FilterPanel clip={clip} />}
              {(clip.kind === "video" || clip.kind === "image") && <CropPanel clip={clip} />}
              {clip.kind !== "text" && clip.kind !== "image" && <SpeedControl clip={clip} />}
              {clip.kind !== "text" && <TransitionPanel clip={clip} />}
              {(clip.kind === "video" || clip.kind === "audio") && <ClipAudioPanel clip={clip} />}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="mixer" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
            <AudioMixer />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
