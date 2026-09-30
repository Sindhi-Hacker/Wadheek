import * as React from "react";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import { timelineDuration } from "../lib/timeline-math";
import { useEditor, useEditorStore } from "./useEditorStore";

/** Derived timeline values + zoom helpers shared by ruler, tracks and transport. */
export function useTimeline() {
  const { tracks, pps, currentTime, settings } = useEditor((s) => ({
    tracks: s.tracks,
    pps: s.pps,
    currentTime: s.currentTime,
    settings: s.settings,
  }));

  const duration = React.useMemo(() => timelineDuration(tracks), [tracks]);
  /** Content width: duration plus breathing room for appending clips. */
  const contentDuration = Math.max(duration + 60 / pps + 10, 30);
  const contentWidth = contentDuration * pps;

  const zoomIn = React.useCallback(() => {
    const s = useEditorStore.getState();
    s.setPps(s.pps * TIMELINE_DEFAULTS.zoomStep);
  }, []);

  const zoomOut = React.useCallback(() => {
    const s = useEditorStore.getState();
    s.setPps(s.pps / TIMELINE_DEFAULTS.zoomStep);
  }, []);

  const zoomToFit = React.useCallback((viewportWidth: number) => {
    const s = useEditorStore.getState();
    const dur = timelineDuration(s.tracks);
    if (dur <= 0 || viewportWidth <= 0) {
      s.setPps(TIMELINE_DEFAULTS.pixelsPerSecond);
      return;
    }
    s.setPps((viewportWidth - 32) / dur);
  }, []);

  return {
    tracks,
    pps,
    currentTime,
    duration,
    contentDuration,
    contentWidth,
    fps: settings.fps,
    zoomIn,
    zoomOut,
    zoomToFit,
  };
}
