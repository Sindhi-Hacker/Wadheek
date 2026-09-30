import { isMac } from "@/lib/utils";

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string[]; // display form, "mod" is replaced per-platform
  group: string;
}

/** Canonical keyboard shortcut map — rendered in the shortcuts dialog and bound in useKeyboardShortcuts. */
export const SHORTCUTS: ShortcutDef[] = [
  { id: "play-pause", label: "Play / Pause", keys: ["Space"], group: "Playback" },
  { id: "shuttle-reverse", label: "Shuttle reverse", keys: ["J"], group: "Playback" },
  { id: "shuttle-stop", label: "Pause shuttle", keys: ["K"], group: "Playback" },
  { id: "shuttle-forward", label: "Shuttle forward", keys: ["L"], group: "Playback" },
  { id: "prev-frame", label: "Previous frame", keys: ["ArrowLeft"], group: "Playback" },
  { id: "next-frame", label: "Next frame", keys: ["ArrowRight"], group: "Playback" },
  { id: "jump-back", label: "Jump 10 frames back", keys: ["Shift", "ArrowLeft"], group: "Playback" },
  { id: "jump-forward", label: "Jump 10 frames forward", keys: ["Shift", "ArrowRight"], group: "Playback" },
  { id: "go-start", label: "Go to start", keys: ["Home"], group: "Playback" },
  { id: "go-end", label: "Go to end", keys: ["End"], group: "Playback" },
  { id: "mark-in", label: "Mark in point", keys: ["I"], group: "Playback" },
  { id: "mark-out", label: "Mark out point", keys: ["O"], group: "Playback" },
  { id: "add-marker", label: "Add marker", keys: ["M"], group: "Playback" },
  { id: "split", label: "Split clip at playhead", keys: ["S"], group: "Editing" },
  { id: "add-text", label: "Add text overlay", keys: ["T"], group: "Editing" },
  { id: "freeze-frame", label: "Freeze frame at playhead", keys: ["F"], group: "Editing" },
  { id: "detach-audio", label: "Detach audio from video", keys: ["Shift", "D"], group: "Editing" },
  { id: "delete", label: "Delete selection", keys: ["Delete"], group: "Editing" },
  { id: "ripple-delete", label: "Ripple delete", keys: ["Shift", "Delete"], group: "Editing" },
  { id: "duplicate", label: "Duplicate selection", keys: ["mod", "D"], group: "Editing" },
  { id: "copy", label: "Copy", keys: ["mod", "C"], group: "Editing" },
  { id: "paste", label: "Paste at playhead", keys: ["mod", "V"], group: "Editing" },
  { id: "select-all", label: "Select all clips", keys: ["mod", "A"], group: "Editing" },
  { id: "undo", label: "Undo", keys: ["mod", "Z"], group: "Editing" },
  { id: "redo", label: "Redo", keys: ["mod", "Shift", "Z"], group: "Editing" },
  { id: "zoom-in", label: "Zoom in timeline", keys: ["+"], group: "View" },
  { id: "zoom-out", label: "Zoom out timeline", keys: ["-"], group: "View" },
  { id: "zoom-fit", label: "Fit timeline", keys: ["\\"], group: "View" },
  { id: "toggle-snap", label: "Toggle snapping", keys: ["N"], group: "View" },
  { id: "toggle-loop", label: "Toggle loop", keys: ["R"], group: "View" },
  { id: "command-palette", label: "Command palette", keys: ["mod", "K"], group: "App" },
  { id: "shortcuts", label: "Show shortcuts", keys: ["?"], group: "App" },
  { id: "export", label: "Export", keys: ["mod", "E"], group: "App" },
];

export function displayKeys(keys: string[]): string[] {
  const mod = isMac() ? "Cmd" : "Ctrl";
  return keys.map((k) => {
    if (k === "mod") return mod;
    if (k === "ArrowLeft") return "Left";
    if (k === "ArrowRight") return "Right";
    return k;
  });
}
