import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  visualClipsAt,
  layoutContains,
  type VisualLayout,
} from "../lib/canvas-compositor";
import type { Clip, DrawStroke } from "../types/clip";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { beginHistoryTransaction, endHistoryTransaction, type HistorySlice } from "../hooks/useUndoRedo";
import { makeStroke, appendPoint } from "../lib/drawing";
import type { MotionSample } from "../lib/keyframes";
import { getPreviewEngine } from "../lib/engine-registry";
import { formatTimecode } from "../lib/time-format";

type DragMode = "move" | "scale" | "rotate";

interface DragState {
  mode: DragMode;
  clipId: string;
  pointerId: number;
  /** Canvas-px pointer origin. */
  startX: number;
  startY: number;
  /** Clip property origins. */
  origin: { x: number; y: number; scale: number; rotation: number; opacity: number };
  /** Layout center at drag start (canvas px). */
  cx: number;
  cy: number;
  history: HistorySlice | null;
  moved: boolean;
  /** Live motion recording samples (canvas-agnostic, normalized). */
  samples: MotionSample[];
  sampleStart: number;
}

interface InkState {
  clipId: string;
  stroke: DrawStroke;
  pointerId: number;
  history: HistorySlice;
  /** Timeline time when inking started. */
  t0: number;
  /** Wall-clock ms when inking started. */
  wall0: number;
  followPlayhead: boolean;
}

const SNAP_CENTER_TOL = 0.012; // normalized units
const ROTATE_SNAP = [0, 90, 180, 270, -90, -180, -270];

/**
 * Interactive layer over the preview canvas:
 * - click to select, drag to move, corner handles to scale, top handle to rotate
 * - center snapping with on-canvas guides
 * - double-click a text clip for on-canvas inline editing
 * - freehand drawing tool (animated draw-on playback)
 * - "motion recorder": drag an object around while armed and the gesture
 *   becomes keyframes (path animation) with smart sample thinning
 */
export function PreviewOverlay({
  showGuides,
  hiddenClipIdsRef,
}: {
  showGuides: boolean;
  hiddenClipIdsRef: React.RefObject<Set<string>>;
}) {
  const { tracks, currentTime, selection, settings, drawMode, motionRecording, textEditRequest } =
    useEditor((s) => ({
      tracks: s.tracks,
      currentTime: s.currentTime,
      selection: s.selection,
      settings: s.settings,
      drawMode: s.drawMode,
      motionRecording: s.motionRecording,
      textEditRequest: s.textEditRequest,
    }));

  const layerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const dragRef = React.useRef<DragState | null>(null);
  const inkRef = React.useRef<InkState | null>(null);
  const [snapV, setSnapV] = React.useState(false);
  const [snapH, setSnapH] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = React.useState<string | null>(null);

  const scale = size.w > 0 ? size.w / settings.width : 0;

  /* Measure the canvas display box. */
  React.useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  /* The playback engine registers from an effect — poll briefly until it's up
     so video/image hit-testing works on the very first interaction. */
  const [, setEngineTick] = React.useState(0);
  React.useEffect(() => {
    if (getPreviewEngine()) return;
    const t = window.setTimeout(() => setEngineTick((n) => n + 1), 200);
    return () => window.clearTimeout(t);
  });

  /* Items visible at the playhead, topmost first. */
  const engine = getPreviewEngine();
  const items = React.useMemo(
    () =>
      scale > 0
        ? visualClipsAt(tracks, currentTime, settings.width, settings.height, engine)
        : [],
    // engine identity changes are covered by tracks/currentTime updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, currentTime, settings.width, settings.height, scale]
  );

  const selectedItem = React.useMemo(() => {
    for (const id of selection) {
      const item = items.find((i) => i.clip.id === id);
      if (item) return item;
    }
    return null;
  }, [items, selection]);

  /* External "edit text" requests (inspector button / shortcuts). */
  React.useEffect(() => {
    if (textEditRequest === 0) return;
    const state = useEditorStore.getState();
    const id = state.selection[0];
    if (!id) return;
    const clip = items.find((i) => i.clip.id === id)?.clip;
    if (clip && clip.kind === "text") {
      beginEditing(clip.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditRequest]);

  const beginEditing = (clipId: string) => {
    setEditingId(clipId);
    hiddenClipIdsRef.current?.add(clipId);
  };
  const endEditing = () => {
    if (editingId) hiddenClipIdsRef.current?.delete(editingId);
    setEditingId(null);
  };

  /* ---------------- coordinate helpers ---------------- */

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = layerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / (rect.width / settings.width),
      y: (clientY - rect.top) / (rect.height / settings.height),
    };
  };

  const toNormalized = (clientX: number, clientY: number) => {
    const rect = layerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  /* ---------------- drag / scale / rotate ---------------- */

  const beginDrag = (
    e: React.PointerEvent,
    mode: DragMode,
    clip: Clip,
    layout: VisualLayout
  ) => {
    e.stopPropagation();
    const store = useEditorStore.getState();
    const p = toCanvas(e.clientX, e.clientY);
    dragRef.current = {
      mode,
      clipId: clip.id,
      pointerId: e.pointerId,
      startX: p.x,
      startY: p.y,
      origin: { ...clip.transform },
      cx: layout.cx,
      cy: layout.cy,
      history: null,
      moved: false,
      samples: [],
      sampleStart: store.currentTime,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLayerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const layer = layerRef.current;
    if (!layer || scale <= 0) return;

    /* Drawing tool takes over the layer. */
    if (drawMode) {
      startInk(e);
      return;
    }

    const p = toCanvas(e.clientX, e.clientY);
    const margin = 10 / scale;

    // Topmost item under the pointer.
    let hit: (typeof items)[number] | null = null;
    for (const item of items) {
      if (item.track.locked) continue;
      if (layoutContains(item.layout, p.x, p.y, margin)) {
        hit = item;
        break;
      }
    }

    const store = useEditorStore.getState();
    if (!hit) {
      if (e.target === layer) store.clearSelection();
      return;
    }

    if (!store.selection.includes(hit.clip.id)) store.select([hit.clip.id], e.shiftKey);
    if (hit.track.locked) return;
    store.setPlaying(false);
    beginDrag(e, "move", hit.clip, hit.layout);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const layer = layerRef.current;
    if (!layer || scale <= 0) return;

    const ink = inkRef.current;
    if (ink && e.pointerId === ink.pointerId) {
      moveInk(e);
      return;
    }

    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) {
      // Hover cursor feedback
      if (!drawMode) {
        const p = toCanvas(e.clientX, e.clientY);
        const margin = 10 / scale;
        const hovered = items.some(
          (i) => !i.track.locked && layoutContains(i.layout, p.x, p.y, margin)
        );
        setHoverCursor(hovered ? "move" : null);
      }
      return;
    }

    if (!drag.moved) {
      drag.moved = true;
      drag.history = beginHistoryTransaction();
    }

    const store = useEditorStore.getState();
    const p = toCanvas(e.clientX, e.clientY);
    const clip = store.tracks.flatMap((t) => t.clips).find((c) => c.id === drag.clipId);
    if (!clip) return;

    let { x, y, scale: sc, rotation } = drag.origin;

    if (drag.mode === "move") {
      x += (p.x - drag.startX) / settings.width;
      y += (p.y - drag.startY) / settings.height;
      // Magnetic center guides.
      const snapV = Math.abs(x) < SNAP_CENTER_TOL;
      const snapH = Math.abs(y) < SNAP_CENTER_TOL;
      if (snapV) x = 0;
      if (snapH) y = 0;
      setSnapV(snapV);
      setSnapH(snapH);
    } else if (drag.mode === "scale") {
      const d0 = Math.max(4, Math.hypot(drag.startX - drag.cx, drag.startY - drag.cy));
      const d1 = Math.hypot(p.x - drag.cx, p.y - drag.cy);
      sc = Math.min(8, Math.max(0.03, (drag.origin.scale * d1) / d0));
    } else if (drag.mode === "rotate") {
      const a0 = Math.atan2(drag.startY - drag.cy, drag.startX - drag.cx);
      const a1 = Math.atan2(p.y - drag.cy, p.x - drag.cx);
      let deg = drag.origin.rotation + ((a1 - a0) * 180) / Math.PI;
      for (const snap of ROTATE_SNAP) {
        if (Math.abs(deg - snap) < 5) {
          deg = snap > 180 ? snap - 360 : snap;
          break;
        }
      }
      rotation = Math.max(-360, Math.min(360, deg));
    }

    store.updateClip(drag.clipId, (c) => ({
      ...c,
      transform: { ...c.transform, x, y, scale: sc, rotation },
    }));

    if (useEditorStore.getState().motionRecording) {
      drag.samples.push({
        time: store.currentTime,
        x,
        y,
        scale: sc,
        rotation,
        opacity: clip.transform.opacity,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const ink = inkRef.current;
    if (ink && e.pointerId === ink.pointerId) {
      endInk();
      return;
    }
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setSnapV(false);
    setSnapH(false);
    const store = useEditorStore.getState();

    if (drag.moved && drag.history) {
      endHistoryTransaction(drag.history, true);
    }
    if (drag.moved && drag.samples.length > 1 && store.motionRecording) {
      store.recordMotionSamples(drag.clipId, drag.samples, ["x", "y", "scale", "rotation"]);
      toast.success(`Motion recorded — ${drag.samples.length} samples turned into keyframes`);
    }
  };

  /* ---------------- freehand ink ---------------- */

  const startInk = (e: React.PointerEvent) => {
    const store = useEditorStore.getState();
    store.setPlaying(false);
    const tool = store.drawMode;
    if (!tool) return;

    const history = beginHistoryTransaction();
    const stroke = makeStroke(tool);
    const np = toNormalized(e.clientX, e.clientY);
    const t0 = store.currentTime;
    // If a drawing clip is already active at the playhead, keep inking in its
    // local timeline; otherwise a new clip starts (local t = 0).
    let localT = 0;
    for (const track of store.tracks) {
      for (const c of track.clips) {
        if (c.kind === "drawing" && t0 >= c.start && t0 < c.start + c.duration) {
          localT = t0 - c.start;
        }
      }
    }
    stroke.points.push({ x: np.x, y: np.y, t: localT });

    const clipId = store.appendDrawingStroke({ ...stroke });
    if (!clipId) {
      endHistoryTransaction(history, false);
      return;
    }
    inkRef.current = {
      clipId,
      stroke,
      pointerId: e.pointerId,
      history,
      t0,
      wall0: performance.now(),
      followPlayhead: !store.playing,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveInk = (e: React.PointerEvent) => {
    const ink = inkRef.current;
    if (!ink) return;
    const store = useEditorStore.getState();

    // Keep timeline time flowing with the pen so inked points are visible.
    if (ink.followPlayhead) {
      const elapsed = (performance.now() - ink.wall0) / 1000;
      store.setCurrentTime(ink.t0 + elapsed);
    }

    const np = toNormalized(e.clientX, e.clientY);
    const clip = store.tracks.flatMap((t) => t.clips).find((c) => c.id === ink.clipId);
    if (!clip || !clip.drawing) return;
    const localT = Math.max(0, store.currentTime - clip.start);
    const updated = appendPoint(ink.stroke, { x: np.x, y: np.y, t: localT });
    ink.stroke = updated;
    store.updateClip(ink.clipId, (c) => {
      if (!c.drawing) return c;
      const strokes = [...c.drawing.strokes];
      strokes[strokes.length - 1] = updated;
      return { ...c, drawing: { strokes } };
    });
  };

  const endInk = () => {
    const ink = inkRef.current;
    if (!ink) return;
    inkRef.current = null;
    const store = useEditorStore.getState();
    // Ensure the clip is long enough to show the whole stroke.
    const clip = store.tracks.flatMap((t) => t.clips).find((c) => c.id === ink.clipId);
    if (clip) {
      const lastT = ink.stroke.points[ink.stroke.points.length - 1]?.t ?? 0;
      const needed = lastT + 0.4;
      if (clip.duration < needed) {
        store.updateClip(ink.clipId, (c) => ({ ...c, duration: needed }));
      }
    }
    endHistoryTransaction(ink.history, true);
  };

  /* ---------------- inline text editing ---------------- */

  const editingItem = editingId ? items.find((i) => i.clip.id === editingId) : null;
  React.useEffect(() => {
    // Leaving the time range of the edited clip closes the editor.
    if (editingId && !editingItem) endEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, editingId]);

  /* ---------------- render ---------------- */

  const boxStyleFor = (layout: VisualLayout): React.CSSProperties => ({
    position: "absolute",
    left: (layout.cx - layout.w / 2) * scale,
    top: (layout.cy - layout.h / 2) * scale,
    width: layout.w * scale,
    height: layout.h * scale,
    transform: `rotate(${layout.rotation}rad)`,
  });

  const handleSize = 10;
  const handleOffset = -handleSize / 2;

  return (
    <div
      ref={layerRef}
      className={cn(
        "absolute inset-0 select-none",
        drawMode ? "cursor-crosshair" : hoverCursor === "move" ? "cursor-move" : "cursor-default"
      )}
      style={{ touchAction: drawMode ? "none" : "auto" }}
      onPointerDown={onLayerPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        const p = toCanvas(e.clientX, e.clientY);
        for (const item of items) {
          if (item.clip.kind === "text" && !item.track.locked &&
              layoutContains(item.layout, p.x, p.y, 10 / (scale || 1))) {
            useEditorStore.getState().select([item.clip.id]);
            beginEditing(item.clip.id);
            return;
          }
        }
      }}
    >
      {/* Faint outlines for other manipulable clips */}
      {items
        .filter(
          (i) =>
            i.clip.id !== selectedItem?.clip.id &&
            i.clip.id !== editingId &&
            !i.track.locked &&
            i.clip.kind !== "drawing"
        )
        .map((i) => (
          <div
            key={i.clip.id}
            className="pointer-events-none absolute rounded-[2px] border border-white/25"
            style={boxStyleFor(i.layout)}
            aria-hidden
          />
        ))}

      {/* Selected clip box + handles */}
      {selectedItem && !editingId && (
        <div
          className="absolute rounded-[2px] border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={boxStyleFor(selectedItem.layout)}
          aria-hidden
        >
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              className="absolute h-2.5 w-2.5 rounded-full border border-primary bg-background shadow-elevation-1"
              style={{
                top: corner.startsWith("n") ? handleOffset : undefined,
                bottom: corner.startsWith("s") ? handleOffset : undefined,
                left: corner.endsWith("w") ? handleOffset : undefined,
                right: corner.endsWith("e") ? handleOffset : undefined,
                cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                touchAction: "none",
              }}
              onPointerDown={(e) => beginDrag(e, "scale", selectedItem.clip, selectedItem.layout)}
            />
          ))}
          {/* Rotate handle */}
          <div
            className="absolute left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-full cursor-grab items-end justify-center"
            style={{ top: -handleSize, touchAction: "none" }}
            onPointerDown={(e) => beginDrag(e, "rotate", selectedItem.clip, selectedItem.layout)}
          >
            <div className="mb-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-background text-primary shadow-elevation-1">
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v5h-5" />
              </svg>
            </div>
          </div>
          {/* Label chip */}
          <div className="absolute -top-6 left-0 whitespace-nowrap rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-elevation-1">
            {labelFor(selectedItem.clip)} · {Math.round(selectedItem.clip.transform.scale * 100)}%
          </div>
        </div>
      )}

      {/* Center snap guides */}
      {snapV && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-primary/80" aria-hidden />
      )}
      {snapH && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-primary/80" aria-hidden />
      )}

      {/* Composition guides */}
      {showGuides && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
          <div className="absolute inset-[5%] border border-white/25" />
          <div className="absolute inset-[10%] border border-dashed border-white/20" />
        </div>
      )}

      {/* Motion recording indicator */}
      {motionRecording && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-elevation-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Motion recording — drag to animate
        </div>
      )}

      {/* Drawing mode chip */}
      {drawMode && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-elevation-2">
          Draw — ink on the canvas
        </div>
      )}

      {/* Inline text editor */}
      {editingItem && editingItem.clip.text && (
        <InlineTextEditor
          clip={editingItem.clip}
          layout={editingItem.layout}
          scale={scale}
          onDone={endEditing}
        />
      )}
    </div>
  );
}

function labelFor(clip: Clip): string {
  switch (clip.kind) {
    case "text":
      return "Text";
    case "sticker":
      return "Sticker";
    case "drawing":
      return "Drawing";
    case "image":
      return "Image";
    default:
      return "Clip";
  }
}

/**
 * DOM twin of a canvas-rendered text clip, positioned exactly over its box.
 * The canvas copy is hidden while this is mounted, so what you type is what
 * you get — with a caret, selection and keyboard editing for free.
 */
function InlineTextEditor({
  clip,
  layout,
  scale,
  onDone,
}: {
  clip: Clip;
  layout: VisualLayout;
  scale: number;
  onDone: () => void;
}) {
  const text = clip.text!;
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const fps = useEditor((s) => s.settings.fps);

  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const update = (patch: Partial<typeof text>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      text: c.text ? { ...c.text, ...patch } : c.text,
      label: patch.content !== undefined ? patch.content.split("\n")[0] || c.label : c.label,
    }));

  const fontSize = text.fontSize * scale;

  return (
    <div
      className="absolute z-10"
      style={{
        left: (layout.cx - layout.w / 2) * scale - 24,
        top: (layout.cy - layout.h / 2) * scale - 14,
        width: Math.max(120, layout.w * scale + 48),
        minHeight: layout.h * scale + 28,
        transform: `rotate(${layout.rotation}rad)`,
      }}
    >
      <textarea
        ref={ref}
        value={text.content}
        onChange={(e) => update({ content: e.target.value })}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            onDone();
          }
        }}
        onBlur={onDone}
        spellCheck={false}
        rows={Math.max(1, text.content.split("\n").length)}
        className="w-full resize-none overflow-hidden border-2 border-dashed border-primary bg-transparent p-1 text-center outline-none"
        style={{
          fontFamily: text.fontFamily,
          fontSize,
          fontWeight: text.fontWeight,
          lineHeight: text.lineHeight ?? 1.2,
          letterSpacing: (text.letterSpacing ?? 0) * scale,
          color: text.color,
          textAlign: text.align,
          caretColor: text.color,
          WebkitTextStroke: text.strokeWidth > 0 ? `${text.strokeWidth * scale}px ${text.strokeColor}` : undefined,
          paintOrder: "stroke fill",
          textShadow: text.shadowBlur > 0 ? `0 ${(text.shadowBlur * 0.35 * scale).toFixed(1)}px ${(text.shadowBlur * scale).toFixed(1)}px ${text.shadowColor}` : undefined,
        }}
        aria-label={`Edit text at ${formatTimecode(clip.start, fps)}`}
      />
      <div className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
        Typing… Esc to finish
      </div>
    </div>
  );
}
