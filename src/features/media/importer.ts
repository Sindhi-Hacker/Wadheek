import { MEDIA } from '@/config/defaults';
import { uid } from '@/lib/id';
import type { MediaKind, MediaRecord } from '@/features/media/types';

/** Import pipeline: probe metadata, generate thumbnails / filmstrips / waveforms in-page. */

export function kindFromMime(mime: string, name: string): MediaKind | null {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'mkv', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext)) return 'image';
  return null;
}

function el<K extends 'video' | 'audio'>(tag: K, src: string): HTMLVideoElement | HTMLAudioElement {
  const e = document.createElement(tag);
  e.preload = 'metadata';
  e.src = src;
  return e;
}

function waitFor(el: HTMLElement, event: string, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(`Media error: ${event}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', fail);
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

function drawThumb(source: HTMLVideoElement | HTMLImageElement, width: number, height: number): string {
  const w = Math.min(width, MEDIA.thumbnailWidth);
  const h = Math.round((height / Math.max(1, width)) * w) || 90;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, w, h);
  try {
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  video.currentTime = Math.min(Math.max(0.001, time), Math.max(0.001, (video.duration || 0) - 0.05));
  await waitFor(video, 'seeked', 8000);
}

async function probeVideo(url: string): Promise<{ duration: number; width: number; height: number; video: HTMLVideoElement }> {
  const video = el('video', url) as HTMLVideoElement;
  video.muted = true;
  await waitFor(video, 'loadedmetadata');
  // Some browsers report Infinity until a seek happens.
  if (!Number.isFinite(video.duration) || video.duration === 0) {
    video.currentTime = 1e6;
    await waitFor(video, 'seeked', 8000).catch(() => undefined);
    video.currentTime = 0;
    await waitFor(video, 'seeked', 8000).catch(() => undefined);
  }
  return { duration: video.duration || 0, width: video.videoWidth, height: video.videoHeight, video };
}

async function probeImage(url: string): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  const img = new Image();
  img.src = url;
  await waitFor(img, 'load');
  return { img, width: img.naturalWidth, height: img.naturalHeight };
}

async function decodeWaveform(blob: Blob): Promise<{ peaks: number[]; duration: number } | null> {
  try {
    const Ctx: typeof OfflineAudioContext = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx) return null;
    const probe = new Ctx(1, 128, 44100);
    const buffer = await probe.decodeAudioData(await blob.arrayBuffer());
    const ch = buffer.getChannelData(0);
    const buckets = MEDIA.waveformBuckets;
    const step = Math.floor(ch.length / buckets) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let peak = 0;
      const start = i * step;
      const end = Math.min(ch.length, start + step);
      for (let j = start; j < end; j += 4) {
        const v = Math.abs(ch[j]);
        if (v > peak) peak = v;
      }
      peaks.push(Math.min(1, peak));
    }
    return { peaks, duration: buffer.duration };
  } catch {
    return null; // unsupported container — clip still works, just no waveform
  }
}

export async function importFile(file: File): Promise<MediaRecord | null> {
  const kind = kindFromMime(file.type, file.name);
  if (!kind) throw new Error(`Unsupported file type: ${file.name}`);
  const url = URL.createObjectURL(file);
  try {
    const base: MediaRecord = {
      id: uid('med_'),
      name: file.name.replace(/\.[^.]+$/, ''),
      kind,
      mime: file.type || `${kind}/unknown`,
      size: file.size,
      duration: 0,
      width: 0,
      height: 0,
      createdAt: Date.now(),
      thumbnail: null,
      filmstrip: [],
      waveform: null,
      blob: file,
    };

    if (kind === 'image') {
      const { img, width, height } = await probeImage(url);
      base.width = width;
      base.height = height;
      base.duration = 0;
      base.thumbnail = drawThumb(img, width, height);
      return base;
    }

    if (kind === 'audio') {
      const audio = el('audio', url) as HTMLAudioElement;
      await waitFor(audio, 'loadedmetadata');
      base.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const wf = await decodeWaveform(file);
      if (wf) {
        base.waveform = wf.peaks;
        if (!base.duration) base.duration = wf.duration;
      }
      return base;
    }

    // video
    const { duration, width, height, video } = await probeVideo(url);
    base.duration = duration;
    base.width = width;
    base.height = height;
    if (width > 0) {
      await seekVideo(video, Math.min(0.4, duration * 0.1));
      base.thumbnail = drawThumb(video, width, height);
      const frames: string[] = [];
      const count = Math.max(1, Math.min(MEDIA.filmstripFrames, Math.ceil(duration)));
      for (let i = 0; i < count; i++) {
        const t = (duration * (i + 0.5)) / count;
        try {
          await seekVideo(video, t);
          const data = drawThumb(video, width, height);
          if (data) frames.push(data);
        } catch {
          break;
        }
      }
      base.filmstrip = frames;
    }
    const wf = await decodeWaveform(file);
    if (wf) base.waveform = wf.peaks;
    return base;
  } finally {
    URL.revokeObjectURL(url);
  }
}
