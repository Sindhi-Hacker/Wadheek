import { z } from "zod";
import { LIMITS } from "@/config/limits";

export const clipTransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  fit: z.enum(["contain", "cover"]).optional(),
  backgroundBlur: z.number().min(0).max(1).optional(),
});

const keyframeSchema = z.object({
  id: z.string(),
  time: z.number(),
  value: z.number(),
  easing: z.string(),
});

export const clipSchema = z.object({
  id: z.string(),
  kind: z.enum(["video", "audio", "image", "text", "sticker", "drawing"]),
  mediaId: z.string().optional(),
  label: z.string(),
  start: z.number().min(0),
  duration: z.number().positive(),
  inOffset: z.number().min(0),
  speed: z.number().min(0.05).max(16),
  transform: clipTransformSchema,
  crop: z.object({
    left: z.number().min(0).max(1),
    right: z.number().min(0).max(1),
    top: z.number().min(0).max(1),
    bottom: z.number().min(0).max(1),
  }),
  blendMode: z.string(),
  filters: z.record(z.string(), z.union([z.number(), z.string()])).transform((v) => v as never),
  chroma: z
    .object({
      enabled: z.boolean(),
      color: z.string(),
      similarity: z.number().min(0).max(1),
      smoothness: z.number().min(0).max(1),
      spill: z.number().min(0).max(1),
    })
    .optional(),
  text: z
    .object({
      content: z.string().max(LIMITS.maxTextLength),
      fontFamily: z.string(),
      fontSize: z.number().positive(),
      fontWeight: z.number(),
      align: z.enum(["left", "center", "right"]),
      color: z.string(),
      strokeColor: z.string(),
      strokeWidth: z.number().min(0),
      shadowColor: z.string(),
      shadowBlur: z.number().min(0),
      background: z.string(),
      animationIn: z.string(),
      animationOut: z.string(),
      letterSpacing: z.number().optional(),
      lineHeight: z.number().optional(),
    })
    .optional(),
  sticker: z
    .object({
      type: z.enum(["emoji", "shape"]),
      content: z.string(),
      size: z.number().positive(),
      fill: z.string(),
      stroke: z.string(),
      strokeWidth: z.number().min(0),
      shadowBlur: z.number().min(0),
      shadowColor: z.string(),
    })
    .optional(),
  drawing: z
    .object({
      strokes: z.array(
        z.object({
          id: z.string(),
          color: z.string(),
          width: z.number().positive(),
          mode: z.enum(["pen", "marker"]),
          points: z.array(
            z.object({ x: z.number(), y: z.number(), t: z.number().min(0) })
          ),
        })
      ),
    })
    .optional(),
  audio: z.object({
    volume: z.number().min(0).max(4),
    pan: z.number().min(-1).max(1),
    fadeIn: z.number().min(0),
    fadeOut: z.number().min(0),
    muted: z.boolean(),
    preservePitch: z.boolean(),
  }),
  transitionIn: z.object({ type: z.string(), duration: z.number().min(0) }),
  transitionOut: z.object({ type: z.string(), duration: z.number().min(0) }),
  keyframes: z.record(z.string(), z.array(keyframeSchema)).optional(),
});

export const trackSchema = z.object({
  id: z.string(),
  kind: z.enum(["video", "overlay", "text", "audio"]),
  name: z.string(),
  muted: z.boolean(),
  solo: z.boolean(),
  locked: z.boolean(),
  hidden: z.boolean(),
  clips: z.array(clipSchema),
});

export const projectSettingsSchema = z.object({
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  fps: z.number().min(1).max(120),
  aspectId: z.string(),
  background: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(LIMITS.maxProjectNameLength),
  createdAt: z.number(),
  updatedAt: z.number(),
  settings: projectSettingsSchema,
  timeline: z.object({
    tracks: z.array(trackSchema),
    markers: z.array(z.object({ id: z.string(), time: z.number().min(0), name: z.string() })),
    inPoint: z.number().nullable(),
    outPoint: z.number().nullable(),
  }),
  mediaIds: z.array(z.string()),
});

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(LIMITS.maxProjectNameLength, `Keep it under ${LIMITS.maxProjectNameLength} characters`);

export const exportSettingsSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(120, "Keep it under 120 characters")
    .regex(/^[^\\/:*?"<>|]+$/, "No special path characters"),
  formatId: z.string(),
  resolutionId: z.string(),
  qualityId: z.string(),
  fps: z.number().min(1).max(120),
  range: z.enum(["all", "inout"]),
});

export type ProjectFileManifest = z.infer<typeof projectSchema>;
