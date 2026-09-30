import { TIMELINE } from '@/config/defaults';
import { uid } from '@/lib/id';
import {
  acceptsKind,
  clipEnd,
  clipsOfTrack,
  isClipActive,
  makeClip,
  renumberTracks,
  type Clip,
  type Project,
  type Track,
  type TrackKind,
} from '@/features/projects/types';

/** Pure timeline operations. Each takes a project and returns a new one. */

export function clipsAt(project: Project, time: number): Clip[] {
  return project.clips.filter((c) => isClipActive(c, time));
}

export function clipAt(project: Project, time: number, trackId?: string): Clip | undefined {
  return project.clips.find((c) => isClipActive(c, time) && (!trackId || c.trackId === trackId));
}

/**
 * Resolve a non-overlapping start position on a track; null when the clip cannot fit.
 * When `anchor` (the clip's current dragged position) lies inside a gap, that gap
 * wins so the clip slides elastically within it instead of jumping across
 * occupied regions — the drag only hops when the pointer reaches another gap.
 */
export function resolveFreeStart(project: Project, trackId: string, clipId: string, desired: number, duration: number, anchor?: number): number | null {
  const others = clipsOfTrack(project, trackId).filter((c) => c.id !== clipId);
  if (duration <= 0) return desired;
  desired = Math.max(0, desired);
  // Build gaps.
  const gaps: Array<[number, number]> = [];
  let cursor = 0;
  for (const c of others) {
    if (c.start - cursor >= duration - 1e-9) gaps.push([cursor, c.start]);
    cursor = Math.max(cursor, clipEnd(c));
  }
  gaps.push([cursor, Infinity]);

  const clampInto = (gs: number, ge: number): number | null => {
    if (ge - gs < duration - 1e-9) return null;
    return Math.min(Math.max(desired, gs), ge - duration);
  };

  // Prefer the gap the clip currently occupies (smooth elastic dragging).
  if (anchor != null) {
    for (const [gs, ge] of gaps) {
      if (anchor >= gs - 1e-9 && anchor + duration <= ge + 1e-9) {
        const clamped = clampInto(gs, ge);
        if (clamped != null) return clamped;
      }
    }
  }
  // Otherwise pick the closest reachable position to the pointer.
  let best: number | null = null;
  let bestDist = Infinity;
  for (const [gs, ge] of gaps) {
    const clamped = clampInto(gs, ge);
    if (clamped == null) continue;
    const d = Math.abs(clamped - desired);
    if (d < bestDist) {
      bestDist = d;
      best = clamped;
    }
  }
  return best;
}

export interface SnapResult {
  time: number;
  snapped: boolean;
}

/** Snap a time to the closest candidate within threshold seconds. */
export function snapTime(time: number, candidates: number[], threshold: number): SnapResult {
  let best = time;
  let bestDist = threshold;
  let snapped = false;
  for (const c of candidates) {
    const d = Math.abs(c - time);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
      snapped = true;
    }
  }
  return { time: Math.max(0, best), snapped };
}

/** Collect snap points: playhead, range marks, clip edges, 0. */
export function snapCandidates(project: Project, playhead: number, inPoint: number | null, outPoint: number | null, excludeClipId?: string): number[] {
  const pts = [0, playhead];
  if (inPoint != null) pts.push(inPoint);
  if (outPoint != null) pts.push(outPoint);
  for (const c of project.clips) {
    if (c.id === excludeClipId) continue;
    pts.push(c.start, clipEnd(c));
  }
  return pts;
}

export interface DragState {
  clip: Clip;
  start: number;
  duration: number;
  in: number;
  trackId: string;
  /** Max source seconds extendable to the left/right (timeline seconds). */
  maxLeft: number;
  maxRight: number;
}

export function dragStateFor(project: Project, clip: Clip, sourceDuration: number | null): DragState {
  // sourceDuration = seconds of source media available from clip.in (already excludes speed)
  const maxLeftTimeline = sourceDuration != null ? clip.in / clip.speed : Infinity;
  const consumed = clip.duration * clip.speed;
  const maxRightTimeline = sourceDuration != null ? Math.max(0, (sourceDuration - consumed) / clip.speed) : Infinity;
  return { clip, start: clip.start, duration: clip.duration, in: clip.in, trackId: clip.trackId, maxLeft: maxLeftTimeline, maxRight: maxRightTimeline };
}

/** Apply a move/trim draft to a project copy without committing history. */
export function applyDrag(
  project: Project,
  drag: DragState,
  next: { start: number; duration: number; in: number; trackId: string },
): Project {
  return {
    ...project,
    clips: project.clips.map((c) =>
      c.id === drag.clip.id ? { ...c, start: Math.max(0, next.start), duration: next.duration, in: Math.max(0, next.in), trackId: next.trackId } : c,
    ),
  };
}

export function withClip(project: Project, clipId: string, patch: Partial<Clip>): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) };
}

export function removeClip(project: Project, clipId: string, ripple = false): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  let clips = project.clips.filter((c) => c.id !== clipId);
  if (ripple) {
    const end = clipEnd(clip);
    clips = clips.map((c) => (c.trackId === clip.trackId && c.start >= end - 1e-9 ? { ...c, start: Math.max(0, c.start - clip.duration) } : c));
  }
  return { ...project, clips };
}

export function splitClipsAt(project: Project, time: number, onlyClipId?: string): { project: Project; count: number } {
  const clips: Clip[] = [];
  let count = 0;
  for (const c of project.clips) {
    const target = onlyClipId ? c.id === onlyClipId : true;
    const splittable = target && time > c.start + TIMELINE.minClipDuration && time < clipEnd(c) - TIMELINE.minClipDuration;
    if (!splittable) {
      clips.push(c);
      continue;
    }
    const left: Clip = { ...c, duration: time - c.start };
    const right: Clip = {
      ...c,
      id: uid('clip_'),
      start: time,
      duration: clipEnd(c) - time,
      in: c.in + (time - c.start) * c.speed,
      fadeIn: 0,
    };
    left.fadeOut = Math.min(left.fadeOut, left.duration);
    clips.push(left, right);
    count++;
  }
  return { project: { ...project, clips }, count };
}

export function duplicateClip(project: Project, clipId: string, at: number): { project: Project; clip: Clip | undefined } {
  const src = project.clips.find((c) => c.id === clipId);
  if (!src) return { project, clip: undefined };
  const duration = src.duration;
  const start = resolveFreeStart(project, src.trackId, src.id, at, duration);
  if (start == null) return { project, clip: undefined };
  const copy: Clip = { ...src, id: uid('clip_'), start, text: src.text ? { ...src.text } : undefined };
  return { project: { ...project, clips: [...project.clips, copy] }, clip: copy };
}

export function addMediaClip(
  project: Project,
  media: { id: string; kind: 'video' | 'audio' | 'image'; duration: number; name: string },
  opts: { trackId?: string; at?: number; duration?: number } = {},
): { project: Project; clip: Clip | undefined } {
  const kind = media.kind === 'audio' ? 'audio' : media.kind;
  const wantedKind: TrackKind = kind === 'audio' ? 'audio' : 'video';
  let track: Track | undefined = opts.trackId ? project.tracks.find((t) => t.id === opts.trackId) : undefined;
  if (!track || !acceptsKind(track, kind)) {
    const candidates = project.tracks.filter((t) => t.kind === wantedKind && !t.locked);
    track = candidates[candidates.length - 1];
  }
  if (!track) return { project, clip: undefined };
  const duration = Math.max(opts.duration ?? (media.kind === 'image' ? 4 : media.duration || 5), TIMELINE.minClipDuration);
  const desired = opts.at ?? 0;
  const start = resolveFreeStart(project, track.id, '', desired, duration) ?? 0;
  const clip = makeClip({
    trackId: track.id,
    kind,
    name: media.name,
    mediaId: media.id,
    start,
    duration,
    in: 0,
  });
  return { project: { ...project, clips: [...project.clips, clip] }, clip };
}

export function addTextClip(project: Project, at: number): { project: Project; clip: Clip | undefined } {
  const track = [...project.tracks].reverse().find((t) => t.kind === 'video' && !t.locked);
  if (!track) return { project, clip: undefined };
  const duration = 4;
  const start = resolveFreeStart(project, track.id, '', at, duration) ?? 0;
  const clip = makeClip({
    trackId: track.id,
    kind: 'text',
    name: 'Title',
    start,
    duration,
    text: {
      content: 'Your title here',
      size: 72,
      color: '#ffffff',
      bold: true,
      font: "'Inter', system-ui, sans-serif",
      align: 'center',
      shadow: true,
    },
  });
  return { project: { ...project, clips: [...project.clips, clip] }, clip };
}

export function addTrack(project: Project, kind: TrackKind): Project {
  const track: Track = { id: uid('trk_'), kind, name: '', muted: false, hidden: false, locked: false };
  const next = { ...project, tracks: [...project.tracks, track] };
  renumberTracks(next);
  return next;
}

export function removeTrack(project: Project, trackId: string): Project {
  const remaining = project.tracks.filter((t) => t.id !== trackId);
  if (remaining.length === 0) return project;
  const next = { ...project, tracks: remaining, clips: project.clips.filter((c) => c.trackId !== trackId) };
  renumberTracks(next);
  return next;
}

export function updateTrack(project: Project, trackId: string, patch: Partial<Track>): Project {
  const next = { ...project, tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)) };
  if (patch.kind === undefined) renumberTracks(next);
  return next;
}

/** First free slot at/after a time on the least busy track of a kind. */
export function firstFreeSlot(project: Project, kind: TrackKind, at: number, duration: number): { trackId: string; start: number } | null {
  const tracks = project.tracks.filter((t) => t.kind === kind && !t.locked);
  for (const t of tracks) {
    const start = resolveFreeStart(project, t.id, '', at, duration);
    if (start != null) return { trackId: t.id, start };
  }
  return null;
}
