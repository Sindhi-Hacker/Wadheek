import type { Clip } from "../types/clip";
import type { Track } from "../types/track";
import { clipEnd } from "./timeline-math";

/**
 * Live Web Audio graph for preview playback.
 * Each media element is routed element -> gain -> panner -> master gain -> destination,
 * and per-frame `applyClipAudio` drives volume automation (fades, mute, solo).
 */
export class AudioGraph {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly nodes = new Map<
    string,
    { source: MediaElementAudioSourceNode; gain: GainNode; panner: StereoPannerNode }
  >();

  constructor(destination?: AudioNode) {
    this.ctx = new (window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(destination ?? this.ctx.destination);
  }

  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume().catch(() => undefined);
    }
  }

  /**
   * Reroute the master bus into a MediaStream destination (export path):
   * the mix becomes silent for the user but audible in the encoded file.
   */
  routeToStream(): MediaStreamAudioDestinationNode {
    const dest = this.ctx.createMediaStreamDestination();
    try {
      this.master.disconnect();
    } catch {
      /* ignore */
    }
    this.master.connect(dest);
    return dest;
  }

  connectElement(key: string, element: HTMLMediaElement): void {
    if (this.nodes.has(key)) return;
    try {
      const source = this.ctx.createMediaElementSource(element);
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      source.connect(gain);
      gain.connect(panner);
      panner.connect(this.master);
      gain.gain.value = 0;
      this.nodes.set(key, { source, gain, panner });
    } catch {
      // Element already connected to another context; leave element audio as-is.
    }
  }

  /** Compute the instantaneous gain for a clip at a timeline time (fades included). */
  static clipGainAt(clip: Clip, time: number): number {
    if (clip.audio.muted) return 0;
    let gain = clip.audio.volume;
    const local = time - clip.start;
    const remaining = clipEnd(clip) - time;
    if (clip.audio.fadeIn > 0 && local < clip.audio.fadeIn) {
      gain *= Math.max(0, local / clip.audio.fadeIn);
    }
    if (clip.audio.fadeOut > 0 && remaining < clip.audio.fadeOut) {
      gain *= Math.max(0, remaining / clip.audio.fadeOut);
    }
    return gain;
  }

  static trackAudible(track: Track, tracks: Track[]): boolean {
    const soloActive = tracks.some((t) => t.solo);
    if (soloActive && !track.solo) return false;
    return !track.muted;
  }

  applyClipAudio(key: string, clip: Clip, track: Track, tracks: Track[], time: number, active: boolean): void {
    const node = this.nodes.get(key);
    if (!node) return;
    const audible = active && AudioGraph.trackAudible(track, tracks);
    const gain = audible ? AudioGraph.clipGainAt(clip, time) : 0;
    node.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.015);
    node.panner.pan.setTargetAtTime(clip.audio.pan, this.ctx.currentTime, 0.015);
  }

  silence(key: string): void {
    const node = this.nodes.get(key);
    if (node) node.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
  }

  setMasterVolume(volume: number): void {
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
  }

  dispose(): void {
    this.nodes.forEach((n) => {
      try {
        n.source.disconnect();
        n.gain.disconnect();
        n.panner.disconnect();
      } catch {
        /* ignore */
      }
    });
    this.nodes.clear();
    void this.ctx.close().catch(() => undefined);
  }
}
