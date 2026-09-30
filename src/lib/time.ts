/** Time + timecode helpers used across the editor. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** SMPTE-style timecode HH:MM:SS:FF at the given frame rate. */
export function formatTimecode(seconds: number, fps: number): string {
  const f = Math.max(0, fps);
  const total = Math.max(0, seconds);
  const wholeFps = Math.max(1, Math.round(f));
  const frames = Math.floor((total - Math.floor(total)) * wholeFps + 1e-6);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ff = Math.min(frames, wholeFps - 1);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad2(ff)}`;
}

/** Short duration label for dashboards, e.g. 1:24 or 12:05. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad2(s)}`;
}

/** Relative "time ago" label. */
export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  if (diff < min) return 'just now';
  if (diff < 60 * min) return `${Math.round(diff / min)}m ago`;
  if (diff < 24 * 60 * min) return `${Math.round(diff / (60 * min))}h ago`;
  if (diff < 7 * 24 * 60 * min) return `${Math.round(diff / (24 * 60 * min))}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Quantize seconds to the nearest frame boundary. */
export function snapToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps) / fps;
}

/** Nice ruler step candidates in seconds. */
export const RULER_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 3600];

/** Pick a ruler step that keeps labels ~minLabelPx apart. */
export function pickRulerStep(pps: number, minLabelPx = 84): number {
  for (const step of RULER_STEPS) {
    if (step * pps >= minLabelPx) return step;
  }
  return RULER_STEPS[RULER_STEPS.length - 1];
}
