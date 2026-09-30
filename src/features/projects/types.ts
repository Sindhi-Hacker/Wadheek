import { uid } from '@/lib/id';
import { clamp } from '@/lib/time';

/** Data model for the editor: projects → tracks → clips. Everything is JSON-serializable. */

export type TrackKind = 'video' | 'audio';

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
}

export interface TextProperties {
  content: string;
  size: number;
  color: string;
  bold: boolean;
  font: string;
  align: 'left' | 'center' | 'right';
  shadow: boolean;
}

export type ClipKind = 'video' | 'image' | 'audio' | 'text';

export interface Clip {
  id: string;
  trackId: string;
  kind: ClipKind;
  name: string;
  /** Timeline position + length in seconds. */
  start: number;
  duration: number;
  /** Offset into the source media (seconds) for media clips. */
  in: number;
  /** Source playback multiplier. */
  speed: number;
  /** Transform for visual clips. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  /** Fades in seconds. */
  fadeIn: number;
  fadeOut: number;
  volume: number;
  mediaId?: string;
  text?: TextProperties;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  fps: number;
  background: string;
  tracks: Track[];
  clips: Clip[];
}

export function createTrack(kind: TrackKind, index: number): Track {
  return { id: uid('trk_'), kind, name: `${kind === 'video' ? 'V' : 'A'}${index}`, muted: false, hidden: false, locked: false };
}

export function createProject(name: string, width: number, height: number, fps: number): Project {
  const video = createTrack('video', 1);
  const audio = createTrack('audio', 1);
  const now = Date.now();
  return {
    id: uid('prj_'),
    name: name.trim() || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    width,
    height,
    fps,
    background: '#000000',
    tracks: [video, audio],
    clips: [],
  };
}

export function makeClip(partial: Partial<Clip> & Pick<Clip, 'trackId' | 'kind' | 'start' | 'duration'>): Clip {
  return {
    id: uid('clip_'),
    name: partial.name ?? 'Clip',
    in: partial.in ?? 0,
    speed: partial.speed ?? 1,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    scale: partial.scale ?? 1,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
    fadeIn: partial.fadeIn ?? 0,
    fadeOut: partial.fadeOut ?? 0,
    volume: partial.volume ?? 1,
    mediaId: partial.mediaId,
    text: partial.text,
    ...partial,
  };
}

export function defaultTextProps(): TextProperties {
  return {
    content: 'Your title here',
    size: 72,
    color: '#ffffff',
    bold: true,
    font: "'Inter', system-ui, sans-serif",
    align: 'center',
    shadow: true,
  };
}

export function cloneProject(p: Project): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({ ...t })),
    clips: p.clips.map((c) => ({ ...c, text: c.text ? { ...c.text } : undefined })),
  };
}

export function trackOf(project: Project, clip: Clip): Track | undefined {
  return project.tracks.find((t) => t.id === clip.trackId);
}

export function clipsOfTrack(project: Project, trackId: string): Clip[] {
  return project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

export function projectDuration(project: Project): number {
  return project.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

/** Source-time position inside a clip for a timeline instant. */
export function sourceTime(clip: Clip, t: number): number {
  return clip.in + (t - clip.start) * clip.speed;
}

export function isClipActive(clip: Clip, t: number): boolean {
  return t >= clip.start - 1e-6 && t < clipEnd(clip) - 1e-6;
}

export function fadeFactor(clip: Clip, t: number): number {
  const into = t - clip.start;
  let f = 1;
  if (clip.fadeIn > 0 && into < clip.fadeIn) f = Math.min(f, clamp(into / clip.fadeIn, 0, 1));
  const left = clip.duration - into;
  if (clip.fadeOut > 0 && left < clip.fadeOut) f = Math.min(f, clamp(left / clip.fadeOut, 0, 1));
  return f;
}

export function acceptsKind(track: Track, kind: ClipKind): boolean {
  if (track.kind === 'audio') return kind === 'audio';
  return kind !== 'audio';
}

export function isVisualClip(clip: Clip): boolean {
  return clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'text';
}

/** Rename tracks so numbering stays tidy (V1..Vn bottom-up, A1..An). */
export function renumberTracks(project: Project): void {
  let v = 0;
  let a = 0;
  // video tracks render bottom-up: index 0 is V1 (bottom).
  for (const t of project.tracks) {
    if (t.kind === 'video') t.name = `V${++v}`;
    else t.name = `A${++a}`;
  }
}

export function videoTracks(project: Project): Track[] {
  return project.tracks.filter((t) => t.kind === 'video');
}

export function audioTracks(project: Project): Track[] {
  return project.tracks.filter((t) => t.kind === 'audio');
}
