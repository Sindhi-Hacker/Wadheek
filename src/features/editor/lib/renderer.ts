import { EDITOR } from '@/config/defaults';
import { clamp } from '@/lib/time';
import type { MediaRecord } from '@/features/media/types';
import { fadeFactor, isClipActive, sourceTime, trackOf, videoTracks, type Clip, type Project } from '@/features/projects/types';

/**
 * ProgramRenderer — the monitor engine.
 * Owns hidden <video>/<audio> elements (one per clip), keeps them synced to the
 * playhead, composites the program frame onto a canvas each tick, and mixes clip
 * audio through a WebAudio graph so per-clip volume/fades and export capture work.
 */

type MediaEl = HTMLVideoElement | HTMLAudioElement;

interface AudioGraph {
  ctx: AudioContext;
  master: GainNode;
  streamDest: MediaStreamAudioDestinationNode;
  nodes: Map<HTMLMediaElement, GainNode>;
}

export class ProgramRenderer {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private project: Project | null = null;
  private mediaResolver: (id: string) => MediaRecord | undefined = () => undefined;
  private elements = new Map<string, MediaEl>();
  private images = new Map<string, HTMLImageElement>();
  private audio: AudioGraph | null = null;
  private urlCache = new Map<string, string>();
  private disposed = false;
  private exportCtx: { ctx: CanvasRenderingContext2D; w: number; h: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d', { alpha: false })!;
  }

  setProject(project: Project | null): void {
    this.project = project;
    if (project) {
      if (this.canvas.width !== project.width || this.canvas.height !== project.height) {
        this.canvas.width = project.width;
        this.canvas.height = project.height;
      }
    }
    this.prune();
  }

  setMediaResolver(fn: (id: string) => MediaRecord | undefined): void {
    this.mediaResolver = fn;
    this.prune();
  }

  private mediaUrl(mediaId: string): string | undefined {
    const cached = this.urlCache.get(mediaId);
    if (cached) return cached;
    const record = this.mediaResolver(mediaId);
    if (!record) return undefined;
    const url = URL.createObjectURL(record.blob);
    this.urlCache.set(mediaId, url);
    return url;
  }

  private prune(): void {
    const p = this.project;
    if (!p) return;
    const live = new Set(p.clips.map((c) => c.id));
    for (const [clipId, el] of this.elements) {
      if (!live.has(clipId)) {
        el.pause();
        if (el.src) el.removeAttribute('src');
        el.load();
        this.elements.delete(clipId);
      }
    }
    for (const [clipId, img] of this.images) {
      if (!live.has(clipId)) {
        img.src = '';
        this.images.delete(clipId);
      }
    }
  }

  private ensureMediaElement(clip: Clip): MediaEl | null {
    if (!clip.mediaId) return null;
    const existing = this.elements.get(clip.id);
    if (existing) return existing;
    const url = this.mediaUrl(clip.mediaId);
    if (!url) return null;
    const el = document.createElement(clip.kind === 'audio' ? 'audio' : 'video') as MediaEl;
    el.preload = 'auto';
    el.src = url;
    el.crossOrigin = 'anonymous';
    if (this.audio) this.hookAudio(el);
    this.elements.set(clip.id, el);
    return el;
  }

  private ensureImage(clip: Clip): HTMLImageElement | null {
    if (!clip.mediaId) return null;
    const existing = this.images.get(clip.id);
    if (existing) return existing;
    const url = this.mediaUrl(clip.mediaId);
    if (!url) return null;
    const img = new Image();
    img.src = url;
    this.images.set(clip.id, img);
    return img;
  }

  // ---------- audio ----------

  private hookAudio(el: HTMLMediaElement): void {
    if (!this.audio || this.audio.nodes.has(el)) return;
    try {
      const src = this.audio.ctx.createMediaElementSource(el);
      const gain = this.audio.ctx.createGain();
      src.connect(gain);
      gain.connect(this.audio.master);
      this.audio.nodes.set(el, gain);
    } catch {
      // element already hooked or WebAudio unavailable — element volume fallback
    }
  }

  /** Must be called from a user gesture (play button) before audio can be heard. */
  userGesture(): void {
    if (this.audio) {
      if (this.audio.ctx.state === 'suspended') void this.audio.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const streamDest = ctx.createMediaStreamDestination();
      master.connect(streamDest);
      this.audio = { ctx, master, streamDest, nodes: new Map() };
      for (const el of this.elements.values()) this.hookAudio(el);
    } catch {
      this.audio = null;
    }
  }

  get audioContextState(): string {
    return this.audio?.ctx.state ?? 'none';
  }

  audioTracks(): MediaStreamTrack[] {
    return this.audio ? this.audio.streamDest.stream.getAudioTracks() : [];
  }

  private setElementGain(clip: Clip, el: MediaEl, audibleVolume: number): void {
    if (this.audio) {
      const gain = this.audio.nodes.get(el);
      if (gain) gain.gain.value = audibleVolume;
    } else {
      el.volume = clamp(audibleVolume, 0, 1);
    }
  }

  // ---------- sync + draw ----------

  tick(t: number, playing: boolean, rate: number): void {
    if (this.disposed) return;
    const project = this.project;
    if (!project) return;
    this.syncMedia(t, playing, rate);
    // Always paint the monitor: keeping a visible surface dirty keeps the
    // compositor issuing frames (rAF can halt entirely otherwise). The export
    // surface, when attached, is composed directly — never via readback.
    this.draw(t);
    if (this.exportCtx) this.drawTo(this.exportCtx.ctx, this.exportCtx.w, this.exportCtx.h, t);
  }

  /**
   * Attach a secondary draw target (an offscreen export canvas). Each tick
   * composes the frame directly into it. Capturing this detached canvas avoids
   * readbacks from the composited monitor surface, which stall on software
   * renderers.
   */
  setExportCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas) {
      this.exportCtx = null;
      return;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      this.exportCtx = null;
      return;
    }
    this.exportCtx = { ctx, w: canvas.width, h: canvas.height };
  }

  pauseAll(): void {
    for (const el of this.elements.values()) {
      if (!el.paused) el.pause();
    }
  }

  private syncMedia(t: number, playing: boolean, rate: number): void {
    const project = this.project!;
    for (const clip of project.clips) {
      if (clip.kind === 'text' || clip.kind === 'image' || !clip.mediaId) continue;
      const el = this.ensureMediaElement(clip);
      if (!el) continue;
      const track = trackOf(project, clip);
      const active = isClipActive(clip, t);
      const target = sourceTime(clip, t);
      const audible = active && !(track?.muted ?? false);

      if (playing && rate > 0 && active) {
        const pr = clamp(clip.speed * rate, 0.0625, EDITOR.maxPlaybackRate);
        if (el.playbackRate !== pr) el.playbackRate = pr;
        if (el.paused) {
          try {
            el.currentTime = target;
          } catch {
            /* not seekable yet */
          }
          void el.play().catch(() => undefined);
        } else if (Math.abs(el.currentTime - target) > EDITOR.syncDrift) {
          try {
            el.currentTime = target;
          } catch {
            /* ignore */
          }
        }
        this.setElementGain(clip, el, audible ? clip.volume * fadeFactor(clip, t) : 0);
      } else {
        if (!el.paused) el.pause();
        if (active) {
          // Keep frames aligned while scrubbing / paused.
          if (Math.abs(el.currentTime - target) > 0.06) {
            try {
              el.currentTime = target;
            } catch {
              /* ignore */
            }
          }
          this.setElementGain(clip, el, 0);
        }
      }
    }
  }

  private draw(t: number): void {
    this.drawTo(this.ctx2d, this.canvas.width, this.canvas.height, t);
  }

  private drawTo(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const project = this.project!;
    ctx.fillStyle = project.background || '#000';
    ctx.fillRect(0, 0, w, h);

    const tracks = videoTracks(project);
    for (const track of tracks) {
      if (track.hidden) continue;
      const clips = project.clips.filter((c) => c.trackId === track.id && isClipActive(c, t));
      clips.sort((a, b) => a.start - b.start);
      for (const clip of clips) {
        this.drawClip(ctx, clip, t, w, h);
      }
    }
  }

  private drawClip(ctx: CanvasRenderingContext2D, clip: Clip, t: number, w: number, h: number): void {
    const alpha = clamp(clip.opacity * fadeFactor(clip, t), 0, 1);
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2 + clip.x, h / 2 + clip.y);
    if (clip.rotation) ctx.rotate((clip.rotation * Math.PI) / 180);

    if (clip.kind === 'text' && clip.text) {
      this.drawText(ctx, clip, w, h);
      ctx.restore();
      return;
    }

    let source: HTMLVideoElement | HTMLImageElement | null = null;
    let mw = 0;
    let mh = 0;
    if (clip.kind === 'image') {
      const img = this.ensureImage(clip);
      if (img && img.complete && img.naturalWidth > 0) {
        source = img;
        mw = img.naturalWidth;
        mh = img.naturalHeight;
      }
    } else if (clip.kind === 'video') {
      const el = this.elements.get(clip.id) as HTMLVideoElement | undefined;
      if (el && el.readyState >= 2) {
        source = el;
        mw = el.videoWidth;
        mh = el.videoHeight;
      }
    }

    if (source && mw > 0 && mh > 0) {
      const fit = Math.min(w / mw, h / mh);
      const dw = mw * fit * clip.scale;
      const dh = mh * fit * clip.scale;
      try {
        ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
      } catch {
        /* frame not ready */
      }
    }
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number): void {
    const props = clip.text!;
    const lines = props.content.split('\n');
    const size = (props.size * h) / 1080; // scale relative to a 1080 reference
    ctx.font = `${props.bold ? 700 : 500} ${size}px ${props.font}`;
    ctx.textAlign = props.align === 'left' ? 'left' : props.align === 'right' ? 'right' : 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = size * 1.2;
    const totalH = lineHeight * lines.length;
    const anchorX = props.align === 'left' ? -w / 2 : props.align === 'right' ? w / 2 : 0;
    lines.forEach((line, i) => {
      const y = -totalH / 2 + lineHeight * (i + 0.5);
      if (props.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(6, size * 0.12);
        ctx.shadowOffsetY = Math.max(2, size * 0.04);
      }
      ctx.fillStyle = props.color;
      ctx.fillText(line, anchorX, y);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  /** Clips whose media elements are currently audible/active (for the audio meter). */
  activeMediaClipCount(t: number): number {
    const project = this.project;
    if (!project) return 0;
    return project.clips.filter((c) => c.kind !== 'text' && isClipActive(c, t)).length;
  }

  frameAt(t: number): void {
    this.tick(t, false, 0);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    this.disposed = true;
    this.pauseAll();
    for (const el of this.elements.values()) {
      el.removeAttribute('src');
      el.load();
    }
    this.elements.clear();
    this.images.clear();
    for (const url of this.urlCache.values()) URL.revokeObjectURL(url);
    this.urlCache.clear();
    if (this.audio) {
      void this.audio.ctx.close().catch(() => undefined);
      this.audio = null;
    }
  }
}
