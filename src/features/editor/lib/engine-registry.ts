import type { PlaybackEngine } from "./playback-engine";

/**
 * Tiny module-level registry so UI commands (freeze frame, frame export,
 * settle seeks) can reach the live preview engine without prop drilling.
 */
let activeEngine: PlaybackEngine | null = null;

export function registerPreviewEngine(engine: PlaybackEngine | null): void {
  activeEngine = engine;
}

export function getPreviewEngine(): PlaybackEngine | null {
  return activeEngine;
}
