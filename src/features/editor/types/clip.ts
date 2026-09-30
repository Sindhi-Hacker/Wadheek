import type { MediaType } from "./media";

export type ClipKind = MediaType | "text" | "sticker" | "drawing";

export interface ClipTransform {
  x: number; // -1..1 relative offset of canvas width
  y: number;
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  /** Mirror horizontally. */
  flipX: boolean;
  /** Mirror vertically. */
  flipY: boolean;
  /** How the source is fitted into the canvas before transforms. */
  fit: "contain" | "cover";
  /** Blurred "cover" copy drawn behind the contained frame (0 = off). */
  backgroundBlur: number; // 0..1
}

export interface ClipCrop {
  left: number; // 0..1 fraction cropped from each side
  right: number;
  top: number;
  bottom: number;
}

export interface ChromaKeySettings {
  enabled: boolean;
  /** Hex color to key out. */
  color: string;
  /** 0..1 — how close a pixel's chroma must be to be removed. */
  similarity: number;
  /** 0..1 — softness of the alpha ramp at the key edge. */
  smoothness: number;
  /** 0..1 — green/violet spill suppression strength. */
  spill: number;
}

export interface ClipFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
  tint: number;
  exposure: number;
  gamma: number;
  vignette: number;
  blur: number;
  sharpen: number;
  grayscale: number;
  sepia: number;
  invert: number;
  presetId?: string;
}

export type TextAlign = "left" | "center" | "right";

export interface TextStyle {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  align: TextAlign;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  background: string;
  animationIn: string;
  animationOut: string;
  letterSpacing: number;
  lineHeight: number;
}

export interface ClipAudio {
  volume: number; // 0..2
  pan: number; // -1..1
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  muted: boolean;
  preservePitch: boolean;
}

export type TransitionType =
  | "none"
  | "crossfade"
  | "dip-black"
  | "dip-white"
  | "slide"
  | "wipe"
  | "zoom";

export interface ClipTransition {
  type: TransitionType;
  duration: number; // seconds
}

/* ------------------------------------------------------------------ */
/* Keyframes                                                            */
/* ------------------------------------------------------------------ */

export type EasingId =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "hold"
  | "back"
  | "elastic"
  | "bounce"
  | "spring";

/** A single keyframe. `easing` describes the curve from this keyframe to the next. */
export interface Keyframe {
  id: string;
  /** Absolute timeline time in seconds. */
  time: number;
  value: number;
  easing: EasingId;
}

/** Every property that can be keyframed. Filter ids map 1:1 onto ClipFilters keys. */
export type KeyframeProperty =
  | "x"
  | "y"
  | "scale"
  | "rotation"
  | "opacity"
  | "volume"
  | "fontSize"
  | "brightness"
  | "contrast"
  | "saturation"
  | "hue"
  | "temperature"
  | "tint"
  | "exposure"
  | "gamma"
  | "vignette"
  | "blur"
  | "sharpen"
  | "grayscale"
  | "sepia"
  | "invert";

export type KeyframeTracks = Partial<Record<KeyframeProperty, Keyframe[]>>;

/* ------------------------------------------------------------------ */
/* Stickers                                                             */
/* ------------------------------------------------------------------ */

export type StickerType = "emoji" | "shape";

export interface StickerStyle {
  type: StickerType;
  /** Emoji character or shape id (see lib/stickers.ts). */
  content: string;
  /** Rendered height in project-canvas pixels. */
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadowBlur: number;
  shadowColor: string;
}

/* ------------------------------------------------------------------ */
/* Drawing / annotation                                                 */
/* ------------------------------------------------------------------ */

export interface DrawPoint {
  /** Normalized 0..1 canvas coordinates. */
  x: number;
  y: number;
  /** Seconds since clip start when the point was inked (for animated draw-on). */
  t: number;
}

export interface DrawStroke {
  id: string;
  color: string;
  /** Stroke width in project-canvas pixels. */
  width: number;
  mode: "pen" | "marker";
  points: DrawPoint[];
}

export interface DrawingData {
  strokes: DrawStroke[];
}

export interface Clip {
  id: string;
  kind: ClipKind;
  mediaId?: string;
  label: string;
  /** Timeline position in seconds. */
  start: number;
  /** Timeline duration in seconds (after speed is applied). */
  duration: number;
  /** Offset into the source media in source-seconds. */
  inOffset: number;
  speed: number;
  transform: ClipTransform;
  crop: ClipCrop;
  blendMode: string;
  filters: ClipFilters;
  /** Green-screen key-out settings (video/image clips). */
  chroma?: ChromaKeySettings;
  text?: TextStyle;
  sticker?: StickerStyle;
  drawing?: DrawingData;
  audio: ClipAudio;
  transitionIn: ClipTransition;
  transitionOut: ClipTransition;
  /** Per-property keyframe tracks. */
  keyframes?: KeyframeTracks;
}
