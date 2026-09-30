export type MediaType = "video" | "audio" | "image";

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  mime: string;
  size: number;
  /** Seconds; images report 0 (their timeline duration is configurable). */
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  hasAudio?: boolean;
  createdAt: number;
}
