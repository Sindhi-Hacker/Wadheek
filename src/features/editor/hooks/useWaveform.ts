import { useQuery } from "@tanstack/react-query";
import { loadWaveform } from "../lib/idb-storage";

/** Normalized waveform peaks for a media asset (cached via TanStack Query). */
export function useWaveform(mediaId: string | undefined) {
  const query = useQuery({
    queryKey: ["waveform", mediaId],
    enabled: !!mediaId,
    staleTime: Infinity,
    retry: 2,
    retryDelay: 1500,
    queryFn: async () => (await loadWaveform(mediaId!)) ?? null,
  });
  return { peaks: query.data ?? null, isLoading: query.isLoading };
}
