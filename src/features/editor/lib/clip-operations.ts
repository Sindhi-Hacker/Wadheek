import { createId } from "@/lib/utils";
import { TEXT_DEFAULTS, TIMELINE_DEFAULTS, TRANSITIONS } from "@/config/defaults";
import type {
  Clip,
  ClipFilters,
  ClipKind,
  DrawingData,
  KeyframeTracks,
  StickerStyle,
  TextStyle,
} from "../types/clip";
import type { MediaAsset } from "../types/media";
import type { Track, TrackKind } from "../types/track";
import { defaultChromaSettings } from "./chroma-key";

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

export function defaultTransform(): Clip["transform"] {
  return {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
    fit: "contain",
    backgroundBlur: 0,
  };
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
    transform: defaultTransform(),
    crop: { left: 0, right: 0, top: 0, bottom: 0 },
    blendMode: "normal",
    filters: defaultFilters(),
    chroma: defaultChromaSettings(),
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
  clip.text = defaultTextStyle();
  return clip;
}

export function defaultTextStyle(): TextStyle {
  return {
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
    // Default to no animation: the text must be instantly visible when added
    // (animations are one click away in the inspector).
    animationIn: "none",
    animationOut: "none",
    letterSpacing: 0,
    lineHeight: 1.2,
  };
}

export function createStickerClip(
  start: number,
  sticker: Partial<StickerStyle> & { content: string; type: StickerStyle["type"] }
): Clip {
  const clip = baseClip(
    "sticker",
    sticker.type === "emoji" ? `Sticker ${sticker.content}` : sticker.content,
    start,
    TIMELINE_DEFAULTS.defaultStickerDuration
  );
  clip.sticker = {
    type: sticker.type,
    content: sticker.content,
    size: sticker.size ?? Math.round(TIMELINE_DEFAULTS.defaultStickerSize),
    fill: sticker.fill ?? "#f43f5e",
    stroke: sticker.stroke ?? "#ffffff",
    strokeWidth: sticker.strokeWidth ?? 0,
    shadowBlur: sticker.shadowBlur ?? 12,
    shadowColor: sticker.shadowColor ?? "rgba(0,0,0,0.45)",
  };
  return clip;
}

export function createDrawingClip(start: number, strokes: DrawingData["strokes"]): Clip {
  const clip = baseClip("drawing", "Drawing", start, TIMELINE_DEFAULTS.defaultDrawingDuration);
  clip.drawing = { strokes };
  clip.blendMode = "normal";
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

/* ------------------------------------------------------------------ */
/* Migration                                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalize a clip loaded from older project documents: fills in fields added
 * after v1 so the rest of the app can assume they exist.
 */
export function migrateClip(clip: Clip): Clip {
  const t = clip.transform ?? defaultTransform();
  const transform: Clip["transform"] = {
    x: t.x ?? 0,
    y: t.y ?? 0,
    scale: t.scale ?? 1,
    rotation: t.rotation ?? 0,
    opacity: t.opacity ?? 1,
    flipX: t.flipX ?? false,
    flipY: t.flipY ?? false,
    fit: t.fit === "cover" ? "cover" : "contain",
    backgroundBlur: t.backgroundBlur ?? 0,
  };
  const filters = { ...defaultFilters(), ...(clip.filters ?? {}) };
  const text = clip.text
    ? {
        ...defaultTextStyle(),
        ...clip.text,
      }
    : clip.text;
  return {
    ...clip,
    transform,
    filters,
    text,
    crop: clip.crop ?? { left: 0, right: 0, top: 0, bottom: 0 },
    blendMode: clip.blendMode ?? "normal",
    chroma: clip.chroma ?? defaultChromaSettings(),
    audio: clip.audio ?? {
      volume: 1,
      pan: 0,
      fadeIn: 0,
      fadeOut: 0,
      muted: false,
      preservePitch: true,
    },
    transitionIn: clip.transitionIn ?? { type: "none", duration: TRANSITIONS.defaultDuration },
    transitionOut: clip.transitionOut ?? { type: "none", duration: TRANSITIONS.defaultDuration },
    keyframes: clip.keyframes as KeyframeTracks | undefined,
  };
}

export function migrateTracks(tracks: Track[]): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((c) => migrateClip(c as Clip)),
  }));
}

/* ------------------------------------------------------------------ */
/* Placement                                                            */
/* ------------------------------------------------------------------ */

export function preferredTrackKind(clipKind: Clip["kind"]): TrackKind[] {
  switch (clipKind) {
    case "audio":
      return ["audio"];
    case "text":
      return ["text", "overlay"];
    case "sticker":
      return ["text", "overlay"];
    case "drawing":
      return ["overlay", "text"];
    case "image":
      return ["overlay", "video"];
    default:
      return ["video", "overlay"];
  }
}

/** Track kinds a clip may live on when the preferred kinds are all busy. */
export function compatibleTrackKinds(clipKind: Clip["kind"]): TrackKind[] {
  switch (clipKind) {
    case "audio":
      return ["audio"];
    // Text-like layers must stay above video layers, never fall below them.
    case "text":
    case "sticker":
      return ["text", "overlay"];
    case "drawing":
      return ["overlay", "text"];
    case "image":
      return ["overlay", "video", "text"];
    default:
      return ["video", "overlay", "text"];
  }
}

/**
 * Find the best track + start for a new clip at `at`:
 * 1. the first preferred-kind track where [at, at+duration) is free
 * 2. any other compatible track where the slot is free
 * 3. otherwise the first preferred track with the clip pushed after overlaps
 */
export function findPlacement(
  tracks: Track[],
  clip: Clip,
  at: number
): { trackId: string; start: number } | null {
  const preferred = preferredTrackKind(clip.kind);
  const isVisual = clip.kind !== "audio";
  const compatibleKinds = compatibleTrackKinds(clip.kind);

  const usable = (track: Track) =>
    !track.locked && (isVisual ? !track.hidden : true);
  const isFree = (track: Track, start: number) =>
    !track.clips.some((c) => start < c.start + c.duration && start + clip.duration > c.start);

  for (const kind of preferred) {
    const track = tracks.find((t) => t.kind === kind && usable(t) && isFree(t, at));
    if (track) return { trackId: track.id, start: at };
  }
  for (const kind of compatibleKinds) {
    const track = tracks.find((t) => t.kind === kind && usable(t) && isFree(t, at));
    if (track) return { trackId: track.id, start: at };
  }
  // Fall back: push past overlaps on every compatible track and keep the
  // earliest landing spot so the clip stays as close to the playhead as possible.
  let best: { trackId: string; start: number } | null = null;
  for (const kind of [...preferred, ...compatibleKinds]) {
    const track = tracks.find((t) => t.kind === kind && usable(t));
    if (!track) continue;
    let candidate = at;
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (const other of sorted) {
      if (candidate < other.start + other.duration && candidate + clip.duration > other.start) {
        candidate = other.start + other.duration;
      }
    }
    if (!best || candidate < best.start) best = { trackId: track.id, start: candidate };
  }
  return best;
}
