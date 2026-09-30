import type { TimelineState } from "./timeline";

export interface AspectRatioPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description?: string;
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  aspectId: string;
  background: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  timeline: TimelineState;
  /** Media asset ids referenced by this project. */
  mediaIds: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  clipCount: number;
  aspectId: string;
}
