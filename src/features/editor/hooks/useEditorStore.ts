import { create } from "zustand";
import { temporal } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createId, clamp } from "@/lib/utils";
import { LIMITS } from "@/config/limits";
import { TIMELINE_DEFAULTS, TRACK_KIND_META, DEFAULT_PROJECT_SETTINGS } from "@/config/defaults";
import type { Project, ProjectSettings } from "../types/project";
import type { Track, TrackKind } from "../types/track";
import type {
  Clip,
  KeyframeProperty,
  KeyframeTracks,
  EasingId,
  DrawStroke,
} from "../types/clip";
import type { Marker } from "../types/timeline";
import type { MediaAsset } from "../types/media";
import { readAppSettings } from "@/features/settings/app-settings";
import {
  createClipFromMedia,
  createTextClip,
  createStickerClip,
  createDrawingClip,
  cloneClip,
  migrateTracks,
  findPlacement,
  compatibleTrackKinds,
} from "../lib/clip-operations";
import {
  KEYFRAME_PROPERTIES,
  upsertKeyframe,
  removeKeyframe,
  moveKeyframe,
  setKeyframeEasing,
  setKeyframeValue,
  applyMotionPreset,
} from "../lib/keyframes";
import type { MotionSample } from "../lib/keyframes";
import { samplesToKeyframes } from "../lib/keyframes";
import { splitClip } from "../lib/split-clip";
import { rippleDelete } from "../lib/ripple-delete";
import { timelineDuration, resolveOverlap, snapToFrame } from "../lib/timeline-math";
import type { DrawingToolState } from "../lib/drawing";

export type SaveState = "saved" | "saving" | "dirty";

/** Slice of state captured by the undo/redo history. */
export interface HistorySlice {
  tracks: Track[];
  markers: Marker[];
  inPoint: number | null;
  outPoint: number | null;
}

export interface EditorState extends HistorySlice {
  /* project document */
  projectId: string | null;
  projectName: string;
  createdAt: number;
  settings: ProjectSettings;
  mediaIds: string[];

  /* transient editor state */
  currentTime: number;
  playing: boolean;
  shuttleRate: number;
  loop: boolean;
  pps: number;
  snapping: boolean;
  selection: string[];
  clipboard: Clip[];
  saveState: SaveState;
  snapGuideTime: number | null;
  /** Freehand drawing tool state; null = off. */
  drawMode: DrawingToolState | null;
  /** Live motion recorder armed. */
  motionRecording: boolean;
  /** Bumped to ask the inspector to focus the text editor for the selection. */
  textEditRequest: number;
  /** Easing used for keyframes created from now on. */
  defaultKeyframeEasing: EasingId;
  /** Auto-keyframe: property edits also write a keyframe at the playhead. */
  autoKeyframes: boolean;

  /* actions */
  loadProject: (project: Project) => void;
  resetEditor: () => void;
  setProjectName: (name: string) => void;
  setSettings: (patch: Partial<ProjectSettings>) => void;
  markDirty: () => void;
  setSaveState: (s: SaveState) => void;

  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  setShuttleRate: (r: number) => void;
  toggleLoop: () => void;
  setPps: (pps: number) => void;
  toggleSnapping: () => void;
  setSnapGuide: (t: number | null) => void;
  setDrawMode: (mode: DrawingToolState | null) => void;
  setMotionRecording: (on: boolean) => void;
  requestTextEdit: () => void;
  setDefaultKeyframeEasing: (easing: EasingId) => void;
  toggleAutoKeyframes: () => void;
  setKeyframedValue: (clipId: string, prop: KeyframeProperty, value: number) => void;

  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  addTrack: (kind: TrackKind) => void;
  renameTrack: (id: string, name: string) => void;
  setTrackFlag: (id: string, flag: "muted" | "solo" | "locked" | "hidden", value: boolean) => void;
  deleteTrack: (id: string) => void;
  moveTrack: (id: string, direction: -1 | 1) => void;

  addClipFromMedia: (asset: MediaAsset, opts?: { trackId?: string; time?: number }) => string | null;
  addTextClip: (time?: number) => string | null;
  addStickerClip: (sticker: { type: "emoji" | "shape"; content: string }, time?: number) => string | null;
  appendDrawingStroke: (stroke: DrawStroke) => string | null;
  undoLastStroke: (clipId: string) => void;
  detachAudio: (clipId: string) => boolean;
  updateClip: (id: string, updater: (clip: Clip) => Clip) => void;
  updateSelectedClips: (updater: (clip: Clip) => Clip) => void;
  moveClips: (moves: { clipId: string; trackId: string; start: number }[]) => void;
  removeMediaClips: (mediaId: string) => void;
  splitAtTime: (time: number) => number;
  deleteClips: (ids: string[]) => number;
  rippleDeleteClips: (ids: string[]) => number;
  duplicateSelection: () => number;
  copySelection: () => number;
  pasteAtTime: (time: number) => number;

  /* keyframes */
  setClipKeyframes: (clipId: string, tracks: KeyframeTracks) => void;
  toggleClipKeyframe: (clipId: string, prop: KeyframeProperty, time?: number) => void;
  removeClipKeyframe: (clipId: string, prop: KeyframeProperty, kfId: string) => void;
  moveClipKeyframe: (clipId: string, prop: KeyframeProperty, kfId: string, time: number) => void;
  setClipKeyframeEasing: (clipId: string, prop: KeyframeProperty, kfId: string, easing: EasingId) => void;
  setClipKeyframeValue: (clipId: string, prop: KeyframeProperty, kfId: string, value: number) => void;
  clearClipKeyframes: (clipId: string, prop?: KeyframeProperty) => void;
  applyClipMotionPreset: (clipId: string, presetId: string) => void;
  recordMotionSamples: (clipId: string, samples: MotionSample[], props: KeyframeProperty[]) => void;

  addMarker: (time: number, name?: string) => void;
  addMarkers: (markers: { time: number; name: string }[]) => number;
  renameMarker: (id: string, name: string) => void;
  removeMarker: (id: string) => void;
  setInPoint: (t: number | null) => void;
  setOutPoint: (t: number | null) => void;
  clearInOut: () => void;
}

function makeTrack(kind: TrackKind, index: number): Track {
  return {
    id: createId("track"),
    kind,
    name: `${TRACK_KIND_META[kind].label} ${index}`,
    muted: false,
    solo: false,
    locked: false,
    hidden: false,
    clips: [],
  };
}

function preferredTrackKindOf(kind: Clip["kind"]): TrackKind[] {
  switch (kind) {
    case "audio":
      return ["audio"];
    case "text":
    case "sticker":
      return ["text", "overlay"];
    case "drawing":
      return ["overlay", "text"];
    case "image":
      return ["overlay", "video"];
    default:
      return ["video", "overlay"];
  }
}

function findClip(tracks: Track[], clipId: string): Clip | undefined {
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === clipId) return clip;
    }
  }
  return undefined;
}

const initialDoc = {
  projectId: null as string | null,
  projectName: "",
  createdAt: 0,
  settings: DEFAULT_PROJECT_SETTINGS,
  mediaIds: [] as string[],
  tracks: [] as Track[],
  markers: [] as Marker[],
  inPoint: null as number | null,
  outPoint: null as number | null,
};

const initialTransient = {
  currentTime: 0,
  playing: false,
  shuttleRate: 0,
  loop: false,
  pps: TIMELINE_DEFAULTS.pixelsPerSecond,
  snapping: true,
  selection: [] as string[],
  clipboard: [] as Clip[],
  saveState: "saved" as SaveState,
  snapGuideTime: null as number | null,
  drawMode: null as DrawingToolState | null,
  motionRecording: false,
  textEditRequest: 0,
  defaultKeyframeEasing: "ease-in-out" as EasingId,
  autoKeyframes: false,
};

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      ...initialDoc,
      ...initialTransient,

      loadProject: (project) => {
        // Pause history so loading never becomes an undoable step.
        useEditorStore.temporal.getState().pause();
        set({
          projectId: project.id,
          projectName: project.name,
          createdAt: project.createdAt,
          settings: project.settings,
          mediaIds: project.mediaIds,
          tracks: migrateTracks(project.timeline.tracks),
          markers: project.timeline.markers,
          inPoint: project.timeline.inPoint,
          outPoint: project.timeline.outPoint,
          ...initialTransient,
          snapping: readAppSettings().snapByDefault,
        });
        useEditorStore.temporal.getState().resume();
        useEditorStore.temporal.getState().clear();
      },

      resetEditor: () => {
        useEditorStore.temporal.getState().pause();
        set({ ...initialDoc, ...initialTransient });
        useEditorStore.temporal.getState().resume();
        useEditorStore.temporal.getState().clear();
      },

      setProjectName: (name) => set({ projectName: name, saveState: "dirty" }),
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch }, saveState: "dirty" })),
      markDirty: () => set({ saveState: "dirty" }),
      setSaveState: (saveState) => set({ saveState }),

      setCurrentTime: (t) => {
        const duration = Math.max(timelineDuration(get().tracks), 0);
        set({ currentTime: clamp(t, 0, Math.max(duration, 3600)) });
      },
      setPlaying: (playing) => set({ playing, shuttleRate: playing ? 1 : 0 }),
      togglePlay: () => {
        const { playing } = get();
        set({ playing: !playing, shuttleRate: playing ? 0 : 1 });
      },
      setShuttleRate: (r) => set({ shuttleRate: r, playing: r !== 0 }),
      toggleLoop: () => set((s) => ({ loop: !s.loop })),
      setPps: (pps) =>
        set({
          pps: clamp(pps, TIMELINE_DEFAULTS.minPixelsPerSecond, TIMELINE_DEFAULTS.maxPixelsPerSecond),
        }),
      toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
      setSnapGuide: (snapGuideTime) => set({ snapGuideTime }),
      setDrawMode: (drawMode) => set({ drawMode }),
      setMotionRecording: (motionRecording) => set({ motionRecording }),
      requestTextEdit: () => set((s) => ({ textEditRequest: s.textEditRequest + 1 })),
      setDefaultKeyframeEasing: (defaultKeyframeEasing) => set({ defaultKeyframeEasing }),
      toggleAutoKeyframes: () => set((s) => ({ autoKeyframes: !s.autoKeyframes })),

      select: (ids, additive = false) =>
        set((s) => ({
          selection: additive ? Array.from(new Set([...s.selection, ...ids])) : ids,
        })),
      clearSelection: () => set({ selection: [] }),
      selectAll: () =>
        set((s) => ({ selection: s.tracks.flatMap((t) => t.clips.map((c) => c.id)) })),

      addTrack: (kind) =>
        set((s) => {
          if (s.tracks.length >= LIMITS.maxTracks) return s;
          const count = s.tracks.filter((t) => t.kind === kind).length + 1;
          const track = makeTrack(kind, count);
          const tracks =
            kind === "audio" ? [...s.tracks, track] : [track, ...s.tracks];
          return { tracks, saveState: "dirty" };
        }),

      renameTrack: (id, name) =>
        set((s) => ({
          tracks: s.tracks.map((t) => (t.id === id ? { ...t, name } : t)),
          saveState: "dirty",
        })),

      setTrackFlag: (id, flag, value) =>
        set((s) => ({
          tracks: s.tracks.map((t) => (t.id === id ? { ...t, [flag]: value } : t)),
          saveState: "dirty",
        })),

      deleteTrack: (id) =>
        set((s) => ({
          tracks: s.tracks.filter((t) => t.id !== id),
          selection: s.selection.filter(
            (cid) => !s.tracks.find((t) => t.id === id)?.clips.some((c) => c.id === cid)
          ),
          saveState: "dirty",
        })),

      moveTrack: (id, direction) =>
        set((s) => {
          const index = s.tracks.findIndex((t) => t.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= s.tracks.length) return s;
          const tracks = [...s.tracks];
          const [moved] = tracks.splice(index, 1);
          tracks.splice(target, 0, moved!);
          return { tracks, saveState: "dirty" };
        }),

      addClipFromMedia: (asset, opts) => {
        const s = get();
        const time = snapToFrame(opts?.time ?? s.currentTime, s.settings.fps);
        const clip = createClipFromMedia(asset, time);

        // Prefer the requested track if the slot is free.
        let place: { trackId: string; start: number } | null = null;
        if (opts?.trackId) {
          const track = s.tracks.find((t) => t.id === opts.trackId);
          if (track && !track.locked) {
            const start = resolveOverlap(track.clips, new Set(), time, clip.duration);
            place = { trackId: track.id, start };
          }
        }
        if (!place) place = findPlacement(s.tracks, clip, time);
        if (!place) return null;
        clip.start = snapToFrame(place.start, s.settings.fps);

        const trackId = place.trackId;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
              : t
          ),
          mediaIds: state.mediaIds.includes(asset.id)
            ? state.mediaIds
            : [...state.mediaIds, asset.id],
          selection: [clip.id],
          saveState: "dirty",
        }));
        // Keep the playhead inside the new clip so it's immediately visible.
        const st = get();
        if (st.currentTime < clip.start || st.currentTime >= clip.start + clip.duration) {
          st.setCurrentTime(clip.start + Math.min(0.15, clip.duration / 2));
        }
        return clip.id;
      },

      addTextClip: (time) => {
        const s = get();
        const at = snapToFrame(time ?? s.currentTime, s.settings.fps);
        const clip = createTextClip(at);
        const place = findPlacement(s.tracks, clip, at);
        if (!place) return null;
        clip.start = snapToFrame(place.start, s.settings.fps);
        const trackId = place.trackId;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
              : t
          ),
          selection: [clip.id],
          saveState: "dirty",
        }));
        // Nudge the playhead inside the clip so the text is visible right away.
        const st = get();
        if (st.currentTime < clip.start || st.currentTime >= clip.start + clip.duration) {
          st.setCurrentTime(clip.start + Math.min(0.15, clip.duration / 2));
        }
        return clip.id;
      },

      addStickerClip: (sticker, time) => {
        const s = get();
        const at = snapToFrame(time ?? s.currentTime, s.settings.fps);
        const clip = createStickerClip(at, { type: sticker.type, content: sticker.content });
        const place = findPlacement(s.tracks, clip, at);
        if (!place) return null;
        clip.start = snapToFrame(place.start, s.settings.fps);
        const trackId = place.trackId;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
              : t
          ),
          selection: [clip.id],
          saveState: "dirty",
        }));
        const st = get();
        if (st.currentTime < clip.start || st.currentTime >= clip.start + clip.duration) {
          st.setCurrentTime(clip.start + Math.min(0.15, clip.duration / 2));
        }
        return clip.id;
      },

      appendDrawingStroke: (stroke) => {
        const s = get();
        const time = snapToFrame(s.currentTime, s.settings.fps);
        // Append to a drawing clip already active at the playhead.
        for (const track of s.tracks) {
          for (const clip of track.clips) {
            if (clip.kind === "drawing" && time >= clip.start && time < clip.start + clip.duration) {
              set((state) => ({
                tracks: state.tracks.map((t) =>
                  t.id === track.id
                    ? {
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === clip.id && c.drawing
                            ? {
                                ...c,
                                duration: Math.max(c.duration, stroke.points.length > 0 ? stroke.points[stroke.points.length - 1]!.t + 0.4 : c.duration),
                                drawing: { strokes: [...c.drawing.strokes, stroke] },
                              }
                            : c
                        ),
                      }
                    : t
                ),
                saveState: "dirty",
              }));
              return clip.id;
            }
          }
        }
        // Otherwise start a new drawing clip at the playhead.
        const clip = createDrawingClip(time, [stroke]);
        const place = findPlacement(s.tracks, clip, time);
        if (!place) return null;
        const trackId = place.trackId;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
              : t
          ),
          selection: [clip.id],
          saveState: "dirty",
        }));
        return clip.id;
      },

      undoLastStroke: (clipId) =>
        set((s) => ({
          tracks: s.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId && c.drawing && c.drawing.strokes.length > 0
                ? { ...c, drawing: { strokes: c.drawing.strokes.slice(0, -1) } }
                : c
            ),
          })),
          saveState: "dirty",
        })),

      detachAudio: (clipId) => {
        const s = get();
        let source: Clip | undefined;
        let sourceTrack: Track | undefined;
        for (const track of s.tracks) {
          for (const clip of track.clips) {
            if (clip.id === clipId) {
              source = clip;
              sourceTrack = track;
            }
          }
        }
        if (!source || !sourceTrack || source.kind !== "video" || !source.mediaId) return false;

        const audioClip: Clip = cloneClip(source);
        audioClip.kind = "audio";
        audioClip.label = `${source.label} (audio)`;
        audioClip.transform = { ...audioClip.transform, opacity: 0 };

        const place = findPlacement(s.tracks, audioClip, source.start);
        if (!place) return false;
        audioClip.start = place.start;
        if (Math.abs(audioClip.start - source.start) > 0.01) {
          // Could not align; still detach but note the offset via inOffset shift.
          const delta = (audioClip.start - source.start) * audioClip.speed;
          audioClip.inOffset = Math.max(0, audioClip.inOffset + delta);
          audioClip.duration = Math.max(0.05, audioClip.duration - delta);
        }
        const trackId = place.trackId;

        set((state) => ({
          tracks: state.tracks.map((t) => {
            if (t.id === trackId) {
              return {
                ...t,
                clips: [...t.clips, audioClip].sort((a, b) => a.start - b.start),
              };
            }
            if (t.id === sourceTrack!.id) {
              return {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === source!.id ? { ...c, audio: { ...c.audio, muted: true } } : c
                ),
              };
            }
            return t;
          }),
          selection: [audioClip.id],
          saveState: "dirty",
        }));
        return true;
      },

      updateClip: (id, updater) =>
        set((s) => ({
          tracks: s.tracks.map((t) =>
            t.clips.some((c) => c.id === id)
              ? { ...t, clips: t.clips.map((c) => (c.id === id ? updater(c) : c)) }
              : t
          ),
          saveState: "dirty",
        })),

      updateSelectedClips: (updater) =>
        set((s) => {
          const selected = new Set(s.selection);
          return {
            tracks: s.tracks.map((t) =>
              t.clips.some((c) => selected.has(c.id))
                ? { ...t, clips: t.clips.map((c) => (selected.has(c.id) ? updater(c) : c)) }
                : t
            ),
            saveState: "dirty",
          };
        }),

      moveClips: (moves) =>
        set((s) => {
          const moveMap = new Map(moves.map((m) => [m.clipId, m]));
          const moving = new Map<string, Clip>();
          for (const track of s.tracks) {
            for (const clip of track.clips) {
              if (moveMap.has(clip.id)) moving.set(clip.id, clip);
            }
          }
          const tracks = s.tracks.map((track) => {
            let clips = track.clips.filter((c) => !moveMap.has(c.id));
            for (const [clipId, move] of moveMap) {
              if (move.trackId !== track.id) continue;
              const clip = moving.get(clipId);
              if (!clip) continue;
              clips = [...clips, { ...clip, start: Math.max(0, move.start) }];
            }
            return { ...track, clips: clips.sort((a, b) => a.start - b.start) };
          });
          return { tracks, saveState: "dirty" };
        }),

      removeMediaClips: (mediaId) =>
        set((s) => ({
          tracks: s.tracks.map((t) => ({
            ...t,
            clips: t.clips.filter((c) => c.mediaId !== mediaId),
          })),
          mediaIds: s.mediaIds.filter((id) => id !== mediaId),
          saveState: "dirty",
        })),

      splitAtTime: (time) => {
        const s = get();
        const targets =
          s.selection.length > 0
            ? s.selection
            : s.tracks.flatMap((t) =>
                t.locked ? [] : t.clips.filter((c) => time > c.start && time < c.start + c.duration).map((c) => c.id)
              );
        let count = 0;
        const tracks = s.tracks.map((track) => {
          if (track.locked) return track;
          let clips = track.clips;
          for (const id of targets) {
            const clip = clips.find((c) => c.id === id);
            if (!clip) continue;
            const parts = splitClip(clip, time);
            if (!parts) continue;
            clips = clips.filter((c) => c.id !== id).concat(parts);
            count++;
          }
          return count > 0 ? { ...track, clips: clips.sort((a, b) => a.start - b.start) } : track;
        });
        if (count > 0) set({ tracks, saveState: "dirty", selection: [] });
        return count;
      },

      deleteClips: (ids) => {
        const idSet = new Set(ids);
        let count = 0;
        set((s) => {
          const tracks = s.tracks.map((t) => {
            if (t.locked) return t;
            const kept = t.clips.filter((c) => {
              if (idSet.has(c.id)) {
                count++;
                return false;
              }
              return true;
            });
            return kept.length === t.clips.length ? t : { ...t, clips: kept };
          });
          return {
            tracks,
            selection: s.selection.filter((id) => !idSet.has(id)),
            saveState: "dirty",
          };
        });
        return count;
      },

      rippleDeleteClips: (ids) => {
        const idSet = new Set(ids);
        let count = 0;
        set((s) => {
          for (const t of s.tracks) {
            if (t.locked) continue;
            count += t.clips.filter((c) => idSet.has(c.id)).length;
          }
          const unlocked = new Set(
            s.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.map((c) => c.id))
          );
          const deletable = new Set([...idSet].filter((id) => unlocked.has(id)));
          return {
            tracks: rippleDelete(s.tracks, deletable),
            selection: s.selection.filter((id) => !idSet.has(id)),
            saveState: "dirty",
          };
        });
        return count;
      },

      duplicateSelection: () => {
        const s = get();
        if (s.selection.length === 0) return 0;
        const selected = new Set(s.selection);
        const newIds: string[] = [];
        const tracks = s.tracks.map((track) => {
          const dupes: Clip[] = [];
          for (const clip of track.clips) {
            if (!selected.has(clip.id)) continue;
            const copy = cloneClip(clip);
            copy.start = resolveOverlap(
              [...track.clips, ...dupes],
              new Set(),
              clip.start + clip.duration,
              clip.duration
            );
            dupes.push(copy);
            newIds.push(copy.id);
          }
          return dupes.length > 0
            ? { ...track, clips: [...track.clips, ...dupes].sort((a, b) => a.start - b.start) }
            : track;
        });
        set({ tracks, selection: newIds, saveState: "dirty" });
        return newIds.length;
      },

      copySelection: () => {
        const s = get();
        if (s.selection.length === 0) return 0;
        const selected = new Set(s.selection);
        const clips: Clip[] = [];
        for (const track of s.tracks) {
          for (const clip of track.clips) {
            if (selected.has(clip.id)) clips.push(structuredClone(clip));
          }
        }
        const minStart = Math.min(...clips.map((c) => c.start));
        const normalized = clips.map((c) => ({ ...c, start: c.start - minStart }));
        set({ clipboard: normalized });
        return normalized.length;
      },

      pasteAtTime: (time) => {
        const s = get();
        if (s.clipboard.length === 0) return 0;
        const at = snapToFrame(time, s.settings.fps);
        const newIds: string[] = [];
        let tracks = s.tracks;
        for (const clip of s.clipboard) {
          const copy = cloneClip(clip);
          copy.start = at + clip.start;
          newIds.push(copy.id);
          const kinds = [...preferredTrackKindOf(copy.kind), ...compatibleTrackKinds(copy.kind)];
          let target: Track | undefined;
          for (const kind of kinds) {
            target = tracks.find((t) => t.kind === kind && !t.locked && !(copy.kind !== "audio" && t.hidden));
            if (target) break;
          }
          if (!target) continue;
          copy.start = resolveOverlap(target.clips, new Set(), copy.start, copy.duration);
          tracks = tracks.map((t) =>
            t.id === target!.id
              ? { ...t, clips: [...t.clips, copy].sort((a, b) => a.start - b.start) }
              : t
          );
        }
        set({ tracks, selection: newIds, saveState: "dirty" });
        return newIds.length;
      },

      /* ---------------- keyframes ---------------- */

      setClipKeyframes: (clipId, tracks) =>
        set((s) => ({
          tracks: s.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    keyframes:
                      tracks && Object.keys(tracks).length > 0 ? tracks : undefined,
                  }
                : c
            ),
          })),
          saveState: "dirty",
        })),

      toggleClipKeyframe: (clipId, prop, time) => {
        const s = get();
        const clip = findClip(s.tracks, clipId);
        if (!clip) return;
        const at = snapToFrame(time ?? s.currentTime, s.settings.fps);
        if (at < clip.start || at > clip.start + clip.duration) return;
        const existing = clip.keyframes?.[prop] ?? [];
        const tol = 0.5 / Math.max(1, s.settings.fps);
        const hit = existing.find((k) => Math.abs(k.time - at) <= tol);
        const next = hit
          ? removeKeyframe(clip, prop, hit.id)
          : upsertKeyframe(clip, prop, at, s.settings.fps, undefined, s.defaultKeyframeEasing);
        get().setClipKeyframes(clipId, next);
      },

      removeClipKeyframe: (clipId, prop, kfId) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        get().setClipKeyframes(clipId, removeKeyframe(clip, prop, kfId));
      },

      moveClipKeyframe: (clipId, prop, kfId, time) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        get().setClipKeyframes(clipId, moveKeyframe(clip, prop, kfId, time));
      },

      setClipKeyframeEasing: (clipId, prop, kfId, easing) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        get().setClipKeyframes(clipId, setKeyframeEasing(clip, prop, kfId, easing));
      },

      setClipKeyframeValue: (clipId, prop, kfId, value) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        get().setClipKeyframes(clipId, setKeyframeValue(clip, prop, kfId, value));
      },

      clearClipKeyframes: (clipId, prop) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        if (!prop) {
          get().setClipKeyframes(clipId, {});
        } else {
          const next: KeyframeTracks = { ...clip.keyframes };
          delete next[prop];
          get().setClipKeyframes(clipId, next);
        }
      },

      applyClipMotionPreset: (clipId, presetId) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip) return;
        get().setClipKeyframes(clipId, applyMotionPreset(clip, presetId));
      },

      recordMotionSamples: (clipId, samples, props) => {
        const clip = findClip(get().tracks, clipId);
        if (!clip || samples.length === 0) return;
        const recorded = samplesToKeyframes(samples, props);
        // Keep untouched tracks from the clip.
        const merged: KeyframeTracks = { ...clip.keyframes };
        for (const [prop, kfs] of Object.entries(recorded)) {
          merged[prop as KeyframeProperty] = kfs;
        }
        // Reset the static transform to the first sample so gaps line up.
        const first = samples[0]!;
        set((s) => ({
          tracks: s.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    transform: { ...c.transform, x: first.x, y: first.y, scale: first.scale, rotation: first.rotation, opacity: first.opacity },
                    keyframes: merged,
                  }
                : c
            ),
          })),
          saveState: "dirty",
        }));
      },

      setKeyframedValue: (clipId, prop, value) => {
        const s = get();
        const clip = findClip(s.tracks, clipId);
        if (!clip) return;
        const def = KEYFRAME_PROPERTIES[prop];
        const draft: Clip = { ...clip };
        def.apply(draft, value);
        if (s.autoKeyframes) {
          const at = snapToFrame(s.currentTime, s.settings.fps);
          if (at >= clip.start && at <= clip.start + clip.duration) {
            draft.keyframes = upsertKeyframe(
              draft,
              prop,
              at,
              s.settings.fps,
              value,
              s.defaultKeyframeEasing
            );
          }
        }
        get().updateClip(clipId, () => draft);
      },

      addMarkers: (markers) => {
        if (markers.length === 0) return 0;
        set((s) => ({
          markers: [
            ...s.markers,
            ...markers.map((m) => ({
              id: createId("marker"),
              time: snapToFrame(Math.max(0, m.time), s.settings.fps),
              name: m.name,
            })),
          ].sort((a, b) => a.time - b.time),
          saveState: "dirty",
        }));
        return markers.length;
      },

      addMarker: (time, name) =>
        set((s) => ({
          markers: [
            ...s.markers,
            {
              id: createId("marker"),
              time: snapToFrame(time, s.settings.fps),
              name: name ?? `Marker ${s.markers.length + 1}`,
            },
          ].sort((a, b) => a.time - b.time),
          saveState: "dirty",
        })),

      renameMarker: (id, name) =>
        set((s) => ({
          markers: s.markers.map((m) => (m.id === id ? { ...m, name } : m)),
          saveState: "dirty",
        })),

      removeMarker: (id) =>
        set((s) => ({ markers: s.markers.filter((m) => m.id !== id), saveState: "dirty" })),

      setInPoint: (t) => set({ inPoint: t, saveState: "dirty" }),
      setOutPoint: (t) => set({ outPoint: t, saveState: "dirty" }),
      clearInOut: () => set({ inPoint: null, outPoint: null, saveState: "dirty" }),
    }),
    {
      limit: LIMITS.maxUndoDepth,
      partialize: (state): HistorySlice => ({
        tracks: state.tracks,
        markers: state.markers,
        inPoint: state.inPoint,
        outPoint: state.outPoint,
      }),
      equality: (pastState, currentState) =>
        pastState.tracks === currentState.tracks &&
        pastState.markers === currentState.markers &&
        pastState.inPoint === currentState.inPoint &&
        pastState.outPoint === currentState.outPoint,
    }
  )
);

/** Convenience selector hook with shallow equality. */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStoreWithEqualityFn(useEditorStore, selector, shallow);
}

/** Serialize the store back into a Project document. */
export function snapshotProject(): Project | null {
  const s = useEditorStore.getState();
  if (!s.projectId) return null;
  return {
    id: s.projectId,
    name: s.projectName,
    createdAt: s.createdAt,
    updatedAt: Date.now(),
    settings: s.settings,
    mediaIds: s.mediaIds,
    timeline: {
      tracks: s.tracks,
      markers: s.markers,
      inPoint: s.inPoint,
      outPoint: s.outPoint,
    },
  };
}
