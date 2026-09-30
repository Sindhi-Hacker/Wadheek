import type { Clip } from "../types/clip";
import type { Track } from "../types/track";
import type { MediaAsset } from "../types/media";
import type { FrameSourceProvider } from "./canvas-compositor";
import { clipEnd } from "./timeline-math";
import { timelineToSourceTime } from "./clip-operations";
import { getMediaUrl } from "./opfs-storage";
import { AudioGraph } from "./audio-graph";
import { ChromaKeyProcessor } from "./chroma-key";

const SEEK_TOLERANCE = 0.18;

interface MediaEntry {
  /** Entry key: `mediaId` for the shared base entry, `mediaId::clipId` for clones. */
  key: string;
  mediaId: string;
  element: HTMLVideoElement | HTMLAudioElement | null;
  image: HTMLImageElement | null;
  asset: MediaAsset;
  ready: boolean;
  lastUsed: number;
}

/**
 * Owns hidden media elements + the Web Audio graph and acts as the
 * FrameSourceProvider for the shared compositor. The same class powers the
 * realtime export session (with its own instance and audio destination).
 *
 * Entries are keyed per media asset, but when two clips need the same asset at
 * the same time (e.g. a video on the video track + its detached audio, or the
 * same video on two overlay tracks), per-clip clone entries are spun up so
 * each clip gets its own element and audio routing.
 */
export class PlaybackEngine implements FrameSourceProvider {
  private entries = new Map<string, MediaEntry>();
  private audio: AudioGraph;
  private chroma = new ChromaKeyProcessor();
  private chromaCache = new WeakMap<HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas, HTMLCanvasElement | OffscreenCanvas | null>();
  private lastChromaKey = new WeakMap<object, string>();

  constructor(audioDestination?: AudioNode, audioGraph?: AudioGraph) {
    this.audio = audioGraph ?? new AudioGraph(audioDestination);
  }

  get audioGraph(): AudioGraph {
    return this.audio;
  }

  async prepare(assets: MediaAsset[]): Promise<void> {
    await Promise.all(assets.map((asset) => this.ensureBaseEntry(asset)));
  }

  private async ensureBaseEntry(asset: MediaAsset): Promise<MediaEntry> {
    const existing = this.entries.get(asset.id);
    if (existing) return existing;
    const entry: MediaEntry = {
      key: asset.id,
      mediaId: asset.id,
      element: null,
      image: null,
      asset,
      ready: false,
      lastUsed: 0,
    };
    this.entries.set(asset.id, entry);
    await this.hydrateEntry(entry);
    return entry;
  }

  /** Create a per-clip clone of an existing hydrated entry. */
  private async ensureCloneEntry(base: MediaEntry, clipId: string): Promise<MediaEntry> {
    const key = `${base.mediaId}::${clipId}`;
    const existing = this.entries.get(key);
    if (existing) return existing;
    const entry: MediaEntry = {
      key,
      mediaId: base.mediaId,
      element: null,
      image: null,
      asset: base.asset,
      ready: false,
      lastUsed: 0,
    };
    this.entries.set(key, entry);
    // Images can share the decoded bitmap; media elements need their own.
    if (base.image) {
      entry.image = base.image;
      entry.ready = true;
      return entry;
    }
    await this.hydrateEntry(entry);
    return entry;
  }

  private async hydrateEntry(entry: MediaEntry): Promise<void> {
    const url = await getMediaUrl(entry.asset.id);
    if (!url) return;

    if (entry.asset.type === "image") {
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

    const el = document.createElement(entry.asset.type === "video" ? "video" : "audio");
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.loop = false;
    (el as HTMLVideoElement).playsInline = true;
    el.muted = false;
    el.src = url;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.addEventListener("loadeddata", done, { once: true });
      el.addEventListener("error", done, { once: true });
      setTimeout(done, 8000);
    });
    entry.element = el;
    entry.ready = true;
    this.audio.connectElement(entry.key, el);
  }

  /* ---------- FrameSourceProvider ---------- */

  /** Entry that drives this clip: a clone if one exists, else the shared base. */
  private entryForClip(clip: Clip): MediaEntry | undefined {
    if (!clip.mediaId) return undefined;
    const clone = this.entries.get(`${clip.mediaId}::${clip.id}`);
    return clone ?? this.entries.get(clip.mediaId);
  }

  private rawFrame(entry: MediaEntry): CanvasImageSource | null {
    if (!entry.ready) return null;
    if (entry.image) return entry.image;
    if (entry.element && entry.asset.type === "video") return entry.element as HTMLVideoElement;
    return null;
  }

  getFrame(clip: Clip): CanvasImageSource | null {
    const entry = this.entryForClip(clip);
    if (!entry) return null;
    const frame = this.rawFrame(entry);
    if (!frame) return null;

    // Green-screen pass: returns a transparent canvas keyed from the frame.
    // Re-keys whenever the source frame or parameters change; the result is
    // cached so paused scrubbing doesn't recompute.
    if (clip.chroma?.enabled && entry.asset.type === "video") {
      const video = entry.element as HTMLVideoElement;
      const cacheKey = `${clip.chroma.color}|${clip.chroma.similarity}|${clip.chroma.smoothness}|${clip.chroma.spill}|${video.currentTime.toFixed(3)}`;
      if (this.lastChromaKey.get(video) !== cacheKey) {
        this.lastChromaKey.set(video, cacheKey);
        const keyed = this.chroma.process(frame, clip.chroma, video.videoWidth, video.videoHeight);
        this.chromaCache.set(video, keyed);
      }
      return this.chromaCache.get(video) ?? frame;
    }
    return frame;
  }

  getSourceSize(clip: Clip): { width: number; height: number } | null {
    if (!clip.mediaId) return null;
    const entry = this.entryForClip(clip);
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
    const now = performance.now();

    // Group active clips by mediaId to detect shared usage.
    const activeClips = new Map<string, Clip[]>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (!clip.mediaId) continue;
        if (time >= clip.start && time < clipEnd(clip)) {
          const list = activeClips.get(clip.mediaId) ?? [];
          list.push(clip);
          activeClips.set(clip.mediaId, list);
        }
      }
    }

    // Resolve the entry each active clip should use.
    const activeEntries = new Map<MediaEntry, { clip: Clip; track: Track }>();
    const pendingClones: { base: MediaEntry; clipId: string; clip: Clip; track: Track }[] = [];

    for (const [mediaId, clips] of activeClips) {
      const base = this.entries.get(mediaId);
      if (!base) continue; // not prepared yet
      if (clips.length === 1) {
        // Prefer an existing clone (created earlier) so audio routing stays stable.
        const clip = clips[0]!;
        const entry = this.entries.get(`${mediaId}::${clip.id}`) ?? base;
        const track = this.trackOf(tracks, clip);
        if (track) {
          activeEntries.set(entry, { clip, track });
          entry.lastUsed = now;
        }
      } else {
        for (const clip of clips) {
          const clone = this.entries.get(`${mediaId}::${clip.id}`);
          if (clone) {
            const track = this.trackOf(tracks, clip);
            if (track) {
              activeEntries.set(clone, { clip, track });
              clone.lastUsed = now;
            }
          } else {
            const track = this.trackOf(tracks, clip);
            if (track) pendingClones.push({ base, clipId: clip.id, clip, track });
          }
        }
      }
    }

    // Spin up needed clones asynchronously (they catch up next frames).
    for (const req of pendingClones) {
      void this.ensureCloneEntry(req.base, req.clipId).then((entry) => {
        entry.lastUsed = now;
      });
    }

    this.entries.forEach((entry, key) => {
      const active = activeEntries.get(entry);
      const el = entry.element;

      if (!active) {
        if (el && !el.paused) el.pause();
        this.audio.silence(entry.key);
        // Prune idle clone entries so splits/duplicates don't leak elements.
        if (key.includes("::") && now - entry.lastUsed > 10_000) {
          this.disposeEntry(entry);
          this.entries.delete(key);
        }
        return;
      }

      const { clip, track } = active;
      const visualHidden = track.kind !== "audio" && track.hidden;
      const sourceTime = timelineToSourceTime(clip, time);
      const rate = Math.min(16, Math.max(0.0625, clip.speed));

      if (el) {
        if (el.playbackRate !== rate) el.playbackRate = rate;
        const elWithPitch = el as HTMLMediaElement & { preservesPitch?: boolean };
        if (elWithPitch.preservesPitch !== clip.audio.preservePitch) {
          elWithPitch.preservesPitch = clip.audio.preservePitch;
        }

        const drift = Math.abs(el.currentTime - sourceTime);
        if (drift > (playing ? SEEK_TOLERANCE * rate : 0.001)) {
          try {
            el.currentTime = Math.max(
              0,
              Math.min(sourceTime, (entry.asset.duration || sourceTime) - 0.01)
            );
          } catch {
            /* not seekable yet */
          }
        }

        const audible = playing && !visualHidden;
        if (audible) {
          if (el.paused) void el.play().catch(() => undefined);
        } else if (!el.paused) {
          el.pause();
        }
      }

      this.audio.applyClipAudio(entry.key, clip, track, tracks, time, true);
    });
  }

  private trackOf(tracks: Track[], clip: Clip): Track | undefined {
    for (const track of tracks) {
      if (track.clips.some((c) => c.id === clip.id)) return track;
    }
    return undefined;
  }

  private disposeEntry(entry: MediaEntry): void {
    if (entry.element) {
      entry.element.pause();
      entry.element.removeAttribute("src");
      entry.element.load();
    }
    this.audio.disconnectElement(entry.key);
  }

  pauseAll(): void {
    this.entries.forEach((entry) => {
      entry.element?.pause();
      this.audio.silence(entry.key);
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
    this.entries.forEach((entry) => this.disposeEntry(entry));
    this.entries.clear();
    this.audio.dispose();
  }
}
