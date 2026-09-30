import * as React from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { useEditorStore, type HistorySlice } from "./useEditorStore";

export type { HistorySlice };

function captureSlice(): HistorySlice {
  const s = useEditorStore.getState();
  return { tracks: s.tracks, markers: s.markers, inPoint: s.inPoint, outPoint: s.outPoint };
}

/**
 * Group a continuous gesture (drag, trim, slider scrub) into a single undo
 * entry: recording is paused for the duration and the pre-gesture state is
 * pushed manually on commit.
 */
export function beginHistoryTransaction(): HistorySlice {
  const before = captureSlice();
  useEditorStore.temporal.getState().pause();
  return before;
}

export function endHistoryTransaction(before: HistorySlice, changed = true): void {
  const temporal = useEditorStore.temporal;
  if (changed) {
    const { pastStates } = temporal.getState();
    temporal.setState({
      pastStates: [...pastStates, before] as typeof pastStates,
      futureStates: [],
    });
  }
  temporal.getState().resume();
}

export function useUndoRedo() {
  const { pastStates, futureStates, undo, redo } = useStoreWithEqualityFn(
    useEditorStore.temporal,
    (s) => ({
      pastStates: s.pastStates,
      futureStates: s.futureStates,
      undo: s.undo,
      redo: s.redo,
    }),
    shallow
  );

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const doUndo = React.useCallback(() => {
    undo();
    useEditorStore.getState().markDirty();
  }, [undo]);

  const doRedo = React.useCallback(() => {
    redo();
    useEditorStore.getState().markDirty();
  }, [redo]);

  return { canUndo, canRedo, undo: doUndo, redo: doRedo };
}
