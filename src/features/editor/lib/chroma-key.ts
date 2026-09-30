import type { Ctx2D } from "./canvas-compositor";
import type { ChromaKeySettings } from "../types/clip";

/**
 * CPU green-screen keyer with a resolution cap for realtime use.
 *
 * Pixels are compared against the key color in the YCbCr chroma plane (so
 * shadows and highlights key cleanly), alpha ramps with the similarity /
 * smoothness controls, and a spill pass desaturates the keyed hue from
 * semi-transparent edge pixels.
 */

const MAX_PROCESS_WIDTH = 1280;

export class ChromaKeyProcessor {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: Ctx2D | null = null;
  private key = { cb: 0, cr: 0, color: "" };

  private ensureCanvas(w: number, h: number): void {
    if (!this.canvas) {
      if (typeof OffscreenCanvas !== "undefined") {
        this.canvas = new OffscreenCanvas(w, h);
      } else {
        const el = document.createElement("canvas");
        el.width = w;
        el.height = h;
        this.canvas = el;
      }
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true }) as Ctx2D | null;
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private updateKey(color: string): void {
    if (this.key.color === color) return;
    const rgb = hexToRgb(color);
    // BT.601 chroma
    const cb = 128 - 0.168736 * rgb.r - 0.331264 * rgb.g + 0.5 * rgb.b;
    const cr = 128 + 0.5 * rgb.r - 0.418688 * rgb.g - 0.081312 * rgb.b;
    this.key = { cb, cr, color };
  }

  /**
   * Key `source` and return a canvas with transparency. The returned canvas is
   * reused between calls — consume it immediately (compositor draws it in the
   * same frame).
   */
  process(source: CanvasImageSource, settings: ChromaKeySettings, srcW: number, srcH: number): HTMLCanvasElement | OffscreenCanvas | null {
    if (srcW <= 0 || srcH <= 0) return null;
    const scale = Math.min(1, MAX_PROCESS_WIDTH / srcW);
    const w = Math.max(2, Math.round(srcW * scale));
    const h = Math.max(2, Math.round(srcH * scale));
    this.ensureCanvas(w, h);
    const ctx = this.ctx;
    if (!ctx) return null;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    let image: ImageData;
    try {
      image = ctx.getImageData(0, 0, w, h);
    } catch {
      return null; // tainted canvas (shouldn't happen — media is local blob URLs)
    }

    this.updateKey(settings.color);
    const data = image.data;
    const { cb, cr } = this.key;
    // similarity 0..1 → chroma radius 0..~120 (of max ~127)
    const radius = settings.similarity * 118;
    const soft = Math.max(1, settings.smoothness * 60);
    const spill = settings.spill;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const pcb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const pcr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const dist = Math.hypot(pcb - cb, pcr - cr);
      let alpha = data[i + 3]!;
      if (dist <= radius) {
        alpha = 0;
      } else if (dist < radius + soft) {
        alpha = Math.round(alpha * ((dist - radius) / soft));
      }
      if (alpha > 0 && alpha < 255 && spill > 0) {
        // Suppress the key hue on semi-transparent pixels.
        const edge = 1 - alpha / 255;
        const spillAmount = edge * spill;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = Math.round(r + (luma - r) * spillAmount);
        data[i + 1] = Math.round(g + (luma - g) * spillAmount);
        data[i + 2] = Math.round(b + (luma - b) * spillAmount);
      }
      data[i + 3] = alpha;
    }

    ctx.putImageData(image, 0, 0);
    return this.canvas;
  }
}

export function defaultChromaSettings(): ChromaKeySettings {
  return {
    enabled: false,
    color: "#00b140",
    similarity: 0.32,
    smoothness: 0.12,
    spill: 0.6,
  };
}

/** Common key colors offered as swatches. */
export const CHROMA_SWATCHES = [
  { id: "green", label: "Green", color: "#00b140" },
  { id: "darkgreen", label: "Dark green", color: "#004d25" },
  { id: "blue", label: "Blue", color: "#0047bb" },
  { id: "magenta", label: "Magenta", color: "#ff00ff" },
  { id: "black", label: "Black", color: "#000000" },
  { id: "white", label: "White", color: "#ffffff" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h || "00b140", 16);
  if (Number.isNaN(num)) return { r: 0, g: 177, b: 64 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
