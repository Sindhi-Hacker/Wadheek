import { createId } from "@/lib/utils";
import type { Ctx2D } from "./canvas-compositor";
import type { DrawPoint, DrawStroke, DrawingData } from "../types/clip";

/**
 * Freehand annotation model. Strokes live in normalized canvas space and each
 * point carries the timeline time it was inked, so drawings replay with an
 * animated "draw-on" effect during playback and export.
 */

export interface DrawingToolState {
  color: string;
  width: number;
  mode: "pen" | "marker";
}

export const DRAWING_COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

export const DRAWING_DEFAULTS: DrawingToolState = {
  color: "#ef4444",
  width: 8,
  mode: "pen",
};

export function makeStroke(tool: DrawingToolState): DrawStroke {
  return {
    id: createId("stroke"),
    color: tool.color,
    width: tool.width,
    mode: tool.mode,
    points: [],
  };
}

/**
 * Draw every stroke that has started before `localTime` (seconds since clip
 * start). Points inked later than localTime are hidden — the progressive
 * draw-on. Context is expected to be in project-canvas coordinate space.
 */
export function drawDrawing(
  ctx: Ctx2D,
  data: DrawingData,
  localTime: number,
  W: number,
  H: number
): void {
  for (const stroke of data.strokes) {
    const visible = stroke.points.filter((p) => p.t <= localTime);
    if (visible.length === 0) continue;
    const isDot = visible.length === 1;

    ctx.save();
    if (stroke.mode === "marker") {
      ctx.globalAlpha = 0.35;
      ctx.lineCap = "square";
    } else {
      ctx.globalAlpha = 1;
      ctx.lineCap = "round";
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    if (isDot) {
      const p = visible[0]!;
      // A single tap renders as a dot.
      ctx.fillStyle = stroke.color;
      ctx.arc(p.x * W, p.y * H, Math.max(1, stroke.width / 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const first = visible[0]!;
      ctx.moveTo(first.x * W, first.y * H);
      for (let i = 1; i < visible.length; i++) {
        const p = visible[i]!;
        ctx.lineTo(p.x * W, p.y * H);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Append a point (normalized coords + time) to a stroke. */
export function appendPoint(stroke: DrawStroke, point: DrawPoint): DrawStroke {
  const last = stroke.points[stroke.points.length - 1];
  // Skip micro-moves to keep the model light.
  if (last && Math.abs(last.x - point.x) < 0.0015 && Math.abs(last.y - point.y) < 0.0015) {
    return stroke;
  }
  return { ...stroke, points: [...stroke.points, point] };
}

/** Total inked duration of a drawing (when the last point lands). */
export function drawingInkDuration(data: DrawingData): number {
  let max = 0;
  for (const s of data.strokes) {
    for (const p of s.points) max = Math.max(max, p.t);
  }
  return max;
}
