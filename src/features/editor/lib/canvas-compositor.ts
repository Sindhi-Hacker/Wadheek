import type { Clip } from "../types/clip";
import type { Track } from "../types/track";
import type { ProjectSettings } from "../types/project";
import { clipEnd } from "./timeline-math";
import { buildFilterString, applyOverlayPasses } from "./webgl-filters";
import { TRANSITIONS } from "@/config/defaults";

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

function drawTextClip(ctx: Ctx2D, clip: Clip, time: number, W: number, H: number): void {
  const text = clip.text;
  if (!text || !text.content) return;
  const anim = evaluateTextAnimation(clip, time);
  const t = clip.transform;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * anim.alpha));
  const cx = W / 2 + t.x * W;
  const cy = H / 2 + t.y * H + anim.dy;
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scale * anim.scale, t.scale * anim.scale);

  const fontSize = text.fontSize;
  ctx.font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
  ctx.textAlign = text.align;
  ctx.textBaseline = "middle";

  const lines = text.content.split("\n");
  const lineHeight = fontSize * 1.2;
  const blockHeight = lines.length * lineHeight;
  const alignX = text.align === "left" ? -W * 0.4 : text.align === "right" ? W * 0.4 : 0;

  // Background chip
  if (text.background && text.background !== "transparent") {
    let maxWidth = 0;
    for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    const padX = fontSize * 0.4;
    const padY = fontSize * 0.25;
    const bgX =
      text.align === "left" ? alignX - padX : text.align === "right" ? alignX - maxWidth - padX : -maxWidth / 2 - padX;
    ctx.fillStyle = text.background;
    ctx.beginPath();
    const r = fontSize * 0.2;
    const bw = maxWidth + padX * 2;
    const bh = blockHeight + padY * 2;
    const by = -blockHeight / 2 - padY;
    ctx.moveTo(bgX + r, by);
    ctx.arcTo(bgX + bw, by, bgX + bw, by + bh, r);
    ctx.arcTo(bgX + bw, by + bh, bgX, by + bh, r);
    ctx.arcTo(bgX, by + bh, bgX, by, r);
    ctx.arcTo(bgX, by, bgX + bw, by, r);
    ctx.fill();
  }

  if (text.shadowBlur > 0) {
    ctx.shadowColor = text.shadowColor;
    ctx.shadowBlur = text.shadowBlur;
    ctx.shadowOffsetY = text.shadowBlur * 0.35;
  }

  lines.forEach((line, i) => {
    const y = -blockHeight / 2 + lineHeight * (i + 0.5);
    if (text.strokeWidth > 0) {
      ctx.lineWidth = text.strokeWidth;
      ctx.strokeStyle = text.strokeColor;
      ctx.lineJoin = "round";
      ctx.strokeText(line, alignX, y);
    }
    ctx.fillStyle = text.color;
    ctx.fillText(line, alignX, y);
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

  const t = clip.transform;
  const crop = clip.crop;
  const sx = size.width * crop.left;
  const sy = size.height * crop.top;
  const sw = size.width * (1 - crop.left - crop.right);
  const sh = size.height * (1 - crop.top - crop.bottom);
  if (sw <= 0 || sh <= 0) return;

  // Contain-fit the cropped source into the canvas, then apply user transform.
  const fit = Math.min(W / sw, H / sh);
  const dw = sw * fit * t.scale * fx.scale;
  const dh = sh * fit * t.scale * fx.scale;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity * fx.alpha));
  if (clip.blendMode !== "normal") {
    ctx.globalCompositeOperation = clip.blendMode as GlobalCompositeOperation;
  }

  if (fx.wipe !== null && fx.wipe < 1) {
    ctx.beginPath();
    ctx.rect(0, 0, W * fx.wipe, H);
    ctx.clip();
  }

  const cx = W / 2 + t.x * W + fx.translateX * W;
  const cy = H / 2 + t.y * H;
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);

  const filterString = buildFilterString(clip.filters);
  if (filterString !== "none" && "filter" in ctx) {
    ctx.filter = filterString;
  }
  ctx.drawImage(frame, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  if ("filter" in ctx) ctx.filter = "none";

  applyOverlayPasses(ctx, clip.filters, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (fx.dip && fx.dip.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = fx.dip.alpha;
    ctx.fillStyle = fx.dip.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
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
  sources: FrameSourceProvider
): void {
  const W = settings.width;
  const H = settings.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, W, H);

  const soloActive = tracks.some((t) => t.solo && t.kind !== "audio");

  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i]!;
    if (track.kind === "audio" || track.hidden) continue;
    if (soloActive && !track.solo) continue;

    for (const clip of track.clips) {
      if (time < clip.start || time >= clipEnd(clip)) continue;
      if (clip.kind === "text") {
        drawTextClip(ctx, clip, time, W, H);
      } else if (clip.kind === "video" || clip.kind === "image") {
        drawVisualClip(ctx, clip, time, W, H, sources);
      }
    }
  }
  ctx.restore();
}
