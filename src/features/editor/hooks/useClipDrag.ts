import * as React from "react";
import { snapToFrame } from "../lib/timeline-math";
import { useEditorStore } from "./useEditorStore";
import { useSnapping } from "./useSnapping";
import { beginHistoryTransaction, endHistoryTransaction, type HistorySlice } from "./useUndoRedo";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  before: HistorySlice | null;
  origins: { clipId: string; trackId: string; start: number; duration: number; kind: string }[];
  anchorClipId: string;
}

/**
 * Pointer-based clip dragging: horizontal moves in time (with magnetic
 * snapping + Alt override + frame quantization) and vertical moves across
 * compatible tracks, for mouse and touch alike.
 */
export function useClipDrag(clipId: string) {
  const dragRef = React.useRef<DragState | null>(null);
  const snap = useSnapping();

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const store = useEditorStore.getState();

      // Locked track or clip not draggable.
      const owner = store.tracks.find((t) => t.clips.some((c) => c.id === clipId));
      if (!owner || owner.locked) return;

      // Selection semantics: click selects; shift adds; drag moves the selection.
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      if (!store.selection.includes(clipId)) {
        store.select([clipId], additive);
      } else if (additive) {
        // toggle off on shift-click of an already-selected clip
      }

      const selection = useEditorStore.getState().selection;
      const origins: DragState["origins"] = [];
      for (const track of useEditorStore.getState().tracks) {
        if (track.locked) continue;
        for (const clip of track.clips) {
          if (selection.includes(clip.id)) {
            origins.push({
              clipId: clip.id,
              trackId: track.id,
              start: clip.start,
              duration: clip.duration,
              kind: clip.kind,
            });
          }
        }
      }

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        before: null,
        origins,
        anchorClipId: clipId,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [clipId]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.moved) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        drag.moved = true;
        drag.before = beginHistoryTransaction();
      }

      const store = useEditorStore.getState();
      const dt = dx / store.pps;

      // Snap using the anchor clip's leading edge.
      const anchor = drag.origins.find((o) => o.clipId === drag.anchorClipId);
      if (!anchor) return;
      const ignoreIds = new Set(drag.origins.map((o) => o.clipId));
      const rawStart = Math.max(0, anchor.start + dt);
      const startSnap = snap(rawStart, ignoreIds, e.altKey);
      const endSnap = snap(rawStart + anchor.duration, ignoreIds, e.altKey);

      let deltaTime = rawStart - anchor.start;
      let guide: number | null = null;
      if (startSnap.snapped && (!endSnap.snapped || Math.abs(startSnap.time - rawStart) <= Math.abs(endSnap.time - (rawStart + anchor.duration)))) {
        deltaTime = startSnap.time - anchor.start;
        guide = startSnap.time;
      } else if (endSnap.snapped) {
        deltaTime = endSnap.time - anchor.duration - anchor.start;
        guide = endSnap.time;
      }
      deltaTime = snapToFrame(anchor.start + deltaTime, store.settings.fps) - anchor.start;
      store.setSnapGuide(guide);

      // Vertical: find the track element under the pointer.
      let targetTrackId: string | null = null;
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of stack) {
        const id = (el as HTMLElement).dataset?.trackId;
        if (id) {
          targetTrackId = id;
          break;
        }
      }

      const anchorTrack = store.tracks.find((t) => t.id === anchor.trackId);
      let trackDelta = 0;
      if (targetTrackId && anchorTrack) {
        const fromIndex = store.tracks.findIndex((t) => t.id === anchor.trackId);
        const toIndex = store.tracks.findIndex((t) => t.id === targetTrackId);
        if (fromIndex >= 0 && toIndex >= 0) trackDelta = toIndex - fromIndex;
      }

      const moves = drag.origins.map((o) => {
        const fromIndex = store.tracks.findIndex((t) => t.id === o.trackId);
        let toIndex = fromIndex + trackDelta;
        const from = store.tracks[fromIndex];
        let to = store.tracks[toIndex];
        const compatible =
          to &&
          !to.locked &&
          from &&
          ((o.kind === "audio" && to.kind === "audio") ||
            (o.kind !== "audio" && to.kind !== "audio" && (o.kind !== "text" || to.kind === "text" || to.kind === "overlay")));
        if (!compatible) {
          toIndex = fromIndex;
          to = from;
        }
        return {
          clipId: o.clipId,
          trackId: (to ?? from)!.id,
          start: Math.max(0, o.start + deltaTime),
        };
      });

      store.moveClips(moves);
    },
    [snap]
  );

  const finish = React.useCallback((commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const store = useEditorStore.getState();
    store.setSnapGuide(null);
    if (drag.moved && drag.before) {
      endHistoryTransaction(drag.before, commit);
    }
  }, []);

  const onPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      finish(true);
    },
    [finish]
  );

  const onPointerCancel = React.useCallback(() => finish(false), [finish]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
