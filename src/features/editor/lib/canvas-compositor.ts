import type { Clip } from "../types/clip";
import type { Track } from "../types/track";
import type { ProjectSettings } from "../types/project";
import { clipEnd } from "./timeline-math";
import { buildFilterString, applyOverlayPasses } from "./webgl-filters";
import { TRANSITIONS } from "@/config/defaults";
import { evaluatedTransform, evaluatedFilters, evaluatedFontSize } from "./keyframes";
import { drawSticker } from "./stickers";
import { drawDrawing } from "./drawing";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Supplies the current visual frame for a clip (video element, image, …). */
export interface FrameSourceProvider {
  getFrame(clip: Clip): CanvasImageSource | null;
  getSourceSize(clip: Clip): { width: number; height: number } | null;
}

interface TransitionEffect {
  alpha: number;
  translateX: number;
  scale: number;
  wipe: number | null; // 0..1 reveal from left
  dip: { color: string; alpha: number } | null;
}

function evaluateTransitions(clip: Clip, time: number): TransitionEffect {
  const fx: TransitionEffect = { alpha: 1, translateX: 0, scale: 1, wipe: null, dip: null };

  const applyPhase = (type: string, progress: number) => {
    // progress: 0 = fully transitioned out, 1 = fully visible.
    switch (type) {
      case "crossfade":
        fx.alpha *= progress;
        break;
      case "dip-black":
        fx.dip = { color: "#000000", alpha: 1 - progress };
        break;
      case "dip-white":
        fx.dip = { color: "#ffffff", alpha: 1 - progress };
        break;
      case "slide":
        fx.translateX += (1 - progress) * -1; // fraction of width
        fx.alpha *= Math.min(1, progress * 1.5);
        break;
      case "wipe":
        fx.wipe = fx.wipe === null ? progress : Math.min(fx.wipe, progress);
        break;
      case "zoom":
        fx.scale *= 0.6 + 0.4 * progress;
        fx.alpha *= progress;
        break;
      default:
        break;
    }
  };

  const tIn = clip.transitionIn;
  if (tIn.type !== "none" && tIn.duration > 0) {
    const local = time - clip.start;
    if (local < tIn.duration) applyPhase(tIn.type, Math.max(0, local / tIn.duration));
  }
  const tOut = clip.transitionOut;
  if (tOut.type !== "none" && tOut.duration > 0) {
    const remaining = clipEnd(clip) - time;
    if (remaining < tOut.duration) applyPhase(tOut.type, Math.max(0, remaining / tOut.duration));
  }
  return fx;
}

function evaluateTextAnimation(clip: Clip, time: number): { alpha: number; dy: number; scale: number } {
  const result = { alpha: 1, dy: 0, scale: 1 };
  const dur = TRANSITIONS.defaultDuration;
  const text = clip.text;
  if (!text) return result;

  const applyAnim = (anim: string, progress: number) => {
    switch (anim) {
      case "fade":
        result.alpha *= progress;
        break;
      case "slide-up":
        result.alpha *= progress;
        result.dy += (1 - progress) * 60;
        break;
      case "slide-down":
        result.alpha *= progress;
        result.dy -= (1 - progress) * 60;
        break;
      case "scale":
        result.alpha *= progress;
        result.scale *= 0.7 + 0.3 * progress;
        break;
      default:
        break;
    }
  };

  const local = time - clip.start;
  if (text.animationIn !== "none" && local < dur) {
    applyAnim(text.animationIn, Math.max(0, local / dur));
  }
  const remaining = clipEnd(clip) - time;
  if (text.animationOut !== "none" && remaining < dur) {
    applyAnim(text.animationOut, Math.max(0, remaining / dur));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Text measurement (shared with the preview overlay)                   */
/* ------------------------------------------------------------------ */

let measureCtx: Ctx2D | null = null;

function getMeasureCtx(): Ctx2D {
  if (!measureCtx) {
    if (typeof OffscreenCanvas !== "undefined") {
      measureCtx = new OffscreenCanvas(8, 8).getContext("2d") as Ctx2D;
    } else {
      measureCtx = document.createElement("canvas").getContext("2d") as Ctx2D;
    }
  }
  return measureCtx;
}

export function textFontString(clip: Clip, time: number): string {
  const text = clip.text!;
  const size = evaluatedFontSize(clip, time);
  return `${text.fontWeight} ${size}px ${text.fontFamily}`;
}

export interface TextBlockMetrics {
  width: number;
  height: number;
  lineHeight: number;
  lines: string[];
  fontSize: number;
}

/**
 * Measure the text block (untransformed) in canvas pixels. The block is
 * centered on the clip's anchor point, so the overlay selection box can be
 * derived directly from these bounds.
 */
export function measureTextBlock(clip: Clip, time: number): TextBlockMetrics | null {
  const text = clip.text;
  if (!text || !text.content) return null;
  const ctx = getMeasureCtx();
  const fontSize = evaluatedFontSize(clip, time);
  ctx.font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
  const spacing = text.letterSpacing ?? 0;
  const lines = text.content.split("\n");
  let width = 0;
  for (const line of lines) {
    const w = measureLine(ctx, line, spacing);
    if (w > width) width = w;
  }
  const lineHeight = fontSize * (text.lineHeight ?? 1.2);
  return { width, height: lineHeight * lines.length, lineHeight, lines, fontSize };
}

function measureLine(ctx: Ctx2D, line: string, spacing: number): number {
  if (spacing === 0 || line.length === 0) return ctx.measureText(line).width;
  let w = 0;
  for (const ch of line) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function drawLine(ctx: Ctx2D, line: string, x: number, y: number, spacing: number, align: string): void {
  if (spacing === 0 || line.length === 0) {
    ctx.fillText(line, x, y);
    return;
  }
  const ctxAny = ctx as CanvasRenderingContext2D;
  const widths = [...line].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (line.length - 1);
  let cursor = align === "left" ? x : align === "right" ? x - total : x - total / 2;
  [...line].forEach((ch, i) => {
    ctx.fillText(ch, cursor, y);
    cursor += (widths[i] ?? 0) + spacing;
  });
  void ctxAny;
}

/* ------------------------------------------------------------------ */
/* Visual layout (shared with the preview overlay)                      */
/* ------------------------------------------------------------------ */

export interface VisualLayout {
  /** Center in canvas px. */
  cx: number;
  cy: number;
  /** Drawn size in canvas px. */
  w: number;
  h: number;
  /** Radians. */
  rotation: number;
  alpha: number;
  /** Cover-fit clips are clipped to the canvas — the interactive box follows. */
  clipped: boolean;
}

/**
 * Where a visual (video/image) clip lands on the canvas at `time` — the exact
 * math the compositor draws with, reused by the preview overlay for selection
 * boxes and hit testing.
 */
export function computeVisualLayout(
  clip: Clip,
  time: number,
  W: number,
  H: number,
  sourceSize: { width: number; height: number } | null
): VisualLayout | null {
  if (!sourceSize || sourceSize.width === 0 || sourceSize.height === 0) return null;
  const t = evaluatedTransform(clip, time);
  const fx = evaluateTransitions(clip, time);
  const crop = clip.crop;

  const sw = sourceSize.width * (1 - crop.left - crop.right);
  const sh = sourceSize.height * (1 - crop.top - crop.bottom);
  if (sw <= 0 || sh <= 0) return null;

  const fitMode = t.fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const dw = sw * fitMode * t.scale * fx.scale;
  const dh = sh * fitMode * t.scale * fx.scale;

  return {
    cx: W / 2 + t.x * W + fx.translateX * W,
    cy: H / 2 + t.y * H,
    w: dw,
    h: dh,
    rotation: (t.rotation * Math.PI) / 180,
    alpha: Math.max(0, Math.min(1, t.opacity * fx.alpha)),
    clipped: t.fit === "cover",
  };
}

/** Layout of a text clip block (tight, centered on the anchor). */
export function computeTextLayout(
  clip: Clip,
  time: number,
  W: number,
  H: number
): VisualLayout | null {
  const metrics = measureTextBlock(clip, time);
  if (!metrics) return null;
  const t = evaluatedTransform(clip, time);
  const anim = evaluateTextAnimation(clip, time);
  return {
    cx: W / 2 + t.x * W,
    cy: H / 2 + t.y * H + anim.dy,
    w: metrics.width * t.scale * anim.scale,
    h: metrics.height * t.scale * anim.scale,
    rotation: (t.rotation * Math.PI) / 180,
    alpha: Math.max(0, Math.min(1, t.opacity * anim.alpha)),
    clipped: false,
  };
}

/** Layout of a sticker clip (square-ish). */
export function computeStickerLayout(
  clip: Clip,
  time: number,
  W: number,
  H: number
): VisualLayout | null {
  if (!clip.sticker) return null;
  const t = evaluatedTransform(clip, time);
  const fx = evaluateTransitions(clip, time);
  const size = clip.sticker.size * t.scale * fx.scale;
  return {
    cx: W / 2 + t.x * W + fx.translateX * W,
    cy: H / 2 + t.y * H,
    w: size,
    h: size,
    rotation: (t.rotation * Math.PI) / 180,
    alpha: Math.max(0, Math.min(1, t.opacity * fx.alpha)),
    clipped: false,
  };
}

/** Drawing clips cover the whole canvas; their box is the canvas itself. */
export function computeDrawingLayout(clip: Clip, time: number, W: number, H: number): VisualLayout {
  const t = evaluatedTransform(clip, time);
  return {
    cx: W / 2 + t.x * W,
    cy: H / 2 + t.y * H,
    w: W * t.scale,
    h: H * t.scale,
    rotation: (t.rotation * Math.PI) / 180,
    alpha: t.opacity,
    clipped: false,
  };
}

/** Layout for any visual clip kind; null when the clip has no visual bounds. */
export function computeClipLayout(
  clip: Clip,
  time: number,
  W: number,
  H: number,
  sources: FrameSourceProvider | null
): VisualLayout | null {
  switch (clip.kind) {
    case "text":
      return computeTextLayout(clip, time, W, H);
    case "sticker":
      return computeStickerLayout(clip, time, W, H);
    case "drawing":
      return computeDrawingLayout(clip, time, W, H);
    case "video":
    case "image":
      return computeVisualLayout(clip, time, W, H, sources?.getSourceSize(clip) ?? null);
    default:
      return null;
  }
}

/** Point-in-layout hit test (canvas px coordinates). */
export function layoutContains(layout: VisualLayout, px: number, py: number, margin = 0): boolean {
  const dx = px - layout.cx;
  const dy = py - layout.cy;
  const cos = Math.cos(-layout.rotation);
  const sin = Math.sin(-layout.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= layout.w / 2 + margin && Math.abs(ly) <= layout.h / 2 + margin;
}

/** Visual clips active at `time`, topmost first (tracks[0] is the top layer). */
export function visualClipsAt(tracks: Track[], time: number, W: number, H: number, sources: FrameSourceProvider | null): { clip: Clip; track: Track; layout: VisualLayout }[] {
  const soloActive = tracks.some((t) => t.solo && t.kind !== "audio");
  const out: { clip: Clip; track: Track; layout: VisualLayout }[] = [];
  for (const track of tracks) {
    if (track.kind === "audio" || track.hidden) continue;
    if (soloActive && !track.solo) continue;
    for (const clip of track.clips) {
      if (time < clip.start || time >= clipEnd(clip)) continue;
      const layout = computeClipLayout(clip, time, W, H, sources);
      if (layout) out.push({ clip, track, layout });
    }
  }
  return out; // tracks iterate top→bottom already
}

/* ------------------------------------------------------------------ */
/* Clip painters                                                       */
/* ------------------------------------------------------------------ */

function drawTextClip(ctx: Ctx2D, clip: Clip, time: number, W: number, H: number): void {
  const text = clip.text;
  if (!text || !text.content) return;
  const anim = evaluateTextAnimation(clip, time);
  const t = evaluatedTransform(clip, time);
  const metrics = measureTextBlock(clip, time);
  if (!metrics) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * anim.alpha));
  const cx = W / 2 + t.x * W;
  const cy = H / 2 + t.y * H + anim.dy;
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale * anim.scale, t.scale * anim.scale);

  const fontSize = metrics.fontSize;
  ctx.font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spacing = text.letterSpacing ?? 0;
  const lineHeight = metrics.lineHeight;

  // Background chip behind the whole block.
  if (text.background && text.background !== "transparent") {
    const padX = fontSize * 0.4;
    const padY = fontSize * 0.25;
    const r = fontSize * 0.2;
    const bw = metrics.width + padX * 2;
    const bh = metrics.height + padY * 2;
    const bx = -bw / 2;
    const by = -bh / 2;
    ctx.fillStyle = text.background;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.fill();
  }

  if (text.shadowBlur > 0) {
    ctx.shadowColor = text.shadowColor;
    ctx.shadowBlur = text.shadowBlur;
    ctx.shadowOffsetY = text.shadowBlur * 0.35;
  }

  metrics.lines.forEach((line, i) => {
    const y = -metrics.height / 2 + lineHeight * (i + 0.5);
    const lineX =
      text.align === "left" ? -metrics.width / 2 : text.align === "right" ? metrics.width / 2 : 0;
    if (text.strokeWidth > 0) {
      ctx.lineWidth = text.strokeWidth;
      ctx.strokeStyle = text.strokeColor;
      ctx.lineJoin = "round";
      if (spacing === 0) ctx.strokeText(line, lineX, y);
      else {
        // Stroke per character so spacing applies to the outline too.
        const widths = [...line].map((ch) => ctx.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0) + spacing * (line.length - 1);
        let cursor = text.align === "left" ? lineX : text.align === "right" ? lineX - total : lineX - total / 2;
        [...line].forEach((ch, ci) => {
          ctx.strokeText(ch, cursor, y);
          cursor += (widths[ci] ?? 0) + spacing;
        });
      }
    }
    ctx.fillStyle = text.color;
    drawLine(ctx, line, lineX, y, spacing, text.align);
  });

  ctx.restore();
}

function drawVisualClip(
  ctx: Ctx2D,
  clip: Clip,
  time: number,
  W: number,
  H: number,
  sources: FrameSourceProvider
): void {
  const frame = sources.getFrame(clip);
  const size = sources.getSourceSize(clip);
  if (!frame || !size || size.width === 0 || size.height === 0) return;

  const t = evaluatedTransform(clip, time);
  const filters = evaluatedFilters(clip, time);
  const fx = evaluateTransitions(clip, time);
  if (fx.alpha <= 0.001) {
    if (fx.dip && fx.dip.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = fx.dip.alpha;
      ctx.fillStyle = fx.dip.color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return;
  }

  const crop = clip.crop;
  const sx = size.width * crop.left;
  const sy = size.height * crop.top;
  const sw = size.width * (1 - crop.left - crop.right);
  const sh = size.height * (1 - crop.top - crop.bottom);
  if (sw <= 0 || sh <= 0) return;

  const filterString = buildFilterString(filters);

  // Blurred cover-copy behind a contained frame (the classic vertical-video
  // "blurred background" look).
  if (t.backgroundBlur > 0 && t.fit === "contain") {
    const cover = Math.max(W / sw, H / sh);
    const bw = sw * cover;
    const bh = sh * cover;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * fx.alpha));
    try {
      ctx.filter = `blur(${Math.max(2, t.backgroundBlur * 60)}px) brightness(0.75)`;
    } catch {
      /* filter unsupported */
    }
    ctx.drawImage(frame, sx, sy, sw, sh, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh);
    ctx.filter = "none";
    ctx.restore();
  }

  const fitMode = t.fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const dw = sw * fitMode * t.scale * fx.scale;
  const dh = sh * fitMode * t.scale * fx.scale;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * fx.alpha));
  if (clip.blendMode !== "normal") {
    ctx.globalCompositeOperation = clip.blendMode as GlobalCompositeOperation;
  }

  if (fx.wipe !== null && fx.wipe < 1) {
    ctx.beginPath();
    ctx.rect(0, 0, W * fx.wipe, H);
    ctx.clip();
  } else if (t.fit === "cover") {
    // Keep the cover frame inside the canvas.
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
  }

  const cx = W / 2 + t.x * W + fx.translateX * W;
  const cy = H / 2 + t.y * H;
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);

  if (filterString !== "none" && "filter" in ctx) {
    ctx.filter = filterString;
  }
  ctx.drawImage(frame, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  if ("filter" in ctx) ctx.filter = "none";

  applyOverlayPasses(ctx, filters, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (fx.dip && fx.dip.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = fx.dip.alpha;
    ctx.fillStyle = fx.dip.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawStickerClip(ctx: Ctx2D, clip: Clip, time: number, W: number, H: number): void {
  if (!clip.sticker) return;
  const t = evaluatedTransform(clip, time);
  const fx = evaluateTransitions(clip, time);
  if (fx.alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * fx.alpha));
  if (clip.blendMode !== "normal") {
    ctx.globalCompositeOperation = clip.blendMode as GlobalCompositeOperation;
  }
  const cx = W / 2 + t.x * W + fx.translateX * W;
  const cy = H / 2 + t.y * H;
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  const s = t.scale * fx.scale;
  ctx.scale(s, s);
  drawSticker(ctx, clip.sticker, time);
  ctx.restore();
}

function drawDrawingClip(ctx: Ctx2D, clip: Clip, time: number, W: number, H: number): void {
  if (!clip.drawing || clip.drawing.strokes.length === 0) return;
  const t = evaluatedTransform(clip, time);
  const local = time - clip.start;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity));
  if (clip.blendMode !== "normal") {
    ctx.globalCompositeOperation = clip.blendMode as GlobalCompositeOperation;
  }
  ctx.translate(W / 2 + t.x * W, H / 2 + t.y * H);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale, t.scale);
  ctx.translate(-W / 2, -H / 2);
  drawDrawing(ctx, clip.drawing, local, W, H);
  ctx.restore();
}

export interface DrawOptions {
  /** Clips excluded from drawing (e.g. the clip being inline-edited in preview). */
  hiddenClipIds?: Set<string>;
}

/**
 * Draw one deterministic timeline frame. Track order defines stacking:
 * the last track in the array is the bottom layer, the first is topmost.
 * Used identically by the live preview and the export renderer.
 */
export function drawTimelineFrame(
  ctx: Ctx2D,
  tracks: Track[],
  time: number,
  settings: ProjectSettings,
  sources: FrameSourceProvider,
  options?: DrawOptions
): void {
  const W = settings.width;
  const H = settings.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, W, H);

  const soloActive = tracks.some((t) => t.solo && t.kind !== "audio");
  const hidden = options?.hiddenClipIds;

  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i]!;
    if (track.kind === "audio" || track.hidden) continue;
    if (soloActive && !track.solo) continue;

    for (const clip of track.clips) {
      if (time < clip.start || time >= clipEnd(clip)) continue;
      if (hidden?.has(clip.id)) continue;
      switch (clip.kind) {
        case "text":
          drawTextClip(ctx, clip, time, W, H);
          break;
        case "sticker":
          drawStickerClip(ctx, clip, time, W, H);
          break;
        case "drawing":
          drawDrawingClip(ctx, clip, time, W, H);
          break;
        case "video":
        case "image":
          drawVisualClip(ctx, clip, time, W, H, sources);
          break;
        default:
          break;
      }
    }
  }
  ctx.restore();
}
