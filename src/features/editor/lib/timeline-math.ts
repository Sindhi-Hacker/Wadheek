import type { Track } from "../types/track";
import type { Clip } from "../types/clip";

export function timeToPx(time: number, pps: number): number {
  return time * pps;
}

export function pxToTime(px: number, pps: number): number {
  return px / pps;
}

export function snapToFrame(time: number, fps: number): number {
  return Math.round(time * fps) / fps;
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

export function trackDuration(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
}

export function timelineDuration(tracks: Track[]): number {
  return tracks.reduce((max, t) => Math.max(max, trackDuration(t)), 0);
}

export function clipsAtTime(track: Track, time: number): Clip[] {
  return track.clips.filter((c) => time >= c.start && time < clipEnd(c));
}

export function clipAtTime(track: Track, time: number): Clip | undefined {
  return clipsAtTime(track, time)[0];
}

/** Choose a "nice" ruler tick step for the current zoom, with adaptive density. */
export function pickRulerStep(pps: number, minLabelPx = 70): { major: number; minor: number } {
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const c of candidates) {
    if (c * pps >= minLabelPx) {
      return { major: c, minor: c / 5 };
    }
  }
  const last = candidates[candidates.length - 1]!;
  return { major: last, minor: last / 5 };
}

/** Find non-overlapping placement: returns adjusted start so [start, start+duration) avoids other clips. */
export function resolveOverlap(
  clips: Clip[],
  ignoreIds: Set<string>,
  start: number,
  duration: number
): number {
  const others = clips
    .filter((c) => !ignoreIds.has(c.id))
    .sort((a, b) => a.start - b.start);
  let candidate = Math.max(0, start);
  for (let i = 0; i < others.length; i++) {
    const o = others[i]!;
    const oEnd = o.start + o.duration;
    if (candidate < oEnd && candidate + duration > o.start) {
      candidate = oEnd;
    }
  }
  return candidate;
}

/** Whether a clip range would overlap any clip on a track (excluding some ids). */
export function overlaps(
  clips: Clip[],
  ignoreIds: Set<string>,
  start: number,
  duration: number
): boolean {
  return clips.some(
    (c) => !ignoreIds.has(c.id) && start < c.start + c.duration && start + duration > c.start
  );
}

/** The maximum timeline duration a clip can extend given its source media. */
export function maxClipDuration(clip: Clip, mediaDuration: number | undefined): number {
  if (clip.kind === "image" || clip.kind === "text" || mediaDuration === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (mediaDuration - clip.inOffset) / clip.speed);
}
