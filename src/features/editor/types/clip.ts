import type { MediaType } from "./media";

export type ClipKind = MediaType | "text";

export interface ClipTransform {
  x: number; // -1..1 relative offset of canvas width
  y: number;
  scale: number;
  rotation: number; // degrees
  opacity: number; // 0..1
}

export interface ClipCrop {
  left: number; // 0..1 fraction cropped from each side
  right: number;
  top: number;
  bottom: number;
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
  text?: TextStyle;
  audio: ClipAudio;
  transitionIn: ClipTransition;
  transitionOut: ClipTransition;
}
