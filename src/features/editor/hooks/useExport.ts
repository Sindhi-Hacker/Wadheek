import * as React from "react";
import { COPY } from "@/config/copy";
import { showAlert } from "@/components/common/dialog-service";
import { download } from "@/lib/utils";
import { useMediaStore } from "@/features/media/media-store";
import type { ExportProgress, ExportSettings } from "../types/export";
import { renderWithMediaRecorder } from "../lib/exporter-mediarecorder";
import { transcodeWebmToMp4 } from "../lib/exporter-ffmpeg";
import { isFfmpegAvailable } from "../lib/wasm-loader";
import { pickSupportedMime } from "../lib/exporter-mediarecorder";
import { useEditorStore } from "./useEditorStore";

const IDLE: ExportProgress = {
  phase: "idle",
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  etaSeconds: null,
};

/** Orchestrates the export pipeline with progress, cancel and download. */
export function useExport() {
  const [progress, setProgress] = React.useState<ExportProgress>(IDLE);
  const abortRef = React.useRef<AbortController | null>(null);
  const [ffmpegReady, setFfmpegReady] = React.useState(false);

  React.useEffect(() => {
    void isFfmpegAvailable().then(setFfmpegReady);
  }, []);

  const mp4Native = React.useMemo(() => pickSupportedMime("mp4") !== null, []);

  const start = React.useCallback(
    async (settings: ExportSettings) => {
      const state = useEditorStore.getState();
      const assets = useMediaStore
        .getState()
        .assets.filter((a) => state.mediaIds.includes(a.id));

      const controller = new AbortController();
      abortRef.current = controller;
      state.setPlaying(false);

      try {
        let effectiveFormat = settings.formatId;
        let viaFfmpeg = false;
        if (settings.formatId === "mp4" && !mp4Native) {
          if (ffmpegReady) {
            effectiveFormat = "webm";
            viaFfmpeg = true;
          } else {
            await showAlert({
              variant: "warning",
              title: COPY.dialogs.mp4FallbackTitle,
              description: COPY.export.ffmpegUnavailable,
            });
            effectiveFormat = "webm";
          }
        }

        const result = await renderWithMediaRecorder({
          tracks: state.tracks,
          assets,
          settings: state.settings,
          exportSettings: { ...settings, formatId: effectiveFormat },
          inPoint: state.inPoint,
          outPoint: state.outPoint,
          onProgress: setProgress,
          signal: controller.signal,
        });

        let final = result;
        if (viaFfmpeg) {
          setProgress((p) => ({ ...p, phase: "encoding", etaSeconds: null }));
          const mp4 = await transcodeWebmToMp4(result.blob, settings.fileName);
          if (mp4) final = mp4;
        }

        download(final.blob, final.fileName);
        setProgress((p) => ({ ...p, phase: "done", progress: 1 }));
        void showAlert({
          variant: "success",
          title: COPY.dialogs.exportCompleteTitle,
          description: COPY.dialogs.exportCompleteBody(final.fileName),
        });
        return final;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setProgress({ ...IDLE, phase: "canceled" });
          void showAlert({
            variant: "info",
            title: COPY.dialogs.exportCanceledTitle,
            description: COPY.dialogs.exportCanceledBody,
          });
        } else {
          setProgress({
            ...IDLE,
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          });
          void showAlert({
            variant: "error",
            title: COPY.dialogs.exportFailedTitle,
            description:
              err instanceof Error && err.message ? err.message : COPY.dialogs.exportFailedBody,
          });
        }
        return null;
      } finally {
        abortRef.current = null;
      }
    },
    [ffmpegReady, mp4Native]
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = React.useCallback(() => setProgress(IDLE), []);

  const busy = progress.phase === "preparing" || progress.phase === "rendering" || progress.phase === "encoding";

  return { progress, start, cancel, reset, busy, ffmpegReady, mp4Native };
}
