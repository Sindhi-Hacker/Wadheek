import type { ClipFilters } from "../types/clip";

/**
 * Filter pipeline helpers.
 *
 * The primary path uses the GPU-accelerated CanvasRenderingContext2D.filter
 * string (brightness/contrast/saturate/hue-rotate/blur/grayscale/sepia/invert),
 * which browsers execute on the compositor thread. Values that CSS filters
 * cannot express (temperature, tint, vignette, sharpen) are applied as
 * blend-mode overlay passes in `applyOverlayPasses`.
 */

export function buildFilterString(f: ClipFilters): string {
  const parts: string[] = [];
  // Exposure folds into brightness: 1 stop = 2x light.
  const exposureGain = Math.pow(2, f.exposure);
  // Gamma approximation via brightness bias (cheap, monotonic).
  const gammaGain = Math.pow(1 / Math.max(0.2, f.gamma), 0.6);
  const brightness = f.brightness * exposureGain * gammaGain;

  if (brightness !== 1) parts.push(`brightness(${clampNum(brightness, 0, 6)})`);
  if (f.contrast !== 1) parts.push(`contrast(${clampNum(f.contrast, 0, 4)})`);
  const saturation = f.saturation + f.sharpen * 0.08;
  if (saturation !== 1) parts.push(`saturate(${clampNum(saturation, 0, 4)})`);
  if (f.hue !== 0) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur > 0) parts.push(`blur(${f.blur}px)`);
  if (f.grayscale > 0) parts.push(`grayscale(${clampNum(f.grayscale, 0, 1)})`);
  if (f.sepia > 0) parts.push(`sepia(${clampNum(f.sepia, 0, 1)})`);
  if (f.invert > 0) parts.push(`invert(${clampNum(f.invert, 0, 1)})`);
  // Sharpen approximation: slight local contrast lift.
  if (f.sharpen > 0) parts.push(`contrast(${1 + f.sharpen * 0.25})`);

  return parts.length > 0 ? parts.join(" ") : "none";
}

/**
 * Temperature / tint / vignette passes drawn over the clip's bounding box.
 * Called after the source has been drawn with the CSS filter string applied.
 */
export function applyOverlayPasses(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  f: ClipFilters,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (f.temperature !== 0) {
    const amount = Math.abs(f.temperature) / 100;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = amount * 0.55;
    ctx.fillStyle = f.temperature > 0 ? "rgb(255,138,42)" : "rgb(42,138,255)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if (f.tint !== 0) {
    const amount = Math.abs(f.tint) / 100;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = amount * 0.5;
    ctx.fillStyle = f.tint > 0 ? "rgb(255,64,220)" : "rgb(64,255,120)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if (f.vignette > 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const outer = Math.hypot(w, h) / 2;
    const gradient = ctx.createRadialGradient(cx, cy, outer * (1 - f.vignette * 0.75), cx, cy, outer);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${0.85 * f.vignette})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
