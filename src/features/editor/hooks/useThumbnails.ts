import { useQuery } from "@tanstack/react-query";
import { loadThumbnails } from "../lib/idb-storage";

/**
 * Session-scoped object-URL cache: thumbnails are shared by the media panel
 * and every clip via TanStack Query, so URLs must outlive any one consumer.
 */
const urlCache = new Map<string, string[]>();

/** Filmstrip thumbnails for a media asset as object URLs (cached via TanStack Query). */
export function useThumbnails(mediaId: string | undefined) {
  const query = useQuery({
    queryKey: ["thumbnails", mediaId],
    enabled: !!mediaId,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const cached = urlCache.get(mediaId!);
      if (cached && cached.length > 0) return cached;
      const blobs = (await loadThumbnails(mediaId!)) ?? [];
      if (blobs.length === 0) throw new Error("thumbnails not ready yet");
      const urls = blobs.map((b) => URL.createObjectURL(b));
      urlCache.set(mediaId!, urls);
      return urls;
    },
    retry: 4,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });

  return { thumbnails: query.data ?? [], isLoading: query.isLoading };
}
