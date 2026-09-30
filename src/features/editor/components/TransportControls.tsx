import {
  Bookmark,
  ChevronFirst,
  ChevronLast,
  CornerDownLeft,
  CornerDownRight,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { IconButton } from "@/components/common/icon-button";
import { TimecodeInput } from "@/components/common/timecode-input";
import { Separator } from "@/components/ui/separator";
import { COPY } from "@/config/copy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatTimecode } from "../lib/time-format";
import { timelineDuration } from "../lib/timeline-math";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";

/** Transport row under the program monitor; reflows to a compact icon row on phones. */
export function TransportControls({ compact = false }: { compact?: boolean }) {
  const { playing, currentTime, fps, loop, inPoint, outPoint, tracks } = useEditor((s) => ({
    playing: s.playing,
    currentTime: s.currentTime,
    fps: s.settings.fps,
    loop: s.loop,
    inPoint: s.inPoint,
    outPoint: s.outPoint,
    tracks: s.tracks,
  }));
  const duration = timelineDuration(tracks);
  const store = useEditorStore.getState;
  const frame = 1 / fps;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-0.5 border-t bg-panel px-2 py-1.5 text-panel-foreground",
        compact && "flex-wrap"
      )}
    >
      <TimecodeInput
        value={currentTime}
        fps={fps}
        onChange={(t) => store().setCurrentTime(t)}
        aria-label={COPY.a11y.playhead}
        className={cn(compact && "order-first w-full max-w-none border-0 bg-transparent shadow-none")}
      />

      <Separator orientation="vertical" className={cn("mx-1 h-6", compact && "hidden")} />

      <IconButton label={COPY.editor.goToStart} onClick={() => store().setCurrentTime(0)}>
        <ChevronFirst className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={COPY.editor.prevFrame}
        onClick={() => {
          store().setPlaying(false);
          store().setCurrentTime(store().currentTime - frame);
        }}
      >
        <SkipBack className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={playing ? COPY.editor.pause : COPY.editor.play}
        variant="secondary"
        size="icon"
        className="mx-1 rounded-full"
        onClick={() => store().togglePlay()}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </IconButton>
      <IconButton
        label={COPY.editor.nextFrame}
        onClick={() => {
          store().setPlaying(false);
          store().setCurrentTime(store().currentTime + frame);
        }}
      >
        <SkipForward className="h-4 w-4" />
      </IconButton>
      <IconButton label={COPY.editor.goToEnd} onClick={() => store().setCurrentTime(duration)}>
        <ChevronLast className="h-4 w-4" />
      </IconButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <IconButton
        label={COPY.editor.setIn}
        className={cn(inPoint !== null && "text-primary")}
        onClick={() => store().setInPoint(store().currentTime)}
      >
        <CornerDownRight className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={COPY.editor.setOut}
        className={cn(outPoint !== null && "text-primary")}
        onClick={() => store().setOutPoint(store().currentTime)}
      >
        <CornerDownLeft className="h-4 w-4" />
      </IconButton>
      {(inPoint !== null || outPoint !== null) && (
        <IconButton label={COPY.editor.clearInOut} onClick={() => store().clearInOut()}>
          <X className="h-4 w-4" />
        </IconButton>
      )}
      <IconButton
        label={COPY.editor.loop}
        className={cn(loop && "bg-accent text-primary")}
        onClick={() => store().toggleLoop()}
        aria-pressed={loop}
      >
        <Repeat className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={COPY.editor.addMarker}
        onClick={() => {
          store().addMarker(store().currentTime);
          toast(COPY.toasts.markerAdded);
        }}
      >
        <Bookmark className="h-4 w-4" />
      </IconButton>

      {!compact && (
        <span className="ml-2 hidden font-mono text-xs text-muted-foreground lg:inline">
          / {formatTimecode(duration, fps)}
        </span>
      )}
    </div>
  );
}
