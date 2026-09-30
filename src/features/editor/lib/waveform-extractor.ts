import { LIMITS } from "@/config/limits";

/**
 * Decode an audio (or video-with-audio) blob and reduce it to normalized
 * peak samples for waveform rendering.
 */
export async function extractWaveform(blob: Blob): Promise<Float32Array | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(arrayBuffer);
    } finally {
      void ctx.close();
    }

    const samples = LIMITS.waveformSamples;
    const channel = buffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / samples));
    const peaks = new Float32Array(samples);
    let max = 0;

    for (let i = 0; i < samples; i++) {
      let peak = 0;
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      for (let j = start; j < end; j += 8) {
        const v = Math.abs(channel[j]!);
        if (v > peak) peak = v;
      }
      peaks[i] = peak;
      if (peak > max) max = peak;
    }

    if (max > 0) {
      for (let i = 0; i < samples; i++) peaks[i] = peaks[i]! / max;
    }
    return peaks;
  } catch {
    return null;
  }
}

/** Decode a blob into an AudioBuffer using a provided context (export path). */
export async function decodeToAudioBuffer(
  blob: Blob,
  ctx: BaseAudioContext
): Promise<AudioBuffer | null> {
  try {
    const data = await blob.arrayBuffer();
    return await ctx.decodeAudioData(data);
  } catch {
    return null;
  }
}
