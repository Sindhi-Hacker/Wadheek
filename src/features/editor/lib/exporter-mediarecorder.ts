import type { Track } from "../types/track";
import type { MediaAsset } from "../types/media";
import type { ProjectSettings } from "../types/project";
import type { ExportProgress, ExportResult, ExportSettings } from "../types/export";
import { drawTimelineFrame } from "./canvas-compositor";
import { PlaybackEngine } from "./playback-engine";
import { AudioGraph } from "./audio-graph";
import { timelineDuration } from "./timeline-math";
import { EXPORT_FORMATS, EXPORT_QUALITIES, EXPORT_RESOLUTIONS } from "@/config/export-presets";

export interface RenderJobInput {
  tracks: Track[];
  assets: MediaAsset[];
  settings: ProjectSettings;
  exportSettings: ExportSettings;
  inPoint: number | null;
  outPoint: number | null;
  onProgress: (p: ExportProgress) => void;
  signal: AbortSignal;
}

export function pickSupportedMime(formatId: string): string | null {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId);
  if (!format || typeof MediaRecorder === "undefined") return null;
  for (const mime of format.mimeCandidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/**
 * Real export pipeline (default path).
 *
 * The timeline is rendered through the exact same compositor as the preview:
 * a dedicated PlaybackEngine drives hidden media elements against a canvas at
 * the requested resolution, audio is mixed through a Web Audio graph into a
 * MediaStreamAudioDestinationNode, and MediaRecorder encodes video + audio
 * into WebM (or MP4 where the browser's MediaRecorder supports it).
 */
export async function renderWithMediaRecorder(job: RenderJobInput): Promise<ExportResult> {
  const { tracks, assets, settings, exportSettings, onProgress, signal } = job;

  const resolution = EXPORT_RESOLUTIONS.find((r) => r.id === exportSettings.resolutionId) ?? EXPORT_RESOLUTIONS[0]!;
  const quality = EXPORT_QUALITIES.find((q) => q.id === exportSettings.qualityId) ?? EXPORT_QUALITIES[0];
  const format = EXPORT_FORMATS.find((f) => f.id === exportSettings.formatId) ?? EXPORT_FORMATS[0];
  const mime = pickSupportedMime(format.id) ?? pickSupportedMime("webm");
  if (!mime) throw new Error("This browser does not support MediaRecorder video encoding.");

  const width = Math.round((settings.width * resolution.scale) / 2) * 2;
  const height = Math.round((settings.height * resolution.scale) / 2) * 2;
  const fps = exportSettings.fps;

  const fullDuration = timelineDuration(tracks);
  let rangeStart = 0;
  let rangeEnd = fullDuration;
  if (exportSettings.range === "inout") {
    if (job.inPoint !== null) rangeStart = job.inPoint;
    if (job.outPoint !== null) rangeEnd = Math.min(job.outPoint, fullDuration);
  }
  const duration = Math.max(0.1, rangeEnd - rangeStart);
  const totalFrames = Math.ceil(duration * fps);

  onProgress({ phase: "preparing", progress: 0, currentFrame: 0, totalFrames, etaSeconds: null });

  // Render surface + dedicated engine (never touches the preview's elements).
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  const audioGraph = new AudioGraph();
  const audioDestination = audioGraph.routeToStream();
  const engine = new PlaybackEngine(undefined, audioGraph);
  await engine.prepare(assets);
  await engine.resumeAudio();

  const renderSettings: ProjectSettings = { ...settings, width, height };
  const videoStream = canvas.captureStream(fps);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);

  const bitrate = Math.round(width * height * fps * quality.bitrateFactor);
  const recorder = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: bitrate,
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const startedAt = performance.now();

  const result = await new Promise<ExportResult>((resolve, reject) => {
    let stopped = false;
    let raf = 0;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      engine.pauseAll();
      engine.dispose();
      combined.getTracks().forEach((t) => t.stop());
    };

    const finish = () => {
      if (stopped) return;
      stopped = true;
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        resolve({
          blob,
          fileName: `${exportSettings.fileName}.${mime.includes("mp4") ? "mp4" : "webm"}`,
          mime: mime.split(";")[0]!,
        });
      };
      if (recorder.state !== "inactive") recorder.stop();
    };

    const fail = (err: Error) => {
      if (stopped) return;
      stopped = true;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      cleanup();
      reject(err);
    };

    signal.addEventListener("abort", () => fail(new DOMException("Export canceled", "AbortError")));
    recorder.onerror = () => fail(new Error("Encoder error"));

    recorder.start(500);
    const wallStart = performance.now();

    const tick = () => {
      if (stopped) return;
      const elapsed = (performance.now() - wallStart) / 1000;
      const time = rangeStart + elapsed;

      if (time >= rangeEnd) {
        // Draw the final frame, then stop.
        drawTimelineFrame(ctx, tracks, rangeEnd - 1 / fps, renderSettings, engine);
        finish();
        return;
      }

      engine.sync(tracks, time, true);
      drawTimelineFrame(ctx, tracks, time, renderSettings, engine);

      const currentFrame = Math.min(totalFrames, Math.floor(elapsed * fps));
      const progress = Math.min(1, elapsed / duration);
      const wallElapsed = (performance.now() - startedAt) / 1000;
      const eta = progress > 0.02 ? (wallElapsed / progress) * (1 - progress) : null;
      job.onProgress({
        phase: "rendering",
        progress,
        currentFrame,
        totalFrames,
        etaSeconds: eta,
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  });

  onProgress({ phase: "done", progress: 1, currentFrame: totalFrames, totalFrames, etaSeconds: 0 });
  return result;
}
