import { create } from "zustand";
import { temporal } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createId, clamp } from "@/lib/utils";
import { LIMITS } from "@/config/limits";
import { TIMELINE_DEFAULTS, TRACK_KIND_META, DEFAULT_PROJECT_SETTINGS } from "@/config/defaults";
import type { Project, ProjectSettings } from "../types/project";
import type { Track, TrackKind } from "../types/track";
import type { Clip } from "../types/clip";
import type { Marker } from "../types/timeline";
import type { MediaAsset } from "../types/media";
import { readAppSettings } from "@/features/settings/app-settings";
import { createClipFromMedia, createTextClip, cloneClip } from "../lib/clip-operations";
import { splitClip } from "../lib/split-clip";
import { rippleDelete } from "../lib/ripple-delete";
import { timelineDuration, resolveOverlap, snapToFrame } from "../lib/timeline-math";

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

  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;

  addTrack: (kind: TrackKind) => void;
  renameTrack: (id: string, name: string) => void;
  setTrackFlag: (id: string, flag: "muted" | "solo" | "locked" | "hidden", value: boolean) => void;
  deleteTrack: (id: string) => void;
  moveTrack: (id: string, direction: -1 | 1) => void;

  addClipFromMedia: (asset: MediaAsset, opts?: { trackId?: string; time?: number }) => string | null;
  addTextClip: (time?: number) => string;
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

  addMarker: (time: number, name?: string) => void;
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

function preferredTrackKind(clipKind: Clip["kind"]): TrackKind[] {
  switch (clipKind) {
    case "audio":
      return ["audio"];
    case "text":
      return ["text", "overlay"];
    case "image":
      return ["overlay", "video"];
    default:
      return ["video", "overlay"];
  }
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
          tracks: project.timeline.tracks,
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

        let track = opts?.trackId ? s.tracks.find((t) => t.id === opts.trackId) : undefined;
        if (!track || track.locked) {
          const kinds = preferredTrackKind(clip.kind);
          for (const kind of kinds) {
            track = s.tracks.find((t) => t.kind === kind && !t.locked);
            if (track) break;
          }
        }
        if (!track) return null;

        clip.start = resolveOverlap(track.clips, new Set(), time, clip.duration);
        const trackId = track.id;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) } : t
          ),
          mediaIds: state.mediaIds.includes(asset.id)
            ? state.mediaIds
            : [...state.mediaIds, asset.id],
          selection: [clip.id],
          saveState: "dirty",
        }));
        return clip.id;
      },

      addTextClip: (time) => {
        const s = get();
        const at = snapToFrame(time ?? s.currentTime, s.settings.fps);
        const clip = createTextClip(at);
        let track = s.tracks.find((t) => t.kind === "text" && !t.locked);
        if (!track) track = s.tracks.find((t) => t.kind === "overlay" && !t.locked);
        if (!track) {
          const created = makeTrack("text", s.tracks.filter((t) => t.kind === "text").length + 1);
          created.clips = [clip];
          set((state) => ({
            tracks: [created, ...state.tracks],
            selection: [clip.id],
            saveState: "dirty",
          }));
          return clip.id;
        }
        clip.start = resolveOverlap(track.clips, new Set(), at, clip.duration);
        const trackId = track.id;
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) } : t
          ),
          selection: [clip.id],
          saveState: "dirty",
        }));
        return clip.id;
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
          const kinds = preferredTrackKind(copy.kind);
          let target: Track | undefined;
          for (const kind of kinds) {
            target = tracks.find((t) => t.kind === kind && !t.locked);
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
