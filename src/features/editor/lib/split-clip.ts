import { createId } from "@/lib/utils";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import type { Clip } from "../types/clip";

/**
 * Split a clip at an absolute timeline time.
 * Returns [left, right] or null when the time doesn't fall strictly inside the clip.
 */
export function splitClip(clip: Clip, time: number): [Clip, Clip] | null {
  const localOffset = time - clip.start;
  if (
    localOffset <= TIMELINE_DEFAULTS.minClipDuration ||
    localOffset >= clip.duration - TIMELINE_DEFAULTS.minClipDuration
  ) {
    return null;
  }

  const left: Clip = structuredClone(clip);
  left.duration = localOffset;
  left.transitionOut = { ...clip.transitionOut, type: "none" };

  const right: Clip = structuredClone(clip);
  right.id = createId("clip");
  right.start = time;
  right.duration = clip.duration - localOffset;
  right.inOffset = clip.inOffset + localOffset * clip.speed;
  right.transitionIn = { ...clip.transitionIn, type: "none" };
  // Fades stay attached to their respective ends.
  left.audio = { ...left.audio, fadeOut: 0 };
  right.audio = { ...right.audio, fadeIn: 0 };

  return [left, right];
}
