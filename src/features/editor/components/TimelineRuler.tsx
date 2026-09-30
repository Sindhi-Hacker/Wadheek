import * as React from "react";
import { Bookmark } from "lucide-react";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import { COPY } from "@/config/copy";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { pickRulerStep } from "../lib/timeline-math";
import { formatRulerLabel } from "../lib/time-format";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";

interface TimelineRulerProps {
  contentWidth: number;
  contentDuration: number;
}

/**
 * Adaptive time ruler: tick density follows zoom, markers are rendered as
 * flags, the in/out range is highlighted, and dragging scrubs the playhead.
 */
export function TimelineRuler({ contentWidth, contentDuration }: TimelineRulerProps) {
  const { pps, markers, inPoint, outPoint } = useEditor((s) => ({
    pps: s.pps,
    markers: s.markers,
    inPoint: s.inPoint,
    outPoint: s.outPoint,
  }));
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const { major, minor } = pickRulerStep(pps);
  const ticks: { time: number; isMajor: boolean }[] = [];
  for (let t = 0; t <= contentDuration; t += minor) {
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    ticks.push({ time: t, isMajor });
  }

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const time = Math.max(0, (e.clientX - rect.left) / pps);
    const store = useEditorStore.getState();
    store.setPlaying(false);
    store.setCurrentTime(time);
  };

  return (
    <div
      className="relative cursor-col-resize select-none border-b bg-timeline-ruler"
      style={{ width: contentWidth, height: TIMELINE_DEFAULTS.rulerHeight }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        scrub(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) scrub(e);
      }}
      role="slider"
      aria-label={COPY.a11y.playhead}
      aria-valuenow={Math.round(useEditorStore.getState().currentTime * 10) / 10}
      tabIndex={-1}
    >
      {/* In/Out range highlight */}
      {inPoint !== null && outPoint !== null && outPoint > inPoint && (
        <div
          className="absolute inset-y-0 bg-primary/20"
          style={{ left: inPoint * pps, width: (outPoint - inPoint) * pps }}
          aria-hidden
        />
      )}
      {inPoint !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: inPoint * pps }} aria-hidden />
      )}
      {outPoint !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: outPoint * pps }} aria-hidden />
      )}

      {ticks.map(({ time, isMajor }) => (
        <div
          key={time.toFixed(3)}
          className="absolute bottom-0 w-px bg-grid-line"
          style={{ left: time * pps, height: isMajor ? 12 : 6 }}
          aria-hidden
        >
          {isMajor && (
            <span className="absolute bottom-3 left-1 whitespace-nowrap font-mono text-[10px] leading-none text-muted-foreground">
              {formatRulerLabel(time, major)}
            </span>
          )}
        </div>
      ))}

      {/* Markers */}
      {markers.map((marker) => (
        <ContextMenu key={marker.id}>
          <ContextMenuTrigger asChild>
            <button
              className="absolute -bottom-px z-10 -translate-x-1/2 text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: marker.time * pps }}
              title={marker.name}
              aria-label={`Marker: ${marker.name}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => useEditorStore.getState().setCurrentTime(marker.time)}
            >
              <Bookmark className="h-3.5 w-3.5 fill-current" />
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <div className="px-2 py-1.5">
              {renamingId === marker.id ? (
                <input
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      useEditorStore.getState().renameMarker(marker.id, draft || marker.name);
                      setRenamingId(null);
                    }
                  }}
                  onBlur={() => {
                    useEditorStore.getState().renameMarker(marker.id, draft || marker.name);
                    setRenamingId(null);
                  }}
                  className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs"
                />
              ) : (
                <p className="text-xs font-medium">{marker.name}</p>
              )}
            </div>
            <ContextMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setDraft(marker.name);
                setRenamingId(marker.id);
              }}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={() => useEditorStore.getState().setCurrentTime(marker.time)}>
              Jump to marker
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => useEditorStore.getState().removeMarker(marker.id)}
            >
              Delete marker
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
