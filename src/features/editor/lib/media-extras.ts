import { toast } from "sonner";
import { useMediaStore } from "@/features/media/media-store";

/**
 * Curated, CORS-friendly sample media so new users can try the editor before
 * importing their own footage. Everything streams from public CDNs and is
 * processed locally like any other import.
 */
export interface StockItem {
  id: string;
  label: string;
  kind: "video" | "image";
  url: string;
  duration?: number;
  credit: string;
}

export const STOCK_LIBRARY: StockItem[] = [
  {
    id: "bbb-720",
    label: "Big Buck Bunny · 10s",
    kind: "video",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4",
    duration: 10,
    credit: "Blender Foundation (CC-BY)",
  },
  {
    id: "bbb-1080",
    label: "Big Buck Bunny · 1080p",
    kind: "video",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_5MB.mp4",
    duration: 10,
    credit: "Blender Foundation (CC-BY)",
  },
  {
    id: "jellyfish",
    label: "Jellyfish · 1080p",
    kind: "video",
    url: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/1080/Jellyfish_1080_10s_5MB.mp4",
    duration: 10,
    credit: "Blender Foundation (CC-BY)",
  },
  {
    id: "sintel-720",
    label: "Sintel teaser · 720p",
    kind: "video",
    url: "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4",
    duration: 10,
    credit: "Blender Foundation (CC-BY)",
  },
  {
    id: "blazes",
    label: "For Bigger Blazes · 15s",
    kind: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15,
    credit: "Google sample media",
  },
  {
    id: "escapes",
    label: "For Bigger Escapes · 15s",
    kind: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration: 15,
    credit: "Google sample media",
  },
  {
    id: "joyrides",
    label: "For Bigger Joyrides · 15s",
    kind: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    duration: 15,
    credit: "Google sample media",
  },
  {
    id: "fun",
    label: "For Bigger Fun · 60s",
    kind: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    duration: 60,
    credit: "Google sample media",
  },
  {
    id: "img-forest",
    label: "Forest",
    kind: "image",
    url: "https://picsum.photos/seed/wadheek-forest/1920/1080",
    credit: "picsum.photos",
  },
  {
    id: "img-city",
    label: "City",
    kind: "image",
    url: "https://picsum.photos/seed/wadheek-city/1920/1080",
    credit: "picsum.photos",
  },
  {
    id: "img-mountain",
    label: "Mountains",
    kind: "image",
    url: "https://picsum.photos/seed/wadheek-mount/1920/1080",
    credit: "picsum.photos",
  },
  {
    id: "img-beach",
    label: "Beach",
    kind: "image",
    url: "https://picsum.photos/seed/wadheek-beach/1920/1080",
    credit: "picsum.photos",
  },
];

/** Fetch + import a stock item through the normal (local) pipeline. */
export async function importStockItem(item: StockItem): Promise<boolean> {
  try {
    const res = await fetch(item.url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = item.kind === "video" ? "mp4" : "jpg";
    const mime = item.kind === "video" ? "video/mp4" : "image/jpeg";
    const file = new File([blob], `${item.id}.${ext}`, { type: mime });
    const { imported, failed } = await useMediaStore.getState().importFiles([file]);
    if (imported.length > 0) {
      toast.success(`${item.label} added to your media`);
      return true;
    }
    throw new Error(failed[0]?.reason ?? "import failed");
  } catch (err) {
    toast.error(`Could not download “${item.label}” — check your connection and try again.`, {
      description: err instanceof Error ? err.message : undefined,
    });
    return false;
  }
}

/**
 * Create a solid-color image asset (title cards, background plates, color
 * flashes) without any network access.
 */
export async function importSolidColor(color: string, w = 1920, h = 1080): Promise<boolean> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) return false;
  const file = new File([blob], `color_${color.replace("#", "")}.png`, { type: "image/png" });
  const { imported } = await useMediaStore.getState().importFiles([file]);
  if (imported.length === 0) {
    toast.error("Could not create the color clip.");
    return false;
  }
  toast.success("Color clip added — drag it onto the timeline");
  return true;
}
