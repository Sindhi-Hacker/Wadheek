import { createId } from "@/lib/utils";
import { TEXT_DEFAULTS, TIMELINE_DEFAULTS, TRANSITIONS } from "@/config/defaults";
import type { Clip, ClipFilters, ClipKind } from "../types/clip";
import type { MediaAsset } from "../types/media";

export function defaultFilters(): ClipFilters {
  return {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    temperature: 0,
    tint: 0,
    exposure: 0,
    gamma: 1,
    vignette: 0,
    blur: 0,
    sharpen: 0,
    grayscale: 0,
    sepia: 0,
    invert: 0,
    presetId: "none",
  };
}

export function filtersAreDefault(f: ClipFilters): boolean {
  const d = defaultFilters();
  return (Object.keys(d) as (keyof ClipFilters)[]).every((k) =>
    k === "presetId" ? true : f[k] === d[k]
  );
}

function baseClip(kind: ClipKind, label: string, start: number, duration: number): Clip {
  return {
    id: createId("clip"),
    kind,
    label,
    start,
    duration,
    inOffset: 0,
    speed: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    crop: { left: 0, right: 0, top: 0, bottom: 0 },
    blendMode: "normal",
    filters: defaultFilters(),
    audio: { volume: 1, pan: 0, fadeIn: 0, fadeOut: 0, muted: false, preservePitch: true },
    transitionIn: { type: "none", duration: TRANSITIONS.defaultDuration },
    transitionOut: { type: "none", duration: TRANSITIONS.defaultDuration },
  };
}

export function createClipFromMedia(media: MediaAsset, start: number): Clip {
  const duration =
    media.type === "image" ? TIMELINE_DEFAULTS.defaultImageDuration : media.duration;
  const clip = baseClip(media.type, media.name, start, Math.max(duration, TIMELINE_DEFAULTS.minClipDuration));
  clip.mediaId = media.id;
  return clip;
}

export function createTextClip(start: number): Clip {
  const clip = baseClip("text", TEXT_DEFAULTS.content, start, TIMELINE_DEFAULTS.defaultTextDuration);
  clip.text = {
    content: TEXT_DEFAULTS.content,
    fontFamily: TEXT_DEFAULTS.fontFamily,
    fontSize: TEXT_DEFAULTS.fontSize,
    fontWeight: TEXT_DEFAULTS.fontWeight,
    align: TEXT_DEFAULTS.align,
    color: TEXT_DEFAULTS.color,
    strokeColor: TEXT_DEFAULTS.strokeColor,
    strokeWidth: TEXT_DEFAULTS.strokeWidth,
    shadowColor: TEXT_DEFAULTS.shadowColor,
    shadowBlur: TEXT_DEFAULTS.shadowBlur,
    background: TEXT_DEFAULTS.background,
    animationIn: "fade",
    animationOut: "fade",
  };
  return clip;
}

export function cloneClip(clip: Clip, offset = 0): Clip {
  return {
    ...structuredClone(clip),
    id: createId("clip"),
    start: clip.start + offset,
  };
}

/** Source-time (in the media file) corresponding to a timeline time inside the clip. */
export function timelineToSourceTime(clip: Clip, timelineTime: number): number {
  return clip.inOffset + (timelineTime - clip.start) * clip.speed;
}
