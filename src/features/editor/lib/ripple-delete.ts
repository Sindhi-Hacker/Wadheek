import type { Track } from "../types/track";

/**
 * Remove the given clips and close the gaps they leave on their own tracks.
 * Later clips on the same track shift left by the removed duration that
 * preceded them. Pure function: returns new track objects.
 */
export function rippleDelete(tracks: Track[], clipIds: Set<string>): Track[] {
  return tracks.map((track) => {
    const removed = track.clips
      .filter((c) => clipIds.has(c.id))
      .sort((a, b) => a.start - b.start);
    if (removed.length === 0) return track;

    const kept = track.clips
      .filter((c) => !clipIds.has(c.id))
      .map((clip) => {
        // Total removed duration fully before this clip's start.
        let shift = 0;
        for (const r of removed) {
          if (r.start + r.duration <= clip.start + 1e-9) shift += r.duration;
        }
        return shift > 0 ? { ...clip, start: Math.max(0, clip.start - shift) } : clip;
      });

    return { ...track, clips: kept };
  });
}
