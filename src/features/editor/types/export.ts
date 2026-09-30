export interface ExportSettings {
  fileName: string;
  formatId: string;
  resolutionId: string;
  qualityId: string;
  fps: number;
  range: "all" | "inout";
}

export interface ExportProgress {
  phase: "idle" | "preparing" | "rendering" | "encoding" | "done" | "error" | "canceled";
  progress: number; // 0..1
  currentFrame: number;
  totalFrames: number;
  etaSeconds: number | null;
  message?: string;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  mime: string;
}
