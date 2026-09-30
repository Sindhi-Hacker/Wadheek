import * as React from "react";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import { snapTime, type SnapResult } from "../lib/snapping-engine";
import { pickRulerStep } from "../lib/timeline-math";
import { useEditorStore } from "./useEditorStore";

/**
 * Magnetic snapping against clip edges, playhead, markers and the adaptive
 * grid. Honors the global snap toggle and a modifier-key override (Alt).
 */
export function useSnapping() {
  return React.useCallback(
    (time: number, ignoreClipIds: Set<string>, overrideDisabled: boolean): SnapResult => {
      const s = useEditorStore.getState();
      if (!s.snapping || overrideDisabled) {
        return { time: Math.max(0, time), snapped: false, target: null };
      }
      const grid = pickRulerStep(s.pps);
      return snapTime(time, {
        tracks: s.tracks,
        ignoreClipIds,
        playhead: s.currentTime,
        markers: s.markers,
        inPoint: s.inPoint,
        outPoint: s.outPoint,
        gridStep: grid.minor,
        pps: s.pps,
        thresholdPx: TIMELINE_DEFAULTS.snapThresholdPx,
      });
    },
    []
  );
}
