import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Clip, Keyframe, KeyframeProperty } from "../types/clip";
import {
  KEYFRAME_PROPERTIES,
  PROP_COLORS,
  applyEasing,
  propertyRange,
} from "../lib/keyframes";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { beginHistoryTransaction, endHistoryTransaction } from "../hooks/useUndoRedo";
import { formatTimecode } from "../lib/time-format";

const GRAPH_HEIGHT = 168;
const POINT_HIT_RADIUS = 10;

/**
 * Curve editor for one clip's keyframes.
 * - drag points to retime / revalue keyframes (snaps to frames)
 * - double-click empty space to add a keyframe for the first active property
 * - Alt-click a point to delete it
 * - the playhead mirrors the preview
 */
export function KeyframeGraph({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const { currentTime, fps } = useEditor((s) => ({
    currentTime: s.currentTime,
    fps: s.settings.fps,
  }));

  const [width, setWidth] = React.useState(600);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const props = React.useMemo(() => {
    const entries = Object.entries(clip.keyframes ?? {}) as [
      KeyframeProperty,
      Clip["keyframes"] extends undefined ? never : NonNullable<Clip["keyframes"]>[KeyframeProperty],
    ][];
    return entries.filter((entry): entry is [KeyframeProperty, Keyframe[]] => !!entry[1] && entry[1].length > 0);
  }, [clip.keyframes]);

  const [disabled, setDisabled] = React.useState<Set<KeyframeProperty>>(new Set());
  const activeProps = props.filter(([p]) => !disabled.has(p));

  const start = clip.start;
  const end = clip.start + clip.duration;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 18;
  const plotW = Math.max(50, width - padL - padR);
  const plotH = GRAPH_HEIGHT - padT - padB;

  const timeToX = (t: number) => padL + ((t - start) / Math.max(0.001, end - start)) * plotW;
  const xToTime = (x: number) =>
    start + ((x - padL) / plotW) * Math.max(0.001, end - start);
  const valueToY = (v: number, prop: KeyframeProperty) => {
    const { min, max } = propertyRange(prop);
    return padT + plotH - ((v - min) / (max - min)) * plotH;
  };
  const yToValue = (y: number, prop: KeyframeProperty) => {
    const { min, max } = propertyRange(prop);
    return min + ((padT + plotH - y) / plotH) * (max - min);
  };

  /* ---------------- interaction ---------------- */

  interface Grab {
    prop: KeyframeProperty;
    kfId: string;
    moved: boolean;
    history: ReturnType<typeof beginHistoryTransaction> | null;
  }
  const grabRef = React.useRef<Grab | null>(null);

  const locatePoint = (px: number, py: number) => {
    for (const [prop, kfs] of activeProps) {
      for (const kf of kfs) {
        const dx = px - timeToX(kf.time);
        const dy = py - valueToY(kf.value, prop);
        if (Math.hypot(dx, dy) <= POINT_HIT_RADIUS) return { prop, kf };
      }
    }
    return null;
  };

  const localPos = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const { x, y } = localPos(e);
    const hit = locatePoint(x, y);
    if (!hit) return;
    if (e.altKey) {
      useEditorStore.getState().removeClipKeyframe(clip.id, hit.prop, hit.kf.id);
      return;
    }
    grabRef.current = {
      prop: hit.prop,
      kfId: hit.kf.id,
      moved: false,
      history: null,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const grab = grabRef.current;
    if (!grab) return;
    const { x, y } = localPos(e);
    if (!grab.moved) {
      grab.moved = true;
      grab.history = beginHistoryTransaction();
    }
    const store = useEditorStore.getState();
    const fpsNow = store.settings.fps;
    let t = xToTime(x);
    t = Math.round(t * fpsNow) / fpsNow;
    t = Math.min(end, Math.max(start, t));
    const value = yToValue(y, grab.prop);
    store.moveClipKeyframe(clip.id, grab.prop, grab.kfId, t);
    store.setClipKeyframeValue?.(clip.id, grab.prop, grab.kfId, value);
  };

  const onPointerUp = () => {
    const grab = grabRef.current;
    if (!grab) return;
    grabRef.current = null;
    if (grab.moved && grab.history) endHistoryTransaction(grab.history, true);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = localPos(e);
    if (x < padL || x > padL + plotW) return;
    if (locatePoint(x, y)) return;
    const [prop] = activeProps[0] ?? [];
    if (!prop) return;
    const store = useEditorStore.getState();
    let t = xToTime(x);
    t = Math.round(t * store.settings.fps) / store.settings.fps;
    const value = yToValue(y, prop);
    store.toggleClipKeyframe(clip.id, prop, t);
    // then set its value
    const updated = findClipById(clip.id);
    const kf = updated?.keyframes?.[prop]?.[updated.keyframes[prop]!.length - 1];
    if (kf) store.setClipKeyframeValue?.(clip.id, prop, kf.id, value);
    toast(`Keyframe added on ${KEYFRAME_PROPERTIES[prop].label}`);
  };

  /* ---------------- drawing ---------------- */

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = GRAPH_HEIGHT * dpr;
    canvas.style.height = `${GRAPH_HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, GRAPH_HEIGHT);

    const style = getComputedStyle(document.documentElement);
    const gridColor = style.getPropertyValue("--grid-line") || "#333";
    const fgDim = "rgba(128,128,128,0.9)";
    const font = "10px ui-monospace, monospace";

    // Grid + time ticks
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const tickCount = 8;
    ctx.font = font;
    ctx.fillStyle = fgDim;
    for (let i = 0; i <= tickCount; i++) {
      const t = start + ((end - start) * i) / tickCount;
      const x = timeToX(t);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.textAlign = "center";
        ctx.fillText(formatTimecode(t, fps).split(":").pop() ?? "", x, GRAPH_HEIGHT - 5);
      }
    }

    // Curves
    for (const [prop, kfs] of activeProps) {
      const color = PROP_COLORS[prop] ?? "#38bdf8";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sorted = [...kfs].sort((a, b) => a.time - b.time);
      sorted.forEach((kf, i) => {
        const x = timeToX(kf.time);
        const y = valueToY(kf.value, prop);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prev = sorted[i - 1]!;
          const px = timeToX(prev.time);
          const py = valueToY(prev.value, prop);
          if (prev.easing === "hold") {
            ctx.lineTo(px, y);
            ctx.lineTo(x, y);
          } else {
            // Sample the easing curve for a true preview.
            const steps = 16;
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const xAt = px + (x - px) * t;
              const eased = applyEasing(t, prev.easing);
              const yAt = py + (y - py) * eased;
              ctx.lineTo(xAt, yAt);
            }
          }
        }
      });
      // Extend to the clip edges with the boundary values.
      if (sorted.length > 0) {
        const first = sorted[0]!;
        if (first.time > start) {
          ctx.lineTo(padL, valueToY(first.value, prop));
        }
      }
      ctx.stroke();

      // Points
      for (const kf of sorted) {
        const x = timeToX(kf.time);
        const y = valueToY(kf.value, prop);
        const atPlayhead = Math.abs(kf.time - currentTime) <= 0.5 / Math.max(1, fps);
        ctx.beginPath();
        ctx.arc(x, y, atPlayhead ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = atPlayhead ? "#ffffff" : color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#0a0a0a";
        ctx.stroke();
      }
    }

    // Playhead
    const px = timeToX(Math.min(Math.max(currentTime, start), end));
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, padT - 4);
    ctx.lineTo(px, padT + plotH);
    ctx.stroke();
  }, [width, activeProps, currentTime, start, end, fps]);

  return (
    <div className="border-t bg-panel" data-keyframe-graph>
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-1.5">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Curves
        </span>
        {props.map(([prop]) => {
          const on = !disabled.has(prop);
          return (
            <button
              key={prop}
              onClick={() =>
                setDisabled((prev) => {
                  const next = new Set(prev);
                  if (next.has(prop)) next.delete(prop);
                  else next.add(prop);
                  return next;
                })
              }
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                on ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground/50"
              )}
              aria-pressed={on}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: on ? PROP_COLORS[prop] : "#666" }}
              />
              {KEYFRAME_PROPERTIES[prop]?.label ?? prop}
            </button>
          );
        })}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          drag points · dbl-click adds · Alt-click deletes
        </span>
        <button
          className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
          aria-label="Close curve editor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div ref={wrapRef} className="px-2 pb-2">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair rounded-md border bg-background"
          style={{ height: GRAPH_HEIGHT, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          role="img"
          aria-label="Keyframe curve editor"
        />
      </div>
    </div>
  );
}

function findClipById(id: string): Clip | undefined {
  for (const track of useEditorStore.getState().tracks) {
    for (const clip of track.clips) {
      if (clip.id === id) return clip;
    }
  }
  return undefined;
}
