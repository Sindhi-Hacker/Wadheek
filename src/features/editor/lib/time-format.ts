/** Format seconds as HH:MM:SS or MM:SS. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Format seconds as a frame-accurate timecode HH:MM:SS:FF. */
export function formatTimecode(seconds: number, fps: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalFrames = Math.round(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
}

/** Parse a HH:MM:SS:FF (or shorter) timecode back to seconds. */
export function parseTimecode(value: string, fps: number): number | null {
  const parts = value
    .split(/[:;.]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(Number);
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  let h = 0, m = 0, s = 0, f = 0;
  if (parts.length === 4) [h, m, s, f] = parts as [number, number, number, number];
  else if (parts.length === 3) [m, s, f] = parts as [number, number, number];
  else if (parts.length === 2) [s, f] = parts as [number, number];
  else [s] = parts as [number];
  return h * 3600 + m * 60 + s + f / fps;
}

/** Ruler label such as 1:23 or 0:05.5 depending on tick step. */
export function formatRulerLabel(seconds: number, step: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (step >= 1) return `${m}:${Math.round(s).toString().padStart(2, "0")}`;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
