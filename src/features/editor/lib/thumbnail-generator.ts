import { LIMITS } from "@/config/limits";
import type { MediaAsset } from "../types/media";

/**
 * Generate a filmstrip of JPEG thumbnails for a video or a single thumbnail
 * for an image by seeking a hidden element and drawing to a canvas.
 */
export async function generateThumbnails(asset: MediaAsset, blob: Blob): Promise<Blob[]> {
  const w = LIMITS.thumbnailWidth;
  const h = LIMITS.thumbnailHeight;
  const url = URL.createObjectURL(blob);

  try {
    if (asset.type === "image") {
      const img = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      drawCover(ctx, img, img.naturalWidth, img.naturalHeight, w, h);
      const out = await canvasToBlob(canvas);
      return out ? [out] : [];
    }

    if (asset.type !== "video" || asset.duration <= 0) return [];

    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    await eventOnce(video, "loadeddata");

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const samples = LIMITS.filmstripSamples;
    const thumbs: Blob[] = [];

    for (let i = 0; i < samples; i++) {
      const t = (asset.duration * (i + 0.5)) / samples;
      video.currentTime = Math.min(t, Math.max(0, asset.duration - 0.05));
      await eventOnce(video, "seeked", 4000).catch(() => undefined);
      drawCover(ctx, video, video.videoWidth, video.videoHeight, w, h);
      const out = await canvasToBlob(canvas);
      if (out) thumbs.push(out);
    }
    video.removeAttribute("src");
    video.load();
    return thumbs;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number
) {
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (dw - w) / 2, (dh - h) / 2, w, h);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
}

function eventOnce(el: HTMLElement, event: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), timeoutMs);
    el.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
