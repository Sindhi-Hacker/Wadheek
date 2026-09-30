import { createId } from "@/lib/utils";
import type { Clip, Keyframe } from "../types/clip";
import { clipEnd } from "./timeline-math";

/**
 * Audio helpers built on top of the keyframe system:
 * - beat detection over stored waveform peaks → timeline markers
 * - auto-duck: volume keyframes that dip a music clip under speech/other audio
 */

export interface BeatDetectionOptions {
  /** Approximate BPM hint to constrain the minimum beat interval. */
  minInterval?: number; // seconds
  /** Sensitivity 0..1 — higher finds more onsets. */
  sensitivity?: number;
}

/**
 * Energy-based onset detection over waveform peaks.
 * `peaks` are normalized 0..1 amplitude samples across the source duration.
 * Returns beat times (seconds) in source time.
 */
export function detectBeats(
  peaks: Float32Array | number[],
  sourceDuration: number,
  options: BeatDetectionOptions = {}
): number[] {
  if (peaks.length < 16 || sourceDuration <= 0) return [];
  const minInterval = options.minInterval ?? 60 / 200; // up to 200 BPM
  const sensitivity = options.sensitivity ?? 0.45;

  // Energy envelope: local mean of squared peaks.
  const n = peaks.length;
  const energy = new Float32Array(n);
  const window = Math.max(3, Math.round(n / 200));
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      const v = peaks[j] ?? 0;
      sum += v * v;
      count++;
    }
    energy[i] = Math.sqrt(sum / Math.max(1, count));
  }

  // Adaptive threshold: onset when energy jumps above a moving average.
  const beats: number[] = [];
  const lookback = Math.max(4, Math.round(n / 60));
  let lastBeatIdx = -Infinity;
  for (let i = 1; i < n; i++) {
    let avg = 0;
    let count = 0;
    for (let j = Math.max(0, i - lookback); j < i; j++) {
      avg += energy[j] ?? 0;
      count++;
    }
    avg /= Math.max(1, count);
    const now = energy[i] ?? 0;
    const prev = energy[i - 1] ?? 0;
    const isOnset = now > avg * (1.35 + (1 - sensitivity) * 0.9) && now > prev * 1.04 && now > 0.03;
    if (isOnset && i - lastBeatIdx >= minInterval * (n / sourceDuration)) {
      beats.push((i / n) * sourceDuration);
      lastBeatIdx = i;
    }
  }
  return beats;
}

/** Convert source-time beats into timeline markers for a clip. */
export function beatsToMarkers(
  clip: Clip,
  sourceBeats: number[]
): { id: string; time: number; name: string }[] {
  const out: { id: string; time: number; name: string }[] = [];
  for (const b of sourceBeats) {
    // source time → timeline time: t = start + (b - inOffset) / speed
    const t = clip.start + (b - clip.inOffset) / Math.max(0.05, clip.speed);
    if (t < clip.start || t > clipEnd(clip)) continue;
    out.push({ id: createId("marker"), time: t, name: `Beat ${out.length + 1}` });
  }
  return out;
}

export interface AutoDuckOptions {
  /** Target volume while ducked (0..1). */
  dip?: number;
  /** Ramp time in/out (seconds). */
  fade?: number;
}

/**
 * Generate a volume keyframe track for `target` that dips it whenever any
 * other audible clip is active in the same range (classic music-under-voice).
 */
export function autoDuckKeyframes(
  target: Clip,
  others: Clip[],
  options: AutoDuckOptions = {}
): Keyframe[] {
  const dip = Math.max(0, Math.min(1, options.dip ?? 0.25));
  const fade = Math.max(0.05, options.fade ?? 0.35);
  const start = target.start;
  const end = clipEnd(target);
  const base = target.audio.volume > 0 ? target.audio.volume : 1;

  // Collect busy intervals: other clips that produce sound.
  const busy: [number, number][] = [];
  for (const clip of others) {
    if (clip.id === target.id) continue;
    if (clip.kind === "drawing" || clip.kind === "text" || clip.kind === "sticker") continue;
    if (clip.kind === "image") continue;
    if (clip.audio.muted) continue;
    const s = Math.max(start, clip.start);
    const e = Math.min(end, clipEnd(clip));
    if (e - s > 0.01) busy.push([s, e]);
  }
  if (busy.length === 0) return [];

  busy.sort((a, b) => a[0] - b[0]);
  // Merge overlaps.
  const merged: [number, number][] = [];
  for (const interval of busy) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }

  const kfs: Keyframe[] = [];
  const push = (time: number, value: number, easing: Keyframe["easing"] = "ease-in-out") => {
    if (time < start - 0.001 || time > end + 0.001) return;
    kfs.push({ id: createId("kf"), time, value, easing });
  };

  push(start, base, "linear");
  for (const [s, e] of merged) {
    push(Math.max(start, s - fade), base);
    push(Math.min(end, s), base * dip);
    push(Math.min(end, e), base * dip);
    push(Math.min(end, e + fade), base);
  }
  push(end, base, "linear");

  // Deduplicate/monotonic sort.
  kfs.sort((a, b) => a.time - b.time);
  const out: Keyframe[] = [];
  for (const k of kfs) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.time - k.time) < 0.02) {
      last.value = k.value;
      continue;
    }
    out.push(k);
  }
  return out;
}
