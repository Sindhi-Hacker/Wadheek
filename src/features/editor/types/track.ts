import type { Clip } from "./clip";

export type TrackKind = "video" | "overlay" | "text" | "audio";

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  hidden: boolean;
  clips: Clip[];
}
