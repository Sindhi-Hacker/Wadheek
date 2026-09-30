import { createId, clamp } from "@/lib/utils";
import type {
  Clip,
  ClipFilters,
  ClipTransform,
  EasingId,
  Keyframe,
  KeyframeProperty,
  KeyframeTracks,
} from "../types/clip";
import { clipEnd } from "./timeline-math";

/* ------------------------------------------------------------------ */
/* Easings                                                             */
/* ------------------------------------------------------------------ */

const c1 = 1.70158;
const c3 = c1 + 1;

export const EASINGS: { id: EasingId; label: string }[] = [
  { id: "linear", label: "Linear" },
  { id: "ease-in", label: "Ease In" },
  { id: "ease-out", label: "Ease Out" },
  { id: "ease-in-out", label: "Ease In-Out" },
  { id: "hold", label: "Hold (step)" },
  { id: "back", label: "Overshoot" },
  { id: "elastic", label: "Elastic" },
  { id: "bounce", label: "Bounce" },
  { id: "spring", label: "Spring" },
];

/** Normalized easing curve (t: 0..1 in, 0..1 out). */
export function applyEasing(t: number, easing: EasingId): number {
  switch (easing) {
    case "linear":
      return t;
    case "ease-in":
      return t * t * t;
    case "ease-out":
      return 1 - Math.pow(1 - t, 3);
    case "ease-in-out":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "hold":
      return 0;
    case "back":
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    case "elastic": {
      if (t === 0 || t === 1) return t;
      const p = 0.38;
      return Math.pow(2, -9 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / p / 8) + 1;
    }
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = t;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    case "spring": {
      // Critically-ish damped spring with slight overshoot.
      return 1 - Math.exp(-7 * t) * Math.cos(11 * t);
    }
    default:
      return t;
  }
}

/* ------------------------------------------------------------------ */
/* Sampling                                                            */
/* ------------------------------------------------------------------ */

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.time - b.time);
}

/**
 * Interpolated value of a keyframe track at an absolute time.
 * Returns null when the track is empty (caller falls back to the static value).
 */
export function sampleTrack(kfs: Keyframe[] | undefined, time: number): number | null {
  if (!kfs || kfs.length === 0) return null;
  if (kfs.length === 1) return kfs[0]!.value;
  if (time <= kfs[0]!.time) return kfs[0]!.value;
  const last = kfs[kfs.length - 1]!;
  if (time >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    if (time >= a.time && time < b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 1 : (time - a.time) / span;
      return a.value + (b.value - a.value) * applyEasing(t, a.easing);
    }
  }
  return last.value;
}

/** Transform with keyframes applied at `time`. */
export function evaluatedTransform(clip: Clip, time: number): ClipTransform {
  const kf = clip.keyframes;
  const t = clip.transform;
  if (!kf) return t;
  return {
    ...t,
    x: sampleTrack(kf.x, time) ?? t.x,
    y: sampleTrack(kf.y, time) ?? t.y,
    scale: sampleTrack(kf.scale, time) ?? t.scale,
    rotation: sampleTrack(kf.rotation, time) ?? t.rotation,
    opacity: sampleTrack(kf.opacity, time) ?? t.opacity,
  };
}

/** Filters with keyframes applied at `time`. */
export function evaluatedFilters(clip: Clip, time: number): ClipFilters {
  const kf = clip.keyframes;
  if (!kf) return clip.filters;
  const out = { ...clip.filters };
  for (const key of FILTER_KEYS) {
    const v = sampleTrack(kf[key], time);
    if (v !== null) (out as unknown as Record<string, number>)[key] = v;
  }
  return out;
}

/** Font size with keyframes applied at `time`. */
export function evaluatedFontSize(clip: Clip, time: number): number {
  if (!clip.text) return 0;
  return sampleTrack(clip.keyframes?.fontSize, time) ?? clip.text.fontSize;
}

/** Volume with keyframes applied (multiplied with static volume). */
export function evaluatedVolume(clip: Clip, time: number): number {
  const kfVolume = sampleTrack(clip.keyframes?.volume, time);
  return kfVolume === null ? clip.audio.volume : kfVolume;
}

export const FILTER_KEYS = [
  "brightness",
  "contrast",
  "saturation",
  "hue",
  "temperature",
  "tint",
  "exposure",
  "gamma",
  "vignette",
  "blur",
  "sharpen",
  "grayscale",
  "sepia",
  "invert",
] as const satisfies readonly (keyof ClipFilters & KeyframeProperty)[];

/* ------------------------------------------------------------------ */
/* Property registry (drives inspector + keyframe UI)                   */
/* ------------------------------------------------------------------ */

export interface KeyframePropertyDef {
  id: KeyframeProperty;
  label: string;
  group: "Transform" | "Audio" | "Text" | "Filters";
  /** Current static value on the clip. */
  getValue: (clip: Clip) => number;
  /** Writes the value into a clip draft (already shallow-cloned). */
  apply: (draft: Clip, value: number) => void;
  format: (v: number) => string;
  supports: (clip: Clip) => boolean;
}

export const KEYFRAME_PROPERTIES: Record<KeyframeProperty, KeyframePropertyDef> = {
  x: {
    id: "x",
    label: "Position X",
    group: "Transform",
    getValue: (c) => c.transform.x,
    apply: (c, v) => {
      c.transform = { ...c.transform, x: v };
    },
    format: (v) => `${Math.round(v * 100)}%`,
    supports: (c) => c.kind !== "audio",
  },
  y: {
    id: "y",
    label: "Position Y",
    group: "Transform",
    getValue: (c) => c.transform.y,
    apply: (c, v) => {
      c.transform = { ...c.transform, y: v };
    },
    format: (v) => `${Math.round(v * 100)}%`,
    supports: (c) => c.kind !== "audio",
  },
  scale: {
    id: "scale",
    label: "Scale",
    group: "Transform",
    getValue: (c) => c.transform.scale,
    apply: (c, v) => {
      c.transform = { ...c.transform, scale: Math.max(0.01, v) };
    },
    format: (v) => `${Math.round(v * 100)}%`,
    supports: (c) => c.kind !== "audio",
  },
  rotation: {
    id: "rotation",
    label: "Rotation",
    group: "Transform",
    getValue: (c) => c.transform.rotation,
    apply: (c, v) => {
      c.transform = { ...c.transform, rotation: v };
    },
    format: (v) => `${Math.round(v)}°`,
    supports: (c) => c.kind !== "audio",
  },
  opacity: {
    id: "opacity",
    label: "Opacity",
    group: "Transform",
    getValue: (c) => c.transform.opacity,
    apply: (c, v) => {
      c.transform = { ...c.transform, opacity: clamp(v, 0, 1) };
    },
    format: (v) => `${Math.round(v * 100)}%`,
    supports: (c) => c.kind !== "audio",
  },
  volume: {
    id: "volume",
    label: "Volume",
    group: "Audio",
    getValue: (c) => c.audio.volume,
    apply: (c, v) => {
      c.audio = { ...c.audio, volume: clamp(v, 0, 4) };
    },
    format: (v) => `${Math.round(v * 100)}%`,
    supports: () => true,
  },
  fontSize: {
    id: "fontSize",
    label: "Font size",
    group: "Text",
    getValue: (c) => c.text?.fontSize ?? 72,
    apply: (c, v) => {
      if (c.text) c.text = { ...c.text, fontSize: Math.max(6, v) };
    },
    format: (v) => `${Math.round(v)}px`,
    supports: (c) => c.kind === "text" && !!c.text,
  },
  brightness: filterDef("brightness", "Brightness"),
  contrast: filterDef("contrast", "Contrast"),
  saturation: filterDef("saturation", "Saturation"),
  hue: filterDef("hue", "Hue"),
  temperature: filterDef("temperature", "Temperature"),
  tint: filterDef("tint", "Tint"),
  exposure: filterDef("exposure", "Exposure"),
  gamma: filterDef("gamma", "Gamma"),
  vignette: filterDef("vignette", "Vignette"),
  blur: filterDef("blur", "Blur"),
  sharpen: filterDef("sharpen", "Sharpen"),
  grayscale: filterDef("grayscale", "Grayscale"),
  sepia: filterDef("sepia", "Sepia"),
  invert: filterDef("invert", "Invert"),
};

function filterDef(id: (typeof FILTER_KEYS)[number], label: string): KeyframePropertyDef {
  return {
    id,
    label,
    group: "Filters",
    getValue: (c) => c.filters[id],
    apply: (c, v) => {
      c.filters = { ...c.filters, [id]: v };
    },
    format: (v) => v.toFixed(2),
    supports: (c) => c.kind === "video" || c.kind === "image" || c.kind === "sticker",
  };
}

/** Display/edit ranges used by the keyframe graph. */
export function propertyRange(prop: KeyframeProperty): { min: number; max: number } {
  switch (prop) {
    case "x":
    case "y":
      return { min: -1.2, max: 1.2 };
    case "scale":
      return { min: 0, max: 3 };
    case "rotation":
      return { min: -360, max: 360 };
    case "opacity":
      return { min: 0, max: 1 };
    case "volume":
      return { min: 0, max: 2 };
    case "fontSize":
      return { min: 12, max: 300 };
    case "hue":
      return { min: -180, max: 180 };
    case "temperature":
    case "tint":
      return { min: -100, max: 100 };
    case "brightness":
    case "contrast":
    case "saturation":
      return { min: 0, max: 2 };
    case "exposure":
      return { min: -2, max: 2 };
    case "gamma":
      return { min: 0.2, max: 2.5 };
    case "vignette":
    case "grayscale":
    case "sepia":
    case "invert":
    case "sharpen":
      return { min: 0, max: 1 };
    case "blur":
      return { min: 0, max: 20 };
    default:
      return { min: 0, max: 1 };
  }
}

/** Distinct hue per property group for graph lines. */
export const PROP_COLORS: Record<string, string> = {
  x: "#38bdf8",
  y: "#818cf8",
  scale: "#f472b6",
  rotation: "#fbbf24",
  opacity: "#34d399",
  volume: "#a3e635",
  fontSize: "#f97316",
  brightness: "#e879f9",
  contrast: "#fb7185",
  saturation: "#4ade80",
  hue: "#facc15",
  temperature: "#fb923c",
  tint: "#c084fc",
  exposure: "#fda4af",
  gamma: "#86efac",
  vignette: "#d8b4fe",
  blur: "#93c5fd",
  sharpen: "#fcd34d",
  grayscale: "#d1d5db",
  sepia: "#fdba74",
  invert: "#f9a8d4",
};

export function keyframableProperties(clip: Clip): KeyframePropertyDef[] {
  return Object.values(KEYFRAME_PROPERTIES).filter((p) => p.supports(clip));
}

/* ------------------------------------------------------------------ */
/* Keyframe CRUD (pure helpers — the store wires them into undo)        */
/* ------------------------------------------------------------------ */

export function getTrack(clip: Clip, prop: KeyframeProperty): Keyframe[] {
  return clip.keyframes?.[prop] ?? [];
}

export function hasKeyframes(clip: Clip): boolean {
  if (!clip.keyframes) return false;
  return Object.values(clip.keyframes).some((t) => t && t.length > 0);
}

export function countKeyframes(clip: Clip): number {
  if (!clip.keyframes) return 0;
  return Object.values(clip.keyframes).reduce((n, t) => n + (t?.length ?? 0), 0);
}

export function keyframeAt(kfs: Keyframe[], time: number, fps: number): Keyframe | undefined {
  const tol = 0.5 / Math.max(1, fps);
  return kfs.find((k) => Math.abs(k.time - time) <= tol);
}

/** Upsert a keyframe; `value` defaults to the property's current value on the clip. */
export function upsertKeyframe(
  clip: Clip,
  prop: KeyframeProperty,
  time: number,
  fps: number,
  value?: number,
  easing: EasingId = "ease-in-out"
): KeyframeTracks {
  const def = KEYFRAME_PROPERTIES[prop];
  const existing = getTrack(clip, prop);
  const kf = keyframeAt(existing, time, fps);
  let next: Keyframe[];
  if (kf) {
    next = existing.map((k) =>
      k.id === kf.id ? { ...k, value: value ?? k.value, time } : k
    );
  } else {
    next = sortKeyframes([
      ...existing,
      { id: createId("kf"), time, value: value ?? def.getValue(clip), easing },
    ]);
  }
  return withTrack(clip.keyframes, prop, next);
}

export function removeKeyframe(
  clip: Clip,
  prop: KeyframeProperty,
  kfId: string
): KeyframeTracks {
  return withTrack(clip.keyframes, prop, getTrack(clip, prop).filter((k) => k.id !== kfId));
}

export function moveKeyframe(
  clip: Clip,
  prop: KeyframeProperty,
  kfId: string,
  time: number
): KeyframeTracks {
  const dur = clipEnd(clip);
  const t = clamp(time, clip.start, Math.max(clip.start, dur));
  return withTrack(
    clip.keyframes,
    prop,
    sortKeyframes(getTrack(clip, prop).map((k) => (k.id === kfId ? { ...k, time: t } : k)))
  );
}

export function setKeyframeValue(
  clip: Clip,
  prop: KeyframeProperty,
  kfId: string,
  value: number
): KeyframeTracks {
  return withTrack(
    clip.keyframes,
    prop,
    getTrack(clip, prop).map((k) => (k.id === kfId ? { ...k, value } : k))
  );
}

export function setKeyframeEasing(
  clip: Clip,
  prop: KeyframeProperty,
  kfId: string,
  easing: EasingId
): KeyframeTracks {
  return withTrack(
    clip.keyframes,
    prop,
    getTrack(clip, prop).map((k) => (k.id === kfId ? { ...k, easing } : k))
  );
}

function withTrack(
  tracks: KeyframeTracks | undefined,
  prop: KeyframeProperty,
  kfs: Keyframe[]
): KeyframeTracks {
  const next: KeyframeTracks = { ...tracks };
  if (kfs.length === 0) delete next[prop];
  else next[prop] = kfs;
  return next;
}

/* ------------------------------------------------------------------ */
/* Motion presets — one click writes fully editable keyframes           */
/* ------------------------------------------------------------------ */

export interface MotionPreset {
  id: string;
  label: string;
  /** Which keyframe properties the preset owns (cleared before applying). */
  props: KeyframeProperty[];
  build: (clip: Clip) => KeyframeTracks;
}

function kf(time: number, value: number, easing: EasingId = "ease-in-out"): Keyframe {
  return { id: createId("kf"), time, value, easing };
}

const D = 0.6; // standard in/out duration

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "ken-burns",
    label: "Ken Burns",
    props: ["scale", "x", "y"],
    build: (clip) => ({
      scale: [kf(clip.start, 1, "ease-in-out"), kf(clipEnd(clip), 1.22)],
      x: [kf(clip.start, 0), kf(clipEnd(clip), -0.03)],
      y: [kf(clip.start, 0), kf(clipEnd(clip), -0.02)],
    }),
  },
  {
    id: "zoom-out",
    label: "Zoom Out",
    props: ["scale"],
    build: (clip) => ({
      scale: [kf(clip.start, 1.35, "ease-in-out"), kf(clipEnd(clip), 1)],
    }),
  },
  {
    id: "fly-in-left",
    label: "Fly In ←",
    props: ["x", "opacity"],
    build: (clip) => ({
      x: [kf(clip.start, -1.6, "ease-out"), kf(clip.start + D, 0, "ease-out")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + D * 0.6, 1, "linear")],
    }),
  },
  {
    id: "fly-in-right",
    label: "Fly In →",
    props: ["x", "opacity"],
    build: (clip) => ({
      x: [kf(clip.start, 1.6, "ease-out"), kf(clip.start + D, 0, "ease-out")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + D * 0.6, 1, "linear")],
    }),
  },
  {
    id: "fly-in-up",
    label: "Fly In ↑",
    props: ["y", "opacity"],
    build: (clip) => ({
      y: [kf(clip.start, -1.4, "ease-out"), kf(clip.start + D, 0, "ease-out")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + D * 0.6, 1, "linear")],
    }),
  },
  {
    id: "fly-out-left",
    label: "Fly Out ←",
    props: ["x", "opacity"],
    build: (clip) => {
      const end = clipEnd(clip);
      return {
        x: [kf(end - D, 0, "ease-in"), kf(end, -1.6, "ease-in")],
        opacity: [kf(end - D * 0.4, 1, "linear"), kf(end, 0, "linear")],
      };
    },
  },
  {
    id: "pop-in",
    label: "Pop In",
    props: ["scale", "opacity"],
    build: (clip) => ({
      scale: [kf(clip.start, 0, "back"), kf(clip.start + 0.45, 1, "ease-out")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + 0.2, 1, "linear")],
    }),
  },
  {
    id: "spin-in",
    label: "Spin In",
    props: ["rotation", "scale", "opacity"],
    build: (clip) => ({
      rotation: [kf(clip.start, -240, "ease-out"), kf(clip.start + 0.7, 0, "ease-out")],
      scale: [kf(clip.start, 0.3, "ease-out"), kf(clip.start + 0.7, 1, "ease-out")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + 0.3, 1, "linear")],
    }),
  },
  {
    id: "spin",
    label: "Slow Spin",
    props: ["rotation"],
    build: (clip) => ({
      rotation: [kf(clip.start, 0, "linear"), kf(clipEnd(clip), 360, "linear")],
    }),
  },
  {
    id: "bounce-in",
    label: "Bounce In",
    props: ["y", "opacity"],
    build: (clip) => ({
      y: [kf(clip.start, -1.1, "bounce"), kf(clip.start + 0.8, 0, "bounce")],
      opacity: [kf(clip.start, 0, "linear"), kf(clip.start + 0.15, 1, "linear")],
    }),
  },
  {
    id: "shake",
    label: "Shake",
    props: ["x", "y"],
    build: (clip) => {
      const s = clip.start;
      const x: Keyframe[] = [];
      const y: Keyframe[] = [];
      const steps = 12;
      const dur = 0.9;
      for (let i = 0; i <= steps; i++) {
        const t = s + (dur * i) / steps;
        const decay = 1 - i / steps;
        x.push(kf(t, ((i % 2 === 0 ? 1 : -1) * 0.022 * decay), "ease-in-out"));
        y.push(kf(t, ((i % 4 < 2 ? 1 : -1) * 0.012 * decay), "ease-in-out"));
      }
      return { x, y };
    },
  },
  {
    id: "float",
    label: "Float",
    props: ["y"],
    build: (clip) => {
      const s = clip.start;
      const e = clipEnd(clip);
      const mid = (s + e) / 2;
      return {
        y: [
          kf(s, 0, "ease-in-out"),
          kf(s + (mid - s) / 2, -0.035, "ease-in-out"),
          kf(mid, 0, "ease-in-out"),
          kf(mid + (e - mid) / 2, 0.035, "ease-in-out"),
          kf(e, 0, "ease-in-out"),
        ],
      };
    },
  },
  {
    id: "pulse",
    label: "Pulse",
    props: ["scale"],
    build: (clip) => {
      const s = clip.start;
      const e = clipEnd(clip);
      const quarter = (e - s) / 4;
      return {
        scale: [
          kf(s, 1, "ease-in-out"),
          kf(s + quarter, 1.07, "ease-in-out"),
          kf(s + quarter * 2, 1, "ease-in-out"),
          kf(s + quarter * 3, 1.07, "ease-in-out"),
          kf(e, 1, "ease-in-out"),
        ],
      };
    },
  },
  {
    id: "heartbeat",
    label: "Heartbeat",
    props: ["scale"],
    build: (clip) => {
      const s = clip.start;
      const beat = (t0: number): Keyframe[] => [
        kf(t0, 1, "ease-out"),
        kf(t0 + 0.1, 1.12, "ease-in"),
        kf(t0 + 0.22, 1, "ease-out"),
        kf(t0 + 0.32, 1.09, "ease-in"),
        kf(t0 + 0.48, 1, "ease-in-out"),
      ];
      const e = clipEnd(clip);
      const out = [...beat(s)];
      if (e - s > 1.2) out.push(...beat(s + 1.0));
      return { scale: out };
    },
  },
  {
    id: "swing",
    label: "Swing",
    props: ["rotation"],
    build: (clip) => {
      const s = clip.start;
      const e = clipEnd(clip);
      const quarter = (e - s) / 4;
      return {
        rotation: [
          kf(s, 0, "ease-in-out"),
          kf(s + quarter, 6, "ease-in-out"),
          kf(s + quarter * 2, 0, "ease-in-out"),
          kf(s + quarter * 3, -6, "ease-in-out"),
          kf(e, 0, "ease-in-out"),
        ],
      };
    },
  },
  {
    id: "fade-in-out",
    label: "Fade In/Out",
    props: ["opacity"],
    build: (clip) => {
      const e = clipEnd(clip);
      return {
        opacity: [
          kf(clip.start, 0, "ease-out"),
          kf(clip.start + D, 1, "linear"),
          kf(e - D, 1, "ease-in"),
          kf(e, 0, "ease-in"),
        ],
      };
    },
  },
  {
    id: "pan-left",
    label: "Pan ←",
    props: ["x"],
    build: (clip) => ({
      x: [kf(clip.start, 0.08, "linear"), kf(clipEnd(clip), -0.08, "linear")],
    }),
  },
  {
    id: "pan-right",
    label: "Pan →",
    props: ["x"],
    build: (clip) => ({
      x: [kf(clip.start, -0.08, "linear"), kf(clipEnd(clip), 0.08, "linear")],
    }),
  },
];

export function applyMotionPreset(clip: Clip, presetId: string): KeyframeTracks {
  const preset = MOTION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return clip.keyframes ?? {};
  const next: KeyframeTracks = { ...clip.keyframes };
  for (const prop of preset.props) delete next[prop];
  const generated = preset.build(clip);
  for (const [prop, kfs] of Object.entries(generated)) {
    next[prop as KeyframeProperty] = kfs;
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Live motion recording (unique feature)                               */
/* ------------------------------------------------------------------ */

export interface MotionSample {
  time: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

/**
 * Convert live-recorded pointer samples into tidy keyframe tracks.
 * Smart thinning: drops samples that lie close to the linear interpolation of
 * their kept neighbours, so the recording stays hand-editable.
 */
export function samplesToKeyframes(
  samples: MotionSample[],
  props: KeyframeProperty[],
  tolerance: Partial<Record<KeyframeProperty, number>> = {}
): KeyframeTracks {
  const tracks: KeyframeTracks = {};
  if (samples.length === 0) return tracks;

  for (const prop of props) {
    const tol = tolerance[prop] ?? defaultTolerance(prop);
    const raw = samples.map((s) => ({ time: s.time, value: (s as unknown as Record<string, number>)[prop] }));
    const kept = thinSamples(raw, tol);
    if (kept.length === 0) continue;
    const kfs: Keyframe[] = kept.map((p) => kf(p.time, p.value, "ease-in-out"));
    // Guarantee at least first + last sample exist.
    if (kfs[0]!.time !== raw[0]!.time) kfs.unshift(kf(raw[0]!.time, raw[0]!.value, "ease-in-out"));
    const lastRaw = raw[raw.length - 1]!;
    if (kfs[kfs.length - 1]!.time !== lastRaw.time) kfs.push(kf(lastRaw.time, lastRaw.value, "ease-in-out"));
    tracks[prop] = kfs;
  }
  return tracks;
}

function defaultTolerance(prop: KeyframeProperty): number {
  switch (prop) {
    case "x":
    case "y":
      return 0.004;
    case "scale":
      return 0.006;
    case "rotation":
      return 0.75;
    case "opacity":
      return 0.01;
    default:
      return 0.01;
  }
}

function thinSamples(
  points: { time: number; value: number }[],
  tol: number
): { time: number; value: number }[] {
  if (points.length <= 2) return points;

  // Greedy curve simplification: grow a segment from the last kept point as
  // long as every intermediate sample stays within `tol` of the straight line
  // to the candidate end. Straight drags collapse to two keyframes; curved
  // paths keep exactly as many points as the tolerance requires.
  const LOOKAHEAD = 64;
  const kept: { time: number; value: number }[] = [points[0]!];
  let i = 0;
  while (i < points.length - 1) {
    const limit = Math.min(points.length - 1, i + LOOKAHEAD);
    let best = i + 1;
    for (let k = i + 1; k <= limit; k++) {
      const span = points[k]!.time - points[i]!.time;
      let ok = span > 0;
      if (ok) {
        for (let m = i + 1; m < k; m++) {
          const t = (points[m]!.time - points[i]!.time) / span;
          const expected = points[i]!.value + (points[k]!.value - points[i]!.value) * t;
          if (Math.abs(points[m]!.value - expected) > tol) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) break;
      best = k;
    }
    kept.push(points[best]!);
    i = best;
  }
  return kept;
}
