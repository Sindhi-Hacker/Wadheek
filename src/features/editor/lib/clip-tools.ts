import { toast } from "sonner";
import { TIMELINE_DEFAULTS } from "@/config/defaults";
import { useMediaStore } from "@/features/media/media-store";
import { getPreviewEngine } from "./engine-registry";
import { drawTimelineFrame } from "./canvas-compositor";
import { useEditorStore } from "../hooks/useEditorStore";
import type { Clip } from "../types/clip";
import type { Track } from "../types/track";

export function findClipAndTrack(clipId: string): { clip: Clip; track: Track } | null {
  for (const track of useEditorStore.getState().tracks) {
    for (const clip of track.clips) {
      if (clip.id === clipId) return { clip, track };
    }
  }
  return null;
}

/**
 * Freeze frame: captures the exact frame under the playhead of a video clip,
 * imports it as an image asset and splices it between the clip halves —
 * the classic "hold this moment" edit, fully local.
 */
export async function addFreezeFrame(clipId: string): Promise<void> {
  const store = useEditorStore.getState();
  const found = findClipAndTrack(clipId);
  if (!found || found.clip.kind !== "video" || !found.clip.mediaId) {
    toast("Select a video clip first — freeze frames need video.");
    return;
  }
  const { clip, track } = found;
  const engine = getPreviewEngine();
  const frame = engine?.getFrame(clip);
  const size = engine?.getSourceSize(clip);
  if (!frame || !size || size.width === 0) {
    toast("The video frame isn't ready yet — give it a second and try again.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(frame, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) {
    toast("Could not capture this frame.");
    return;
  }

  const fileName = `freeze_${clip.label.replace(/\.[^.]+$/, "")}_${Math.round(store.currentTime * 1000)}ms.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  const { imported, failed } = await useMediaStore.getState().importFiles([file]);
  const asset = imported[0];
  if (!asset) {
    toast(`Freeze frame import failed${failed[0] ? `: ${failed[0].reason}` : ""}.`);
    return;
  }

  const freezeDur = TIMELINE_DEFAULTS.defaultFreezeDuration;
  const at = store.currentTime;
  const inside = at > clip.start + 0.02 && at < clip.start + clip.duration - 0.02;

  let rightHalfId: string | null = null;
  if (inside) {
    store.splitAtTime(at);
    const after = findClipAndTrack(clipId); // refresh post-split
    if (after) {
      const right = after.track.clips.find(
        (c) => c.kind === "video" && c.mediaId === clip.mediaId && Math.abs(c.start - at) < 0.001 && c.id !== clip.id
      );
      rightHalfId = right?.id ?? null;
    }
  }

  const tailStart = inside ? at : clip.start + clip.duration;
  const newId = store.addClipFromMedia(asset, { trackId: track.id, time: tailStart });
  if (!newId) {
    toast("Could not place the freeze frame.");
    return;
  }
  // Re-position precisely: freeze sits between the halves.
  store.updateClip(newId, (c) => ({ ...c, start: tailStart, duration: freezeDur }));
  if (rightHalfId) {
    store.updateClip(rightHalfId, (c) => ({ ...c, start: tailStart + freezeDur }));
  }
  store.select([newId]);
  store.setCurrentTime(tailStart + freezeDur / 2);
  toast.success(`Freeze frame added (${freezeDur}s) — trim it like any clip`);
}

/** Export the current preview frame as a PNG download. */
export async function exportCurrentFrame(): Promise<void> {
  const engine = getPreviewEngine();
  const store = useEditorStore.getState();
  // Draw a fresh frame through the shared compositor at project resolution.
  const canvas = document.createElement("canvas");
  canvas.width = store.settings.width;
  canvas.height = store.settings.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || !engine) {
    toast("Preview not ready — try again in a moment.");
    return;
  }
  await engine.settleSeeks();
  drawTimelineFrame(ctx, store.tracks, store.currentTime, store.settings, engine);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) {
    toast("Could not export this frame.");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const t = Math.round(store.currentTime * 1000);
  a.download = `${store.projectName || "frame"}_${t}ms.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast.success("Frame exported as PNG");
}
