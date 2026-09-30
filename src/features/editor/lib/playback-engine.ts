import type { Clip } from "../types/clip";
import type { Track } from "../types/track";
import type { MediaAsset } from "../types/media";
import type { FrameSourceProvider } from "./canvas-compositor";
import { clipEnd } from "./timeline-math";
import { timelineToSourceTime } from "./clip-operations";
import { getMediaUrl } from "./opfs-storage";
import { AudioGraph } from "./audio-graph";

const SEEK_TOLERANCE = 0.18;

interface MediaEntry {
  element: HTMLVideoElement | HTMLAudioElement | null;
  image: HTMLImageElement | null;
  asset: MediaAsset;
  ready: boolean;
}

/**
 * Owns hidden media elements + the Web Audio graph and acts as the
 * FrameSourceProvider for the shared compositor. The same class powers the
 * realtime export session (with its own instance and audio destination).
 */
export class PlaybackEngine implements FrameSourceProvider {
  private entries = new Map<string, MediaEntry>();
  private audio: AudioGraph;

  constructor(audioDestination?: AudioNode, audioGraph?: AudioGraph) {
    this.audio = audioGraph ?? new AudioGraph(audioDestination);
  }

  get audioGraph(): AudioGraph {
    return this.audio;
  }

  async prepare(assets: MediaAsset[]): Promise<void> {
    await Promise.all(assets.map((asset) => this.ensureEntry(asset)));
  }

  private async ensureEntry(asset: MediaAsset): Promise<void> {
    if (this.entries.has(asset.id)) return;
    const entry: MediaEntry = { element: null, image: null, asset, ready: false };
    this.entries.set(asset.id, entry);

    const url = await getMediaUrl(asset.id);
    if (!url) return;

    if (asset.type === "image") {
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      });
      entry.image = img;
      entry.ready = true;
      return;
    }

    const el = document.createElement(asset.type === "video" ? "video" : "audio");
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.loop = false;
    (el as HTMLVideoElement).playsInline = true;
    el.src = url;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.addEventListener("loadeddata", done, { once: true });
      el.addEventListener("error", done, { once: true });
      setTimeout(done, 8000);
    });
    entry.element = el;
    entry.ready = true;
    this.audio.connectElement(asset.id, el);
  }

  /* ---------- FrameSourceProvider ---------- */

  getFrame(clip: Clip): CanvasImageSource | null {
    if (!clip.mediaId) return null;
    const entry = this.entries.get(clip.mediaId);
    if (!entry?.ready) return null;
    if (entry.image) return entry.image;
    if (entry.element && entry.asset.type === "video") return entry.element as HTMLVideoElement;
    return null;
  }

  getSourceSize(clip: Clip): { width: number; height: number } | null {
    if (!clip.mediaId) return null;
    const entry = this.entries.get(clip.mediaId);
    if (!entry?.ready) return null;
    if (entry.image) return { width: entry.image.naturalWidth, height: entry.image.naturalHeight };
    const video = entry.element as HTMLVideoElement | null;
    if (video && entry.asset.type === "video") {
      return { width: video.videoWidth, height: video.videoHeight };
    }
    return null;
  }

  /* ---------- sync ---------- */

  /**
   * Synchronize every media element with the timeline clock.
   * Called each animation frame during playback and after every scrub.
   */
  sync(tracks: Track[], time: number, playing: boolean): void {
    const activeByMedia = new Map<string, { clip: Clip; track: Track }>();

    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.mediaId) continue;
        if (time >= clip.start && time < clipEnd(clip)) {
          if (!activeByMedia.has(clip.mediaId)) {
            activeByMedia.set(clip.mediaId, { clip, track });
          }
        }
      }
    }

    this.entries.forEach((entry, mediaId) => {
      const el = entry.element;
      if (!el) return;
      const active = activeByMedia.get(mediaId);

      if (!active) {
        if (!el.paused) el.pause();
        this.audio.silence(mediaId);
        return;
      }

      const { clip, track } = active;
      const visualHidden = track.kind !== "audio" && track.hidden;
      const sourceTime = timelineToSourceTime(clip, time);
      const rate = Math.min(16, Math.max(0.0625, clip.speed));

      if (el.playbackRate !== rate) el.playbackRate = rate;
      const elWithPitch = el as HTMLMediaElement & { preservesPitch?: boolean };
      if (elWithPitch.preservesPitch !== clip.audio.preservePitch) {
        elWithPitch.preservesPitch = clip.audio.preservePitch;
      }

      const drift = Math.abs(el.currentTime - sourceTime);
      if (drift > (playing ? SEEK_TOLERANCE * rate : 0.001)) {
        try {
          el.currentTime = Math.max(0, Math.min(sourceTime, (entry.asset.duration || sourceTime) - 0.01));
        } catch {
          /* not seekable yet */
        }
      }

      if (playing && !visualHidden) {
        if (el.paused) void el.play().catch(() => undefined);
      } else if (!el.paused) {
        el.pause();
      }

      this.audio.applyClipAudio(mediaId, clip, track, tracks, time, true);
    });
  }

  pauseAll(): void {
    this.entries.forEach((entry, id) => {
      entry.element?.pause();
      this.audio.silence(id);
    });
  }

  /** Await pending seeks so paused scrubbing shows the exact frame. */
  async settleSeeks(): Promise<void> {
    const waits: Promise<void>[] = [];
    this.entries.forEach((entry) => {
      const el = entry.element as HTMLVideoElement | null;
      if (el && el.seeking) {
        waits.push(
          new Promise<void>((resolve) => {
            const done = () => resolve();
            el.addEventListener("seeked", done, { once: true });
            setTimeout(done, 500);
          })
        );
      }
    });
    await Promise.all(waits);
  }

  async resumeAudio(): Promise<void> {
    await this.audio.resume();
  }

  dispose(): void {
    this.entries.forEach((entry) => {
      if (entry.element) {
        entry.element.pause();
        entry.element.removeAttribute("src");
        entry.element.load();
      }
    });
    this.entries.clear();
    this.audio.dispose();
  }
}
