import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EDITOR, TIMELINE } from '@/config/defaults';
import { clamp, snapToFrame } from '@/lib/time';
import { cloneProject, clipEnd, projectDuration, type Clip, type Project, type Track, type TrackKind } from '@/features/projects/types';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { ProgramRenderer } from '@/features/editor/lib/renderer';
import * as ops from '@/features/editor/lib/timelineOps';

/**
 * Editor store: playback state (frame-rate updates) is kept in a separate
 * context from the project/actions state so 60 fps playhead motion does not
 * re-render heavy panels.
 */

export type Tool = 'select' | 'razor';
export type SaveIndicator = 'saved' | 'saving' | 'error' | 'off';

interface PlaybackState {
  playhead: number;
  playing: boolean;
  rate: number;
  loop: boolean;
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
}

export interface EditorApi {
  project: Project;
  selection: string | null;
  selectedClip: Clip | undefined;
  zoom: number; // px per second
  snapping: boolean;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  historyLabel: string | null;
  clipboard: Clip | null;
  renderer: ProgramRenderer | null;

  // project-level (no history)
  setProject: (p: Project) => void;
  patchProject: (patch: Partial<Project>) => void;

  // history
  mutate: (label: string, fn: (p: Project) => Project) => void;
  commit: (label: string) => void;
  undo: () => void;
  redo: () => void;

  // clips
  updateClip: (id: string, patch: Partial<Clip>, options?: { commit?: boolean; label?: string }) => void;
  splitAtPlayhead: (clipId?: string) => number;
  deleteSelected: (ripple?: boolean) => void;
  deleteClip: (id: string, ripple?: boolean) => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  addMediaClip: (mediaId: string, opts?: { trackId?: string; at?: number }) => Clip | undefined;
  addTextClip: () => Clip | undefined;
  select: (id: string | null) => void;

  // tracks
  addTrack: (kind: TrackKind) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>, label?: string) => void;

  // timeline view
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: (viewportPx: number) => void;
  setTool: (t: Tool) => void;
  setSnapping: (v: boolean) => void;

  // playback
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number, options?: { frameSnap?: boolean }) => void;
  nudge: (deltaSeconds: number) => void;
  shuttle: (direction: 1 | -1) => void;
  stop: () => void;
  setLoop: (v: boolean) => void;
  markIn: () => void;
  markOut: () => void;
  clearRange: () => void;

  // renderer bridge
  registerRenderer: (r: ProgramRenderer | null) => void;
}

const PlaybackContext = createContext<PlaybackState | null>(null);
const ApiContext = createContext<EditorApi | null>(null);

export function usePlayback(): PlaybackState {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback outside editor');
  return ctx;
}

export function useEditor(): EditorApi {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useEditor outside editor');
  return ctx;
}

interface HistoryEntry {
  project: Project;
  label: string;
}

export function EditorProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const workspace = useWorkspace();

  const [project, setProjectState] = useState<Project>(
    () =>
      workspace.getProject(projectId) ?? {
        id: projectId,
        name: 'Loading…',
        createdAt: 0,
        updatedAt: 0,
        width: 1920,
        height: 1080,
        fps: 30,
        background: '#000000',
        tracks: [],
        clips: [],
      },
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selection, setSelection] = useState<string | null>(null);
  const [zoom, setZoomState] = useState<number>(TIMELINE.defaultZoom);
  const [snapping, setSnapping] = useState(true);
  const [tool, setTool] = useState<Tool>('select');
  const [clipboard, setClipboard] = useState<Clip | null>(null);

  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoopState] = useState(false);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);

  const rendererRef = useRef<ProgramRenderer | null>(null);
  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  const loopRef = useRef(false);
  const inRef = useRef<number | null>(null);
  const outRef = useRef<number | null>(null);
  const projectRef = useRef(project);
  const lastFrameTime = useRef(performance.now());
  const saveTimer = useRef<number | null>(null);
  const autosaveOn = workspace.settings.autosave;

  // ---- sync refs used by the rAF loop ----
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    inRef.current = inPoint;
    outRef.current = outPoint;
  }, [inPoint, outPoint]);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // ---- load project when the workspace has it ----
  useEffect(() => {
    const loaded = workspace.getProject(projectId);
    if (loaded) {
      setProjectState(loaded);
      projectRef.current = loaded;
      resetHistory(loaded, 'Opened');
      setSelection(null);
      setPlayhead(0);
      playheadRef.current = 0;
      setInPoint(null);
      setOutPoint(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workspace.ready]);

  // ---- renderer wiring ----
  const registerRenderer = useCallback((r: ProgramRenderer | null) => {
    rendererRef.current = r;
    if (r) r.setProject(projectRef.current);
  }, []);

  useEffect(() => {
    rendererRef.current?.setProject(project);
  }, [project]);

  // ---- the render + playback loop ----
  useEffect(() => {
    let raf = 0;
    let lastBeat = performance.now();
    const beat = () => { lastBeat = performance.now(); };
    const frame = () => {
      beat();
      // performance.now() is used instead of the rAF timestamp: some embedded
      // compositors serve frames with stale timestamps while a canvas capture
      // pipeline is active, which would freeze the playhead.
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastFrameTime.current) / 1000);
      lastFrameTime.current = now;
      const isPlaying = playingRef.current;
      if (isPlaying) {
        let next = playheadRef.current + dt * rateRef.current;
        const dur = projectDuration(projectRef.current);
        const loopIn = inRef.current;
        const loopOut = outRef.current;
        const hasRange = loopIn != null && loopOut != null && loopOut > loopIn;
        if (loopRef.current) {
          const end = hasRange ? (loopOut as number) : dur;
          const from = hasRange ? (loopIn as number) : 0;
          if (end > 0 && next >= end - 1e-6) next = from;
          if (next < 0) next = end;
        } else if (dur > 0 && next >= dur) {
          // Non-loop playback runs to the end of the sequence (out point only
          // bounds looping and range exports).
          next = dur;
          setPlaying(false);
          playingRef.current = false;
          rendererRef.current?.pauseAll();
        }
        playheadRef.current = Math.max(0, next);
        setPlayhead(playheadRef.current);
      }
      rendererRef.current?.tick(playheadRef.current, isPlaying, rateRef.current);
    };
    const step = () => {
      raf = requestAnimationFrame(step);
      frame();
    };
    raf = requestAnimationFrame(step);
    // Watchdog: a page can stop issuing animation frames entirely (software
    // compositors during canvas capture, occluded windows, power saving). Timers
    // keep firing in those states, so while playing, a stalled rAF loop is
    // rescued by stepping from this interval. Both drivers share one clock, so
    // time advances exactly once no matter which runs.
    const watchdog = window.setInterval(() => {
      if (playingRef.current && performance.now() - lastBeat > 100) frame();
    }, 16);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(watchdog);
    };
  }, []);

  // ---- autosave ----
  const persist = useCallback(
    (p: Project) => {
      if (!autosaveOn) return;
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        workspace.updateProject(p);
      }, EDITOR.autosaveDebounceMs);
    },
    [autosaveOn, workspace],
  );
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Save on unmount / before unload.
  useEffect(() => {
    const flush = () => {
      if (autosaveOn && projectRef.current.updatedAt > 0 && projectRef.current.name !== 'Loading…') {
        workspace.updateProject(projectRef.current, { silent: false });
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveOn]);

  // ---- history (refs mirror state so undo/redo stay consistent) ----
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);

  const pushHistory = useCallback((next: Project, label: string) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push({ project: cloneProject(next), label });
    const capped = trimmed.slice(-EDITOR.historyLimit);
    historyRef.current = capped;
    historyIndexRef.current = capped.length - 1;
    setHistory(capped);
    setHistoryIndex(capped.length - 1);
  }, []);

  const resetHistory = useCallback((p: Project, label: string) => {
    const entry = { project: cloneProject(p), label };
    historyRef.current = [entry];
    historyIndexRef.current = 0;
    setHistory([entry]);
    setHistoryIndex(0);
  }, []);

  const restore = useCallback(
    (index: number) => {
      const entry = historyRef.current[index];
      if (!entry) return;
      historyIndexRef.current = index;
      setHistoryIndex(index);
      const restored = cloneProject(entry.project);
      setProjectState(restored);
      projectRef.current = restored;
      setSelection((sel) => (sel && restored.clips.some((c) => c.id === sel) ? sel : null));
      persistRef.current(restored);
    },
    [],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) restore(historyIndexRef.current - 1);
  }, [restore]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) restore(historyIndexRef.current + 1);
  }, [restore]);

  const setProjectInternal = useCallback(
    (p: Project, label: string | null) => {
      const stamped = { ...p, updatedAt: Date.now() };
      setProjectState(stamped);
      projectRef.current = stamped;
      if (label) pushHistory(stamped, label);
      persist(stamped);
    },
    [persist, pushHistory],
  );

  const mutate = useCallback(
    (label: string, fn: (p: Project) => Project) => {
      setProjectInternal(fn(projectRef.current), label);
    },
    [setProjectInternal],
  );

  const commit = useCallback(
    (label: string) => {
      pushHistory(projectRef.current, label);
      persist(projectRef.current);
    },
    [persist, pushHistory],
  );

  // ---- playback actions ----
  const play = useCallback(() => {
    rendererRef.current?.userGesture();
    const dur = projectDuration(projectRef.current);
    if (dur > 0 && playheadRef.current >= dur - 1e-6) {
      playheadRef.current = 0;
      setPlayhead(0);
    }
    setRate((r) => (r === 0 ? 1 : Math.abs(r)));
    rateRef.current = Math.abs(rateRef.current) || 1;
    setPlaying(true);
    playingRef.current = true;
  }, []);

  const pause = useCallback(() => {
    setPlaying(false);
    playingRef.current = false;
    rendererRef.current?.pauseAll();
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const seek = useCallback((t: number, options?: { frameSnap?: boolean }) => {
    const p = projectRef.current;
    const dur = projectDuration(p);
    let next = Math.max(0, Math.min(t, Math.max(dur, t)));
    if (options?.frameSnap !== false) next = snapToFrame(next, p.fps);
    playheadRef.current = next;
    setPlayhead(next);
  }, []);

  const nudge = useCallback((delta: number) => {
    seek(playheadRef.current + delta);
  }, [seek]);

  const shuttle = useCallback((direction: 1 | -1) => {
    const rates: number[] = [...EDITOR.shuttleRates];
    const cur = rateRef.current;
    const mag = Math.abs(cur) < 0.01 ? 0 : rates.indexOf(Math.abs(cur));
    const currentIdx = mag === -1 ? 0 : mag;
    if (direction === 1) {
      if (cur > 0) {
        const next = rates[Math.min(rates.length - 1, currentIdx + 1)];
        setRate(next);
        rateRef.current = next;
      } else {
        // reversing from reverse → step down toward 1x
        const next = currentIdx > 0 ? -rates[currentIdx - 1] : 1;
        setRate(next);
        rateRef.current = next;
        if (next > 0) {
          setPlaying(true);
          playingRef.current = true;
        }
      }
    } else {
      if (cur < 0) {
        const next = -rates[Math.min(rates.length - 1, currentIdx + 1)];
        setRate(next);
        rateRef.current = next;
      } else {
        const next = currentIdx > 0 ? rates[currentIdx - 1] : -1;
        setRate(next);
        rateRef.current = next;
        if (next < 0) {
          setPlaying(true);
          playingRef.current = true;
        }
      }
    }
    rendererRef.current?.userGesture();
    setPlaying(true);
    playingRef.current = true;
  }, []);

  const stop = useCallback(() => {
    setRate(1);
    rateRef.current = 1;
    pause();
    seek(0);
  }, [pause, seek]);

  // ---- timeline view ----
  const setZoom = useCallback((z: number) => {
    setZoomState(clamp(z, TIMELINE.minZoom, TIMELINE.maxZoom));
  }, []);
  const zoomIn = useCallback(() => setZoomState((z) => clamp(z * 1.4, TIMELINE.minZoom, TIMELINE.maxZoom)), []);
  const zoomOut = useCallback(() => setZoomState((z) => clamp(z / 1.4, TIMELINE.minZoom, TIMELINE.maxZoom)), []);
  const zoomFit = useCallback(
    (viewportPx: number) => {
      const dur = Math.max(1, projectDuration(projectRef.current));
      setZoom((dur > 0 ? viewportPx / dur : TIMELINE.defaultZoom));
    },
    [setZoom],
  );

  // ---- clip actions ----
  const select = useCallback((id: string | null) => setSelection(id), []);

  const updateClip = useCallback(
    (id: string, patch: Partial<Clip>, options?: { commit?: boolean; label?: string }) => {
      const p = projectRef.current;
      const next = ops.withClip(p, id, patch);
      if (options?.commit) {
        setProjectInternal(next, options.label ?? 'Edit clip');
      } else {
        setProjectState(next);
        projectRef.current = next;
        persist(next);
      }
    },
    [persist, setProjectInternal],
  );

  const splitAtPlayhead = useCallback(
    (clipId?: string) => {
      let count = 0;
      mutate('Split', (p) => {
        const res = ops.splitClipsAt(p, playheadRef.current, clipId);
        count = res.count;
        return res.project;
      });
      return count;
    },
    [mutate],
  );

  const deleteClip = useCallback(
    (id: string, ripple = false) => {
      mutate(ripple ? 'Ripple delete' : 'Delete clip', (p) => ops.removeClip(p, id, ripple));
      setSelection((sel) => (sel === id ? null : sel));
    },
    [mutate],
  );

  const deleteSelected = useCallback(
    (ripple = false) => {
      if (!selection) return;
      deleteClip(selection, ripple);
    },
    [deleteClip, selection],
  );

  const duplicateSelected = useCallback(() => {
    if (!selection) return;
    mutate('Duplicate clip', (p) => {
      const src = p.clips.find((c) => c.id === selection);
      if (!src) return p;
      const res = ops.duplicateClip(p, selection, clipEnd(src));
      if (res.clip) setSelection(res.clip.id);
      return res.project;
    });
  }, [mutate, selection]);

  const copySelected = useCallback(() => {
    const clip = projectRef.current.clips.find((c) => c.id === selection);
    if (clip) setClipboard({ ...clip, text: clip.text ? { ...clip.text } : undefined });
  }, [selection]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) return;
    mutate('Paste clip', (p) => {
      const kind: TrackKind = clipboard.kind === 'audio' ? 'audio' : 'video';
      let trackId = clipboard.trackId;
      if (!p.tracks.some((t) => t.id === trackId && t.kind === kind)) {
        const slot = ops.firstFreeSlot(p, kind, playheadRef.current, clipboard.duration);
        if (!slot) return p;
        trackId = slot.trackId;
      }
      const desired = playheadRef.current;
      const start = ops.resolveFreeStart(p, trackId, '', desired, clipboard.duration);
      if (start == null) return p;
      const clip: Clip = { ...clipboard, id: clipboard.id + Math.random().toString(36).slice(2, 6), start, trackId };
      setSelection(clip.id);
      return { ...p, clips: [...p.clips, clip] };
    });
  }, [clipboard, mutate]);

  const addMediaClip = useCallback(
    (mediaId: string, opts?: { trackId?: string; at?: number }) => {
      const media = workspace.media.find((m) => m.id === mediaId);
      if (!media) return undefined;
      let created: Clip | undefined;
      mutate('Add clip', (p) => {
        const res = ops.addMediaClip(p, { id: media.id, kind: media.kind, duration: media.duration, name: media.name }, { trackId: opts?.trackId, at: opts?.at ?? playheadRef.current, duration: media.kind === 'image' ? 4 : undefined });
        created = res.clip;
        if (res.clip) setSelection(res.clip.id);
        return res.project;
      });
      return created;
    },
    [mutate, workspace.media],
  );

  const addTextClip = useCallback(() => {
    let created: Clip | undefined;
    mutate('Add title', (p) => {
      const res = ops.addTextClip(p, playheadRef.current);
      created = res.clip;
      if (res.clip) setSelection(res.clip.id);
      return res.project;
    });
    return created;
  }, [mutate]);

  // ---- tracks ----
  const addTrack = useCallback((kind: TrackKind) => mutate('Add track', (p) => ops.addTrack(p, kind)), [mutate]);
  const removeTrack = useCallback((id: string) => mutate('Remove track', (p) => ops.removeTrack(p, id)), [mutate]);
  const updateTrack = useCallback(
    (id: string, patch: Partial<Track>, label = 'Update track') => mutate(label, (p) => ops.updateTrack(p, id, patch)),
    [mutate],
  );

  const markIn = useCallback(() => setInPoint(snapToFrame(playheadRef.current, projectRef.current.fps)), []);
  const markOut = useCallback(() => setOutPoint(snapToFrame(playheadRef.current, projectRef.current.fps)), []);
  const clearRange = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  const setLoop = useCallback((v: boolean) => setLoopState(v), []);

  const patchProject = useCallback(
    (patch: Partial<Project>) => {
      setProjectInternal({ ...projectRef.current, ...patch }, 'Project settings');
    },
    [setProjectInternal],
  );

  const selectedClip = useMemo(() => project.clips.find((c) => c.id === selection) ?? undefined, [project.clips, selection]);

  const api = useMemo<EditorApi>(
    () => ({
      project,
      selection,
      selectedClip,
      zoom,
      snapping,
      tool,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      historyLabel: history[historyIndex]?.label ?? null,
      clipboard,
      get renderer() {
        return rendererRef.current;
      },
      setProject: (p) => setProjectInternal(p, 'Import project'),
      patchProject,
      mutate,
      commit,
      undo,
      redo,
      updateClip,
      splitAtPlayhead,
      deleteSelected,
      deleteClip,
      duplicateSelected,
      copySelected,
      pasteClipboard,
      addMediaClip,
      addTextClip,
      select,
      addTrack,
      removeTrack,
      updateTrack,
      setZoom,
      zoomIn,
      zoomOut,
      zoomFit,
      setTool,
      setSnapping,
      play,
      pause,
      togglePlay,
      seek,
      nudge,
      shuttle,
      stop,
      setLoop,
      markIn,
      markOut,
      clearRange,
      registerRenderer,
    }),
    [
      project, selection, selectedClip, zoom, snapping, tool, historyIndex, history.length, clipboard,
      patchProject, mutate, commit, undo, redo, updateClip, splitAtPlayhead, deleteSelected, deleteClip,
      duplicateSelected, copySelected, pasteClipboard, addMediaClip, addTextClip, select, addTrack,
      removeTrack, updateTrack, setZoom, zoomIn, zoomOut, zoomFit, setTool, setSnapping, play, pause,
      togglePlay, seek, nudge, shuttle, stop, setLoop, markIn, markOut, clearRange, registerRenderer,
    ],
  );

  const playback = useMemo<PlaybackState>(
    () => ({ playhead, playing, rate, loop, inPoint, outPoint, duration: projectDuration(project) }),
    [playhead, playing, rate, loop, inPoint, outPoint, project],
  );

  return (
    <ApiContext.Provider value={api}>
      <PlaybackContext.Provider value={playback}>{children}</PlaybackContext.Provider>
    </ApiContext.Provider>
  );
}
