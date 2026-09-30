import * as React from "react";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import { getAsset } from "@/features/media/media-store";
import { maxClipDuration, snapToFrame } from "../lib/timeline-math";
import { useEditorStore } from "./useEditorStore";
import { useSnapping } from "./useSnapping";
import { beginHistoryTransaction, endHistoryTransaction, type HistorySlice } from "./useUndoRedo";

interface TrimState {
  pointerId: number;
  edge: "start" | "end";
  startX: number;
  before: HistorySlice | null;
  origin: { start: number; duration: number; inOffset: number };
  moved: boolean;
}

/**
 * Edge trimming with live handles. Start-edge trims adjust inOffset so the
 * clip's content stays anchored; both edges respect source bounds, minimum
 * duration, frame quantization and magnetic snapping.
 */
export function useTrim(clipId: string) {
  const stateRef = React.useRef<TrimState | null>(null);
  const snap = useSnapping();

  const start = React.useCallback(
    (edge: "start" | "end") => (e: React.PointerEvent) => {
      e.stopPropagation();
      const store = useEditorStore.getState();
      const owner = store.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      const clip = owner?.clips.find((c) => c.id === clipId);
      if (!owner || owner.locked || !clip) return;

      store.select([clipId]);
      stateRef.current = {
        pointerId: e.pointerId,
        edge,
        startX: e.clientX,
        before: null,
        origin: { start: clip.start, duration: clip.duration, inOffset: clip.inOffset },
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [clipId]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const trim = stateRef.current;
      if (!trim || e.pointerId !== trim.pointerId) return;
      e.stopPropagation();

      if (!trim.moved) {
        if (Math.abs(e.clientX - trim.startX) < 3) return;
        trim.moved = true;
        trim.before = beginHistoryTransaction();
      }

      const store = useEditorStore.getState();
      const dt = (e.clientX - trim.startX) / store.pps;
      const fps = store.settings.fps;
      const minDur = TIMELINE_DEFAULTS.minClipDuration;
      const ignore = new Set([clipId]);

      store.updateClip(clipId, (clip) => {
        const media = getAsset(clip.mediaId);
        const { origin } = trim;

        if (trim.edge === "start") {
          let newStart = origin.start + dt;
          const snapped = snap(newStart, ignore, e.altKey);
          if (snapped.snapped) newStart = snapped.time;
          newStart = snapToFrame(newStart, fps);
          // Clamp: cannot extend before available source, cannot pass end.
          const minStart = Math.max(0, origin.start - origin.inOffset / clip.speed);
          const maxStart = origin.start + origin.duration - minDur;
          newStart = Math.min(maxStart, Math.max(minStart, newStart));
          const delta = newStart - origin.start;
          store.setSnapGuide(snapped.snapped ? newStart : null);
          return {
            ...clip,
            start: newStart,
            duration: origin.duration - delta,
            inOffset: Math.max(0, origin.inOffset + delta * clip.speed),
          };
        }

        let newEnd = origin.start + origin.duration + dt;
        const snapped = snap(newEnd, ignore, e.altKey);
        if (snapped.snapped) newEnd = snapped.time;
        newEnd = snapToFrame(newEnd, fps);
        const maxDur = maxClipDuration(clip, media?.duration);
        const clampedDur = Math.min(
          Number.isFinite(maxDur) ? maxDur : Number.MAX_SAFE_INTEGER,
          Math.max(minDur, newEnd - origin.start)
        );
        store.setSnapGuide(snapped.snapped ? origin.start + clampedDur : null);
        return { ...clip, duration: clampedDur };
      });
    },
    [clipId, snap]
  );

  const finish = React.useCallback((commit: boolean) => {
    const trim = stateRef.current;
    if (!trim) return;
    stateRef.current = null;
    useEditorStore.getState().setSnapGuide(null);
    if (trim.moved && trim.before) endHistoryTransaction(trim.before, commit);
  }, []);

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      finish(true);
    },
    [finish]
  );

  return {
    startHandleProps: {
      onPointerDown: start("start"),
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => finish(false),
    },
    endHandleProps: {
      onPointerDown: start("end"),
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => finish(false),
    },
  };
}
