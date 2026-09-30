export interface ExportResolutionPreset {
  id: string;
  label: string;
  /** Scale relative to project resolution. */
  scale: number;
}

export const EXPORT_RESOLUTIONS: ExportResolutionPreset[] = [
  { id: "full", label: "Full (project size)", scale: 1 },
  { id: "half", label: "Half", scale: 0.5 },
  { id: "quarter", label: "Quarter", scale: 0.25 },
];

export const EXPORT_QUALITIES = [
  { id: "high", label: "High", bitrateFactor: 0.24 },
  { id: "medium", label: "Medium", bitrateFactor: 0.14 },
  { id: "low", label: "Low", bitrateFactor: 0.07 },
] as const;

export const EXPORT_FORMATS = [
  {
    id: "webm",
    label: "WebM (VP9/VP8 + Opus)",
    mimeCandidates: [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ],
    extension: "webm",
    engine: "mediarecorder" as const,
  },
  {
    id: "mp4",
    label: "MP4 (H.264 + AAC)",
    mimeCandidates: ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"],
    extension: "mp4",
    engine: "mediarecorder-or-ffmpeg" as const,
  },
] as const;

export const EXPORT_FPS_OPTIONS = [24, 25, 30, 50, 60] as const;

export const EXPORT_DEFAULTS = {
  formatId: "webm",
  resolutionId: "full",
  qualityId: "high",
  fps: 30,
  range: "all" as "all" | "inout",
  fileName: "wadheek-export",
} as const;
