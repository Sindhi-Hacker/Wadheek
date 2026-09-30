import * as React from "react";
import { timelineDuration } from "../lib/timeline-math";
import { PlaybackEngine } from "../lib/playback-engine";
import { drawTimelineFrame } from "../lib/canvas-compositor";
import { useMediaStore } from "@/features/media/media-store";
import { useEditorStore, useEditor } from "./useEditorStore";

/**
 * Owns the preview PlaybackEngine + render loop.
 * - advances the timeline clock (with J/K/L shuttle rates and looping)
 * - keeps hidden media elements in sync
 * - draws every frame through the shared compositor onto the given canvas
 */
export function usePlayback(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const engineRef = React.useRef<PlaybackEngine | null>(null);
  const assets = useMediaStore((s) => s.assets);
  const mediaIds = useEditor((s) => s.mediaIds);
  const settings = useEditor((s) => s.settings);

  // Engine lifecycle
  React.useEffect(() => {
    const engine = new PlaybackEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keep media elements prepared for every referenced asset.
  React.useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const referenced = assets.filter((a) => mediaIds.includes(a.id));
    void engine.prepare(referenced);
  }, [assets, mediaIds]);

  // Resume the AudioContext on first user gesture.
  React.useEffect(() => {
    const onGesture = () => void engineRef.current?.resumeAudio();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  // Clock + render loop
  React.useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;

      const state = useEditorStore.getState();
      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (state.playing && state.shuttleRate !== 0) {
        const duration = timelineDuration(state.tracks);
        let next = state.currentTime + dt * state.shuttleRate;

        const loopStart = state.loop && state.inPoint !== null ? state.inPoint : 0;
        const loopEnd =
          state.loop && state.outPoint !== null && state.outPoint > loopStart
            ? state.outPoint
            : duration;

        if (state.shuttleRate > 0 && next >= loopEnd) {
          if (state.loop && loopEnd > loopStart) next = loopStart;
          else {
            next = loopEnd;
            state.setPlaying(false);
          }
        } else if (state.shuttleRate < 0 && next <= loopStart) {
          if (state.loop && loopEnd > loopStart) next = loopEnd;
          else {
            next = loopStart;
            state.setPlaying(false);
          }
        }
        state.setCurrentTime(next);
      }

      const current = useEditorStore.getState();
      if (engine) {
        engine.sync(current.tracks, current.currentTime, current.playing && current.shuttleRate > 0);
      }

      if (canvas && engine) {
        if (canvas.width !== current.settings.width) canvas.width = current.settings.width;
        if (canvas.height !== current.settings.height) canvas.height = current.settings.height;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          drawTimelineFrame(ctx, current.tracks, current.currentTime, current.settings, engine);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, settings.width, settings.height]);

  return engineRef;
}
