import type { Track } from "../types/track";
import type { Marker } from "../types/timeline";

export interface SnapTarget {
  time: number;
  kind: "clip-edge" | "playhead" | "marker" | "grid" | "origin" | "inout";
}

export interface SnapResult {
  time: number;
  snapped: boolean;
  target: SnapTarget | null;
}

export interface SnapContext {
  tracks: Track[];
  ignoreClipIds: Set<string>;
  playhead: number;
  markers: Marker[];
  inPoint: number | null;
  outPoint: number | null;
  gridStep: number;
  pps: number;
  thresholdPx: number;
}

/** Collect every snap candidate time in the project. */
export function collectSnapTargets(ctx: SnapContext): SnapTarget[] {
  const targets: SnapTarget[] = [{ time: 0, kind: "origin" }];
  for (const track of ctx.tracks) {
    for (const clip of track.clips) {
      if (ctx.ignoreClipIds.has(clip.id)) continue;
      targets.push({ time: clip.start, kind: "clip-edge" });
      targets.push({ time: clip.start + clip.duration, kind: "clip-edge" });
    }
  }
  targets.push({ time: ctx.playhead, kind: "playhead" });
  for (const marker of ctx.markers) targets.push({ time: marker.time, kind: "marker" });
  if (ctx.inPoint !== null) targets.push({ time: ctx.inPoint, kind: "inout" });
  if (ctx.outPoint !== null) targets.push({ time: ctx.outPoint, kind: "inout" });
  return targets;
}

/**
 * Snap `time` against clip edges, playhead, markers and the grid.
 * Returns the snapped time and the winning target for guide rendering.
 */
export function snapTime(time: number, ctx: SnapContext): SnapResult {
  const threshold = ctx.thresholdPx / ctx.pps;
  let best: SnapTarget | null = null;
  let bestDist = threshold;

  for (const target of collectSnapTargets(ctx)) {
    const dist = Math.abs(target.time - time);
    if (dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }

  if (!best && ctx.gridStep > 0) {
    const gridded = Math.round(time / ctx.gridStep) * ctx.gridStep;
    if (Math.abs(gridded - time) < threshold) {
      return { time: Math.max(0, gridded), snapped: true, target: { time: gridded, kind: "grid" } };
    }
  }

  if (best) return { time: Math.max(0, best.time), snapped: true, target: best };
  return { time: Math.max(0, time), snapped: false, target: null };
}
