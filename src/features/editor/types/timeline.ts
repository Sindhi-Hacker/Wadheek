import type { Track } from "./track";

export interface Marker {
  id: string;
  time: number;
  name: string;
}

export interface TimelineState {
  tracks: Track[];
  markers: Marker[];
  inPoint: number | null;
  outPoint: number | null;
}
