import type { ExportResult } from "../types/export";
import { loadFfmpeg } from "./wasm-loader";

/**
 * Optional ffmpeg.wasm remux/transcode path: takes the WebM produced by the
 * MediaRecorder pipeline and converts it to MP4/H.264 locally. Only used when
 * the ffmpeg.wasm core is present in public/ffmpeg/ (see README).
 */
export async function transcodeWebmToMp4(
  webm: Blob,
  fileName: string,
  onMessage?: (msg: string) => void
): Promise<ExportResult | null> {
  const ffmpeg = await loadFfmpeg();
  if (!ffmpeg) return null;

  onMessage?.("Transcoding to MP4 with ffmpeg.wasm");
  const data = new Uint8Array(await webm.arrayBuffer());
  const out = await ffmpeg.exec(
    ["-i", "input.webm", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "output.mp4"],
    [{ name: "input.webm", data }]
  );
  if (!out) return null;
  const buffer = new Uint8Array(out.length);
  buffer.set(out);
  return {
    blob: new Blob([buffer.buffer as ArrayBuffer], { type: "video/mp4" }),
    fileName: `${fileName}.mp4`,
    mime: "video/mp4",
  };
}
