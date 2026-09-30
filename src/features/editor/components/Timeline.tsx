import * as React from "react";
import { ListPlus, Scissors, Trash2, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/common/icon-button";
import { Separator } from "@/components/ui/separator";
import { COPY } from "@/config/copy";
import { TIMELINE_DEFAULTS, TRACK_KIND_META } from "@/config/defaults";
import { cn } from "@/lib/utils";
import type { TrackKind } from "../types/track";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { useTimeline } from "../hooks/useTimeline";
import { TimelineRuler } from "./TimelineRuler";
import { TrackHeader } from "./TrackList";
import { TrackLane } from "./Track";
import { Playhead } from "./Playhead";
import { ZoomControls } from "./ZoomControls";
import { SnapToggle } from "./SnapToggle";
import { EmptyTimelineState } from "./EmptyTimelineState";
import { formatTimecode } from "../lib/time-format";

interface TimelineProps {
  compact?: boolean;
  onImportRequest: () => void;
}

const TRACK_KINDS: TrackKind[] = ["video", "overlay", "text", "audio"];

/**
 * Multi-track timeline: zoomable/pannable, pinch-to-zoom, snapping guides,
 * drag-and-drop from the media library, sticky headers, adaptive ruler.
 */
export function Timeline({ compact = false, onImportRequest }: TimelineProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { contentWidth, contentDuration, duration, fps } = useTimeline();
  const { tracks, selection, snapGuideTime, pps, playing } = useEditor((s) => ({
    tracks: s.tracks,
    selection: s.selection,
    snapGuideTime: s.snapGuideTime,
    pps: s.pps,
    playing: s.playing,
  }));

  const isEmpty = tracks.every((t) => t.clips.length === 0);
  const headerWidth = compact ? 96 : 176;

  /* Follow the playhead while playing. */
  const currentTime = useEditor((s) => s.currentTime);
  React.useEffect(() => {
    if (!playing) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = currentTime * pps;
    const visibleLeft = el.scrollLeft;
    const visibleRight = el.scrollLeft + el.clientWidth - headerWidth;
    if (x < visibleLeft || x > visibleRight - TIMELINE_DEFAULTS.autoScrollEdgePx) {
      el.scrollLeft = Math.max(0, x - TIMELINE_DEFAULTS.autoScrollEdgePx * 2);
    }
  }, [currentTime, playing, pps, headerWidth]);

  /* Ctrl/Cmd + wheel zoom anchored at cursor; pinch-to-zoom via 2 pointers. */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const store = useEditorStore.getState();
      const factor = e.deltaY < 0 ? TIMELINE_DEFAULTS.zoomStep : 1 / TIMELINE_DEFAULTS.zoomStep;
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - headerWidth + el.scrollLeft;
      const timeAtCursor = cursorX / store.pps;
      store.setPps(store.pps * factor);
      const newPps = useEditorStore.getState().pps;
      el.scrollLeft = Math.max(0, timeAtCursor * newPps - (e.clientX - rect.left - headerWidth));
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartPps = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        pinchStartPps = useEditorStore.getState().pps;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist > 0) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        useEditorStore.getState().setPps(pinchStartPps * (dist / pinchStartDist));
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [headerWidth]);

  const store = useEditorStore.getState;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-timeline"
      role="application"
      aria-label={COPY.a11y.timeline}
    >
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-panel px-2 py-1 text-panel-foreground">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span>
              <IconButton label={COPY.editor.addTrack} tooltip>
                <ListPlus className="h-4 w-4" />
              </IconButton>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TRACK_KINDS.map((kind) => (
              <DropdownMenuItem
                key={kind}
                onClick={() => {
                  store().addTrack(kind);
                  toast(COPY.toasts.trackAdded);
                }}
              >
                <span
                  className={cn("h-3 w-3 rounded-sm", TRACK_KIND_META[kind].clipClass.split(" ")[0])}
                  aria-hidden
                />
                {TRACK_KIND_META[kind].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          label="Add text overlay"
          onClick={() => store().addTextClip()}
        >
          <TypeIcon className="h-4 w-4" />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <IconButton
          label={COPY.editor.split}
          onClick={() => {
            const n = store().splitAtTime(store().currentTime);
            if (n > 0) toast(COPY.toasts.clipSplit);
          }}
        >
          <Scissors className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={COPY.editor.delete}
          disabled={selection.length === 0}
          onClick={() => {
            const n = store().deleteClips(store().selection);
            if (n > 0) toast(COPY.toasts.clipsDeleted(n));
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <SnapToggle />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {formatTimecode(duration, fps)}
          </span>
          <ZoomControls
            getViewportWidth={() => (scrollRef.current?.clientWidth ?? 800) - headerWidth}
          />
        </div>
      </div>

      {/* Scrollable lanes */}
      <div
        ref={scrollRef}
        className="timeline-surface relative min-h-0 flex-1 overflow-auto overscroll-contain"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div className="flex min-w-max">
          {/* Sticky header column */}
          <div
            className="sticky left-0 z-40 shrink-0 border-r border-sidebar-border bg-sidebar"
            style={{ width: headerWidth }}
          >
            <div
              className="sticky top-0 z-50 border-b border-sidebar-border bg-sidebar"
              style={{ height: TIMELINE_DEFAULTS.rulerHeight }}
            />
            {tracks.map((track) => (
              <TrackHeader key={track.id} track={track} compact={compact} />
            ))}
          </div>

          {/* Content */}
          <div className="relative" style={{ width: contentWidth }}>
            <div className="sticky top-0 z-30">
              <TimelineRuler contentWidth={contentWidth} contentDuration={contentDuration} />
            </div>
            {tracks.map((track) => (
              <TrackLane key={track.id} track={track} contentWidth={contentWidth} compact={compact} />
            ))}

            {/* Snap guide */}
            {snapGuideTime !== null && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-snap-guide"
                style={{ left: snapGuideTime * pps }}
                aria-hidden
              />
            )}
            <Playhead />
          </div>
        </div>
        {isEmpty && <EmptyTimelineState onImport={onImportRequest} />}
      </div>
    </div>
  );
}
