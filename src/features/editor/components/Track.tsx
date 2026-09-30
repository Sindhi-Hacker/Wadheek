import * as React from "react";
import { cn } from "@/lib/utils";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import type { Track as TrackType } from "../types/track";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { Clip } from "./Clip";
import { getAsset } from "@/features/media/media-store";

export function trackHeight(track: TrackType, compact: boolean): number {
  if (compact) return TIMELINE_DEFAULTS.compactTrackHeight;
  return track.kind === "audio"
    ? TIMELINE_DEFAULTS.audioTrackHeight
    : TIMELINE_DEFAULTS.trackHeight;
}

interface TrackLaneProps {
  track: TrackType;
  contentWidth: number;
  compact: boolean;
}

/** A single timeline lane: drop target for media, hosts clips. */
export function TrackLane({ track, contentWidth, compact }: TrackLaneProps) {
  const pps = useEditor((s) => s.pps);
  const [dropActive, setDropActive] = React.useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const mediaId = e.dataTransfer.getData("application/x-wadheek-media");
    if (!mediaId) return;
    const asset = getAsset(mediaId);
    if (!asset) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const time = Math.max(0, (e.clientX - rect.left) / pps);
    useEditorStore.getState().addClipFromMedia(asset, { trackId: track.id, time });
  };

  return (
    <div
      className={cn(
        "relative border-b border-grid-line/60 transition-colors duration-fast",
        track.hidden && "opacity-45",
        track.locked && "bg-muted/30",
        dropActive && "bg-primary/10"
      )}
      style={{ width: contentWidth, height: trackHeight(track, compact) }}
      data-track-id={track.id}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-wadheek-media")) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={onDrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          useEditorStore.getState().clearSelection();
        }
      }}
    >
      {track.clips.map((clip) => (
        <Clip key={clip.id} clip={clip} track={track} />
      ))}
    </div>
  );
}
