import * as React from "react";
import { toast } from "sonner";
import { COPY } from "@/config/copy";
import { PLAYBACK_DEFAULTS, TIMELINE_DEFAULTS } from "@/config/defaults";
import { timelineDuration } from "../lib/timeline-math";
import { useEditorStore } from "./useEditorStore";
import { useUndoRedo } from "./useUndoRedo";

interface ShortcutHandlers {
  openCommandPalette: () => void;
  openShortcuts: () => void;
  openExport: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Global editor keyboard map (see src/config/shortcuts.ts for the reference). */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, announce: (msg: string) => void) {
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useEditorStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      // Command palette works everywhere.
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlersRef.current.openCommandPalette();
        return;
      }
      if (isEditableTarget(e.target)) return;

      const frame = 1 / s.settings.fps;
      const key = e.key;

      if (mod) {
        switch (key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              if (canRedo) redo();
              else toast(COPY.toasts.nothingToRedo);
            } else {
              if (canUndo) undo();
              else toast(COPY.toasts.nothingToUndo);
            }
            return;
          case "y":
            e.preventDefault();
            if (canRedo) redo();
            return;
          case "c": {
            e.preventDefault();
            const n = s.copySelection();
            if (n > 0) toast(COPY.toasts.clipsCopied(n));
            return;
          }
          case "v": {
            e.preventDefault();
            const n = s.pasteAtTime(s.currentTime);
            if (n > 0) {
              toast(COPY.toasts.clipsPasted(n));
              announce(COPY.toasts.clipsPasted(n));
            }
            return;
          }
          case "d": {
            e.preventDefault();
            s.duplicateSelection();
            return;
          }
          case "a":
            e.preventDefault();
            s.selectAll();
            return;
          case "e":
            e.preventDefault();
            handlersRef.current.openExport();
            return;
          default:
            return;
        }
      }

      switch (key) {
        case " ":
          e.preventDefault();
          s.togglePlay();
          announce(s.playing ? COPY.editor.pause : COPY.editor.play);
          break;
        case "j":
        case "J": {
          e.preventDefault();
          const speeds = PLAYBACK_DEFAULTS.shuttleSpeeds;
          const idx = speeds.indexOf(s.shuttleRate as (typeof speeds)[number]);
          const next = idx > 0 ? speeds[idx - 1]! : -1;
          s.setShuttleRate(next === 0 ? -1 : next);
          break;
        }
        case "k":
        case "K":
          e.preventDefault();
          s.setPlaying(false);
          break;
        case "l":
        case "L": {
          e.preventDefault();
          const speeds = PLAYBACK_DEFAULTS.shuttleSpeeds;
          const idx = speeds.indexOf(s.shuttleRate as (typeof speeds)[number]);
          const next = idx >= 0 && idx < speeds.length - 1 ? speeds[idx + 1]! : 1;
          s.setShuttleRate(next === 0 ? 1 : next);
          break;
        }
        case "ArrowLeft":
          e.preventDefault();
          s.setPlaying(false);
          s.setCurrentTime(
            s.currentTime - frame * (e.shiftKey ? PLAYBACK_DEFAULTS.frameStepLarge : 1)
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          s.setPlaying(false);
          s.setCurrentTime(
            s.currentTime + frame * (e.shiftKey ? PLAYBACK_DEFAULTS.frameStepLarge : 1)
          );
          break;
        case "Home":
          e.preventDefault();
          s.setCurrentTime(0);
          break;
        case "End":
          e.preventDefault();
          s.setCurrentTime(timelineDuration(s.tracks));
          break;
        case "i":
        case "I":
          e.preventDefault();
          s.setInPoint(s.currentTime);
          announce(COPY.editor.setIn);
          break;
        case "o":
        case "O":
          e.preventDefault();
          s.setOutPoint(s.currentTime);
          announce(COPY.editor.setOut);
          break;
        case "m":
        case "M":
          e.preventDefault();
          s.addMarker(s.currentTime);
          toast(COPY.toasts.markerAdded);
          break;
        case "s":
        case "S": {
          e.preventDefault();
          const n = s.splitAtTime(s.currentTime);
          if (n > 0) {
            toast(COPY.toasts.clipSplit);
            announce(COPY.toasts.clipSplit);
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          const n = e.shiftKey
            ? s.rippleDeleteClips(s.selection)
            : s.deleteClips(s.selection);
          if (n > 0) {
            toast(COPY.toasts.clipsDeleted(n));
            announce(COPY.toasts.clipsDeleted(n));
          }
          break;
        }
        case "n":
        case "N":
          e.preventDefault();
          s.toggleSnapping();
          break;
        case "r":
        case "R":
          e.preventDefault();
          s.toggleLoop();
          break;
        case "+":
        case "=":
          e.preventDefault();
          s.setPps(s.pps * TIMELINE_DEFAULTS.zoomStep);
          break;
        case "-":
        case "_":
          e.preventDefault();
          s.setPps(s.pps / TIMELINE_DEFAULTS.zoomStep);
          break;
        case "?":
          e.preventDefault();
          handlersRef.current.openShortcuts();
          break;
        case "Escape":
          s.clearSelection();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, canUndo, canRedo, announce]);
}
