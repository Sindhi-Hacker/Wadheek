import * as React from "react";
import { AUTOSAVE } from "@/config/defaults";
import { persistProject } from "@/features/projects/projects-api";
import { saveLastSession } from "../lib/idb-storage";
import { snapshotProject, useEditorStore } from "./useEditorStore";

/**
 * Debounced autosave: any store change that marks the document dirty is
 * persisted to IndexedDB shortly after, with a visible Saved indicator.
 */
export function useAutoSave() {
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.saveState !== "dirty" || prev.saveState === "dirty") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const current = useEditorStore.getState();
        if (current.saveState !== "dirty") return;
        current.setSaveState("saving");
        const project = snapshotProject();
        if (project) {
          try {
            await persistProject(project);
            useEditorStore.getState().setSaveState("saved");
          } catch {
            useEditorStore.getState().setSaveState("dirty");
          }
        }
      }, AUTOSAVE.debounceMs);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      // Final flush on unmount.
      const state = useEditorStore.getState();
      if (state.saveState === "dirty") {
        const project = snapshotProject();
        if (project) void persistProject(project);
      }
    };
  }, []);

  React.useEffect(() => {
    const id = useEditorStore.getState().projectId;
    if (id) void saveLastSession(id);
  }, []);
}
