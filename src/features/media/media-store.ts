import { create } from "zustand";
import type { MediaAsset } from "@/features/editor/types/media";
import {
  loadMediaIndex,
  saveMediaIndex,
  saveThumbnails,
  saveWaveform,
  deleteDerived,
} from "@/features/editor/lib/idb-storage";
import { deleteBlob, revokeMediaUrl, saveBlob } from "@/features/editor/lib/opfs-storage";
import { probeMedia } from "@/features/editor/lib/media-probe";
import { generateThumbnails } from "@/features/editor/lib/thumbnail-generator";
import { extractWaveform } from "@/features/editor/lib/waveform-extractor";
import { LIMITS } from "@/config/limits";

export interface ImportFailure {
  name: string;
  reason: "unsupported" | "too-large" | "error";
}

interface MediaState {
  assets: MediaAsset[];
  loaded: boolean;
  importing: boolean;
  hydrate: () => Promise<void>;
  importFiles: (files: File[]) => Promise<{ imported: MediaAsset[]; failed: ImportFailure[] }>;
  removeAsset: (id: string) => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  assets: [],
  loaded: false,
  importing: false,

  hydrate: async () => {
    if (get().loaded) return;
    const assets = await loadMediaIndex();
    set({ assets, loaded: true });
  },

  importFiles: async (files) => {
    set({ importing: true });
    const imported: MediaAsset[] = [];
    const failed: ImportFailure[] = [];

    try {
      for (const file of files) {
        if (file.size > LIMITS.maxMediaFileBytes) {
          failed.push({ name: file.name, reason: "too-large" });
          continue;
        }
        const asset = await probeMedia(file);
        if (!asset) {
          failed.push({ name: file.name, reason: "unsupported" });
          continue;
        }
        try {
          await saveBlob(asset.id, file);
          imported.push(asset);
          // Fire-and-forget derived data; UI streams in as it completes.
          void (async () => {
            const thumbs = await generateThumbnails(asset, file);
            if (thumbs.length > 0) await saveThumbnails(asset.id, thumbs);
            if (asset.type !== "image") {
              const peaks = await extractWaveform(file);
              if (peaks) await saveWaveform(asset.id, peaks);
            }
            // Nudge subscribers that derived data landed.
            set((s) => ({ assets: [...s.assets] }));
          })();
        } catch {
          failed.push({ name: file.name, reason: "error" });
        }
      }

      if (imported.length > 0) {
        const assets = [...get().assets, ...imported];
        set({ assets });
        await saveMediaIndex(assets);
      }
      return { imported, failed };
    } finally {
      set({ importing: false });
    }
  },

  removeAsset: async (id) => {
    const assets = get().assets.filter((a) => a.id !== id);
    set({ assets });
    await saveMediaIndex(assets);
    revokeMediaUrl(id);
    await Promise.all([deleteBlob(id), deleteDerived(id)]);
  },
}));

export function getAsset(id: string | undefined): MediaAsset | undefined {
  if (!id) return undefined;
  return useMediaStore.getState().assets.find((a) => a.id === id);
}
