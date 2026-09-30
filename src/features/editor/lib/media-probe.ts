import { createId } from "@/lib/utils";
import { ACCEPTED_MIME } from "@/config/limits";
import type { MediaAsset, MediaType } from "../types/media";

export function detectMediaType(file: File): MediaType | null {
  const mime = file.type;
  if ((ACCEPTED_MIME.video as readonly string[]).includes(mime) || mime.startsWith("video/")) return "video";
  if ((ACCEPTED_MIME.audio as readonly string[]).includes(mime) || mime.startsWith("audio/")) return "audio";
  if ((ACCEPTED_MIME.image as readonly string[]).includes(mime) || mime.startsWith("image/")) return "image";
  return null;
}

/** Probe duration / dimensions / audio presence with a throwaway media element. */
export async function probeMedia(file: File): Promise<MediaAsset | null> {
  const type = detectMediaType(file);
  if (!type) return null;

  const base: MediaAsset = {
    id: createId("media"),
    name: file.name,
    type,
    mime: file.type,
    size: file.size,
    duration: 0,
    createdAt: Date.now(),
  };

  const url = URL.createObjectURL(file);
  try {
    if (type === "image") {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.src = url;
      });
      return { ...base, width: dims.w, height: dims.h };
    }

    const el = document.createElement(type === "video" ? "video" : "audio") as HTMLVideoElement;
    el.preload = "metadata";
    el.muted = true;
    const meta = await new Promise<Partial<MediaAsset>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Metadata timeout")), 15000);
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        const result: Partial<MediaAsset> = {
          duration: Number.isFinite(el.duration) ? el.duration : 0,
        };
        if (type === "video") {
          result.width = el.videoWidth;
          result.height = el.videoHeight;
          const anyEl = el as HTMLVideoElement & {
            mozHasAudio?: boolean;
            webkitAudioDecodedByteCount?: number;
            audioTracks?: { length: number };
          };
          result.hasAudio =
            anyEl.mozHasAudio ||
            (anyEl.webkitAudioDecodedByteCount ?? 0) > 0 ||
            (anyEl.audioTracks?.length ?? 1) > 0;
        } else {
          result.hasAudio = true;
        }
        resolve(result);
      };
      el.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Failed to load media"));
      };
      el.src = url;
    });
    return { ...base, ...meta };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
