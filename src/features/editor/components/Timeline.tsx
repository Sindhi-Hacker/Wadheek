import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Magnet,
  Music4,
  Plus,
  Redo2,
  Repeat,
  Scissors,
  Slash,
  SquareSplitHorizontal,
  Trash2,
  Undo2,
  Video,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TIMELINE } from '@/config/defaults';
import { clamp, formatTimecode, pickRulerStep } from '@/lib/time';
import { useEditor, usePlayback } from '@/features/editor/EditorContext';
import { dragStateFor, resolveFreeStart, snapCandidates, snapTime, splitClipsAt } from '@/features/editor/lib/timelineOps';
import {
  acceptsKind,
  clipsOfTrack,
  clipEnd,
  isVisualClip,
  renumberTracks,
  type Clip,
  type Project,
  type Track,
  type TrackKind,
} from '@/features/projects/types';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { useTheme } from '@/components/theme/ThemeProvider';
import { TimelineClip, type ClipDragMode } from '@/features/editor/components/TimelineClip';
import { useContextMenu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';

interface DragSession {
  mode: ClipDragMode;
  clipId: string;
  originX: number;
  drag: ReturnType<typeof dragStateFor>;
  prevEnd: number;
  nextStart: number;
  last: { start: number; duration: number; trackId: string };
  changed: boolean;
}

interface LaneInfo {
  trackId: string;
  kind: TrackKind;
  top: number;
  bottom: number;
}

const MIN = TIMELINE.minClipDuration;

export function Timeline() {
  const api = useEditor();
  const playback = usePlayback();
  const workspace = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const clipMenu = useContextMenu();
  const trackMenu = useContextMenu();

  const { project, zoom, tool, snapping, selection } = api;
  const { playhead, playing, inPoint, outPoint, duration } = playback;
  const pps = zoom;

  const scrollRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);
  const rulerWrapRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLCanvasElement>(null);
  const playheadHeadRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragSession | null>(null);
  const apiRef = useRef(api);
  const playbackRef = useRef(playback);
  const ppsRef = useRef(pps);
  const colorsRef = useRef<Record<string, string>>({});
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoverLane, setHoverLane] = useState<string | null>(null);
  const scrubbingRef = useRef(false);

  apiRef.current = api;
  playbackRef.current = playback;
  ppsRef.current = pps;

  const mediaById = useMemo(() => {
    const map = new Map<string, (typeof workspace.media)[number]>();
    for (const m of workspace.media) map.set(m.id, m);
    return map;
  }, [workspace.media]);

  const displayedTracks: Track[] = useMemo(() => {
    const videos = project.tracks.filter((t) => t.kind === 'video');
    const audios = project.tracks.filter((t) => t.kind === 'audio');
    return [...videos.slice().reverse(), ...audios];
  }, [project.tracks]);

  const contentSeconds = Math.max(duration + TIMELINE.tailPadding, 30);
  const contentWidth = Math.ceil(contentSeconds * pps);

  // ---------- ruler ----------

  const readColors = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    colorsRef.current = {
      bg: get('--tl-ruler-bg', '#14161a'),
      tick: get('--tl-tick', '#3a3f47'),
      tickStrong: get('--tl-tick-strong', '#5b616b'),
      label: get('--tl-ruler-label', '#8a919c'),
      range: get('--tl-range', 'rgba(124,108,245,0.25)'),
      edge: get('--tl-range-edge', '#7c6cf5'),
    };
  }, [theme.resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawRuler = useCallback(() => {
    const canvas = rulerRef.current;
    const wrap = rulerWrapRef.current;
    const scroll = scrollRef.current;
    if (!canvas || !wrap || !scroll) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const zoomNow = ppsRef.current;
    const scrollLeft = scroll.scrollLeft;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = colorsRef.current;
    ctx.fillStyle = c.bg ?? '#14161a';
    ctx.fillRect(0, 0, w, h);

    // in/out range
    const pb = playbackRef.current;
    if (pb.inPoint != null && pb.outPoint != null && pb.outPoint > pb.inPoint) {
      const x0 = pb.inPoint * zoomNow - scrollLeft;
      const x1 = pb.outPoint * zoomNow - scrollLeft;
      ctx.fillStyle = c.range ?? 'rgba(124,108,245,0.25)';
      ctx.fillRect(x0, 0, x1 - x0, h);
      ctx.fillStyle = c.edge ?? '#7c6cf5';
      ctx.fillRect(x0, 0, 2, h);
      ctx.fillRect(x1 - 2, 0, 2, h);
    }

    const step = pickRulerStep(zoomNow);
    const minor = step / (step >= 15 ? 3 : 4);
    const fps = apiRef.current.project.fps;
    const t0 = Math.floor(scrollLeft / zoomNow / minor) * minor;
    const t1 = (scrollLeft + w) / zoomNow;

    ctx.strokeStyle = c.tick ?? '#3a3f47';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = t0; t <= t1 + minor; t += minor) {
      const x = Math.round(t * zoomNow - scrollLeft) + 0.5;
      const isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6;
      ctx.moveTo(x, isMajor ? 0 : h * 0.55);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    ctx.fillStyle = c.label ?? '#8a919c';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    const tM0 = Math.floor(scrollLeft / zoomNow / step) * step;
    for (let t = tM0; t <= t1 + step; t += step) {
      const x = Math.round(t * zoomNow - scrollLeft) + 4;
      if (x < -60) continue;
      const label = t >= 3600
        ? `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
        : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}${step < 1 ? `:${String(Math.round((t % 1) * fps)).padStart(2, '0')}` : ''}`;
      ctx.fillText(label, x, 4);
    }

    // duration boundary
    if (pb.duration > 0) {
      const x = pb.duration * zoomNow - scrollLeft;
      if (x >= 0 && x <= w) {
        ctx.fillStyle = c.tickStrong ?? '#5b616b';
        ctx.fillRect(x, 0, 1, h);
      }
    }
  }, []);

  const syncScrollUi = useCallback(() => {
    const scroll = scrollRef.current;
    const headers = headersRef.current;
    if (!scroll) return;
    if (headers) headers.style.transform = `translateY(${-scroll.scrollTop}px)`;
    drawRuler();
    positionPlayheadHead();
  }, [drawRuler]);

  const positionPlayheadHead = useCallback(() => {
    const head = playheadHeadRef.current;
    const scroll = scrollRef.current;
    if (!head || !scroll) return;
    const x = playbackRef.current.playhead * ppsRef.current - scroll.scrollLeft;
    head.style.transform = `translateX(${x}px)`;
    head.style.opacity = x < -8 || x > scroll.clientWidth + 8 ? '0' : '1';
  }, []);

  useEffect(() => {
    readColors();
    drawRuler();
    positionPlayheadHead();
  }, [readColors, drawRuler, positionPlayheadHead, zoom, inPoint, outPoint, duration]);

  // Playhead head follows the playhead every frame without redrawing the ruler.
  useEffect(() => {
    positionPlayheadHead();
  }, [playhead, positionPlayheadHead]);

  useLayoutEffect(() => {
    const wrap = rulerWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      drawRuler();
      positionPlayheadHead();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawRuler, positionPlayheadHead]);

  // Keep the playhead in view during playback.
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !playing) return;
    const x = playhead * pps;
    const viewL = scroll.scrollLeft;
    const viewR = viewL + scroll.clientWidth;
    if (x > viewR - 90 || x < viewL + 10) {
      scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.25);
    }
  }, [playhead, playing, pps]);

  // ---------- zoom with ctrl+wheel around the cursor ----------

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const apiNow = apiRef.current;
      const ppsNow = ppsRef.current;
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const timeAtCursor = (el.scrollLeft + cursorX) / ppsNow;
      const factor = Math.exp(-e.deltaY * 0.0022);
      const next = clamp(ppsNow * factor, TIMELINE.minZoom, TIMELINE.maxZoom);
      apiNow.setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, timeAtCursor * next - cursorX);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------- scrub on ruler ----------

  const scrubTo = useCallback((clientX: number) => {
    const scroll = scrollRef.current;
    const wrap = rulerWrapRef.current;
    if (!scroll || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + scroll.scrollLeft;
    apiRef.current.seek(Math.max(0, x / ppsRef.current));
  }, []);

  useEffect(() => {
    const wrap = rulerWrapRef.current;
    if (!wrap) return;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      scrubbingRef.current = true;
      wrap.setPointerCapture(e.pointerId);
      scrubTo(e.clientX);
    };
    const move = (e: PointerEvent) => {
      if (scrubbingRef.current) scrubTo(e.clientX);
    };
    const up = () => {
      scrubbingRef.current = false;
    };
    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    return () => {
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', up);
    };
  }, [scrubTo]);

  // ---------- clip dragging ----------

  const beginClipDrag = useCallback(
    (e: React.PointerEvent, clip: Clip, mode: ClipDragMode) => {
      if (e.button !== 0) return;
      const apiNow = apiRef.current;
      apiNow.select(clip.id);

      if (apiNow.tool === 'razor') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const t = clip.start + (e.clientX - rect.left) / ppsRef.current;
        apiNow.mutate('Split clip', (p) => splitClipsAt(p, t, clip.id).project);
        return;
      }

      const track = apiNow.project.tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;

      const media = mediaById.get(clip.mediaId ?? '');
      const sourceDuration = media && media.kind !== 'image' ? Math.max(0, media.duration - 0) : null;
      const drag = dragStateFor(apiNow.project, clip, sourceDuration);
      const others = clipsOfTrack(apiNow.project, clip.trackId).filter((c) => c.id !== clip.id);
      const prevEnd = others.filter((c) => clipEnd(c) <= clip.start + 1e-6).reduce((m, c) => Math.max(m, clipEnd(c)), 0);
      const nextStart = others.filter((c) => c.start >= clipEnd(clip) - 1e-6).reduce((m, c) => Math.min(m, c.start), Infinity);

      dragRef.current = {
        mode,
        clipId: clip.id,
        originX: e.clientX,
        drag,
        prevEnd,
        nextStart,
        last: { start: clip.start, duration: clip.duration, trackId: clip.trackId },
        changed: false,
      };
      e.preventDefault();
    },
    [mediaById],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const apiNow = apiRef.current;
      const project = apiNow.project;
      const clip = project.clips.find((c) => c.id === d.clipId);
      if (!clip) return;
      const z = ppsRef.current;
      const dt = (e.clientX - d.originX) / z;
      const pb = playbackRef.current;
      const doSnap = (t: number): { time: number; snapped: boolean } => {
        if (!apiNow.snapping || e.altKey) return { time: t, snapped: false };
        const candidates = snapCandidates(project, pb.playhead, pb.inPoint, pb.outPoint, d.clipId);
        return snapTime(t, candidates, TIMELINE.snapPx / z);
      };

      if (d.mode === 'move') {
        let desired = Math.max(0, d.drag.start + dt);
        let snapAt: number | null = null;
        const startSnap = doSnap(desired);
        const endSnap = doSnap(desired + d.drag.duration);
        if (startSnap.snapped || endSnap.snapped) {
          const dStart = startSnap.snapped ? Math.abs(startSnap.time - desired) : Infinity;
          const dEnd = endSnap.snapped ? Math.abs(endSnap.time - (desired + d.drag.duration)) : Infinity;
          if (dEnd < dStart) {
            desired = endSnap.time - d.drag.duration;
            snapAt = endSnap.time;
          } else {
            desired = startSnap.time;
            snapAt = startSnap.time;
          }
        }
        setSnapLine(snapAt);

        // vertical track targeting
        let trackId = d.drag.trackId;
        for (const [id, el] of laneRefs.current) {
          const rect = el.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const track = project.tracks.find((t) => t.id === id);
            if (track && !track.locked && acceptsKind(track, clip.kind)) trackId = id;
            break;
          }
        }
        const resolved = resolveFreeStart(project, trackId, d.clipId, Math.max(0, desired), d.drag.duration, d.last.start);
        if (resolved != null) {
          const start = Math.max(0, resolved);
          if (start !== d.last.start || trackId !== d.last.trackId || d.changed === false) {
            if (start !== d.last.start || trackId !== d.last.trackId) d.changed = true;
            d.last = { start, duration: d.drag.duration, trackId };
            apiNow.updateClip(d.clipId, { start, trackId });
          }
        }
        return;
      }

      if (d.mode === 'trim-start') {
        const end = d.drag.start + d.drag.duration;
        let newStart = d.drag.start + dt;
        const s = doSnap(newStart);
        newStart = s.time;
        setSnapLine(s.snapped ? s.time : null);
        const minStart = Math.max(0, d.prevEnd, d.drag.start - d.drag.maxLeft);
        const maxStart = end - MIN;
        newStart = clamp(newStart, minStart, maxStart);
        const newDuration = end - newStart;
        const newIn = Math.max(0, d.drag.in + (newStart - d.drag.start) * d.drag.clip.speed);
        if (newStart !== clip.start || newDuration !== clip.duration) {
          d.changed = true;
          d.last = { ...d.last, start: newStart, duration: newDuration };
          apiNow.updateClip(d.clipId, { start: newStart, duration: newDuration, in: newIn });
        }
        return;
      }

      // trim-end
      let newEnd = d.drag.start + d.drag.duration + dt;
      const s = doSnap(newEnd);
      newEnd = s.time;
      setSnapLine(s.snapped ? s.time : null);
      const maxEnd = Math.min(d.nextStart, d.drag.start + d.drag.duration + d.drag.maxRight);
      newEnd = clamp(newEnd, d.drag.start + MIN, maxEnd);
      const newDuration = newEnd - d.drag.start;
      if (newDuration !== clip.duration) {
        d.changed = true;
        d.last = { ...d.last, duration: newDuration };
        apiNow.updateClip(d.clipId, { duration: newDuration });
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setSnapLine(null);
      if (d?.changed) {
        apiRef.current.commit(d.mode === 'move' ? 'Move clip' : 'Trim clip');
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  // ---------- drop from the media panel ----------

  const lanesDragProps = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('application/x-wadheek-media')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        for (const [id, el] of laneRefs.current) {
          const rect = el.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) setHoverLane(id);
        }
      }
    },
    onDragLeave: () => setHoverLane(null),
    onDrop: (e: React.DragEvent) => {
      setHoverLane(null);
      const mediaId = e.dataTransfer.getData('application/x-wadheek-media');
      if (!mediaId) return;
      e.preventDefault();
      const media = workspace.media.find((m) => m.id === mediaId);
      if (!media) return;
      let trackId: string | undefined;
      let at = playbackRef.current.playhead;
      for (const [id, el] of laneRefs.current) {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const track = project.tracks.find((t) => t.id === id);
          if (track && acceptsKind(track, media.kind === 'audio' ? 'audio' : 'video')) {
            trackId = id;
            at = Math.max(0, (e.clientX - rect.left) / pps);
          }
          break;
        }
      }
      const created = api.addMediaClip(mediaId, { trackId, at });
      if (created) toast.push(`Added “${media.name}” to timeline`, 'success');
      else toast.push('No compatible track for this media', 'error');
    },
  };

  // ---------- track header menu ----------

  const openTrackMenu = (e: React.MouseEvent, track: Track) => {
    trackMenu.open(e, [
      { id: 'mute', label: track.muted ? 'Unmute track' : 'Mute track', icon: track.muted ? <Volume2 size={14} /> : <VolumeX size={14} />, onSelect: () => api.updateTrack(track.id, { muted: !track.muted }, 'Mute track') },
      ...(track.kind === 'video'
        ? [{ id: 'hide', label: track.hidden ? 'Show track' : 'Hide track', icon: track.hidden ? <Eye size={14} /> : <EyeOff size={14} />, onSelect: () => api.updateTrack(track.id, { hidden: !track.hidden }, 'Toggle track') }]
        : []),
      { id: 'lock', label: track.locked ? 'Unlock track' : 'Lock track', icon: track.locked ? <LockOpen size={14} /> : <Lock size={14} />, onSelect: () => api.updateTrack(track.id, { locked: !track.locked }, 'Lock track') },
      { id: 'del', label: 'Delete track', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, disabled: project.tracks.length <= 1, onSelect: () => api.removeTrack(track.id) },
    ]);
  };

  const clipMenuItems = (clip: Clip) => [
    { id: 'split', label: 'Split at playhead', icon: <SquareSplitHorizontal size={14} />, shortcut: 'S', disabled: !clip, onSelect: () => api.splitAtPlayhead(clip.id) },
    { id: 'dup', label: 'Duplicate', icon: <Copy size={14} />, shortcut: '⌘D', onSelect: () => { api.select(clip.id); api.duplicateSelected(); } },
    { id: 'copy', label: 'Copy', icon: <Copy size={14} />, shortcut: '⌘C', onSelect: () => { api.select(clip.id); api.copySelected(); } },
    { id: 'del', label: 'Delete', icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, separatorBefore: true, onSelect: () => api.deleteClip(clip.id) },
    { id: 'ripple', label: 'Ripple delete', icon: <Trash2 size={14} />, shortcut: '⇧Del', danger: true, onSelect: () => api.deleteClip(clip.id, true) },
  ];

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="tl-toolbar">
        <div className="tl-tools">
          <button className={`tool-btn${tool === 'select' ? ' active' : ''}`} title="Selection tool (V)" onClick={() => api.setTool('select')}>
            <Slash size={13} style={{ transform: 'rotate(-90deg)' }} />
          </button>
          <button className={`tool-btn${tool === 'razor' ? ' active' : ''}`} title="Razor tool (C)" onClick={() => api.setTool('razor')}>
            <Scissors size={13} />
          </button>
          <span className="tl-sep" />
          <button className="tool-btn" title="Split at playhead (S)" onClick={() => api.splitAtPlayhead()} disabled={!project.clips.length}>
            <SquareSplitHorizontal size={14} />
          </button>
          <button className="tool-btn" title="Duplicate selection (⌘D)" onClick={() => api.duplicateSelected()} disabled={!selection}>
            <Copy size={13} />
          </button>
          <button className="tool-btn danger" title="Delete selection (Del)" onClick={() => api.deleteSelected(false)} disabled={!selection}>
            <Trash2 size={13} />
          </button>
        </div>
        <div className="tl-toolbar-group">
          <button className={`tool-btn${snapping ? ' active' : ''}`} title="Snapping" onClick={() => api.setSnapping(!snapping)}>
            <Magnet size={13} />
          </button>
          <button className={`tool-btn${playback.loop ? ' active' : ''}`} title="Loop playback" onClick={() => api.setLoop(!playback.loop)}>
            <Repeat size={13} />
          </button>
          <span className="tl-sep" />
          <button className="tool-btn" title="Mark in (I)" onClick={() => api.markIn()}>
            <ArrowLeftToLine size={13} />
          </button>
          <button className="tool-btn" title="Mark out (O)" onClick={() => api.markOut()}>
            <ArrowRightToLine size={13} />
          </button>
          {(inPoint != null || outPoint != null) && (
            <button className="tool-btn" title="Clear in/out" onClick={() => api.clearRange()}>
              Clear
            </button>
          )}
        </div>
        <div className="tl-toolbar-right">
          <span className="tl-history" title={api.historyLabel ?? undefined}>
            {api.canUndo && <button className="tool-btn" title="Undo (⌘Z)" onClick={() => api.undo()}><Undo2 size={13} /></button>}
            {api.canRedo && <button className="tool-btn" title="Redo (⇧⌘Z)" onClick={() => api.redo()}><Redo2 size={13} /></button>}
          </span>
          <span className="tl-zoom">
            <button className="tool-btn" title="Zoom out (−)" onClick={() => api.zoomOut()}>
              <ZoomOut size={13} />
            </button>
            <input
              type="range"
              min={Math.log(TIMELINE.minZoom)}
              max={Math.log(TIMELINE.maxZoom)}
              step={0.01}
              value={Math.log(zoom)}
              onChange={(e) => api.setZoom(Math.exp(parseFloat(e.target.value)))}
              aria-label="Timeline zoom"
            />
            <button className="tool-btn" title="Zoom in (+)" onClick={() => api.zoomIn()}>
              <ZoomIn size={13} />
            </button>
            <button className="tool-btn textual" title="Fit timeline (F)" onClick={() => api.zoomFit(scrollRef.current?.clientWidth ?? 800)}>
              Fit
            </button>
          </span>
        </div>
      </div>

      <div className="tl-frame">
        <div className="tl-corner">
          <span>Track</span>
          <span className="tl-corner-actions">
            <button
              className="tl-add-track"
              title="Add video track"
              onClick={() => api.addTrack('video')}
            >
              <Plus size={11} /> <Video size={11} />
            </button>
            <button className="tl-add-track" title="Add audio track" onClick={() => api.addTrack('audio')}>
              <Plus size={11} /> <Music4 size={11} />
            </button>
          </span>
        </div>
        <div className="tl-ruler-wrap" ref={rulerWrapRef}>
          <canvas className="tl-ruler" ref={rulerRef} />
          <div className="tl-playhead-head" ref={playheadHeadRef} title="Playhead — drag to scrub">
            <span className="tl-playhead-time">{formatTimecode(playhead, project.fps)}</span>
          </div>
        </div>

        <div className="tl-headers" ref={headersRef}>
          {displayedTracks.map((track) => (
            <div
              key={track.id}
              className={`tl-header kind-${track.kind}${track.locked ? ' locked' : ''}`}
              style={{ height: TIMELINE.trackHeight }}
              onContextMenu={(e) => openTrackMenu(e, track)}
            >
              <span className={`tl-track-name kind-${track.kind}`}>{track.name}</span>
              <span className="tl-track-actions">
                {track.kind === 'video' && (
                  <button className={`mini-btn${track.hidden ? ' off' : ''}`} title={track.hidden ? 'Show track' : 'Hide track'} onClick={() => api.updateTrack(track.id, { hidden: !track.hidden }, 'Toggle visibility')}>
                    {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                )}
                <button className={`mini-btn${track.muted ? ' off' : ''}`} title={track.muted ? 'Unmute' : 'Mute'} onClick={() => api.updateTrack(track.id, { muted: !track.muted }, 'Toggle mute')}>
                  {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
                <button className={`mini-btn${track.locked ? ' off' : ''}`} title={track.locked ? 'Unlock' : 'Lock'} onClick={() => api.updateTrack(track.id, { locked: !track.locked }, 'Toggle lock')}>
                  {track.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                </button>
                <button className="mini-btn" title="Delete track" onClick={() => api.removeTrack(track.id)} disabled={project.tracks.length <= 1}>
                  <Trash2 size={11} />
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="tl-scroll" ref={scrollRef} onScroll={syncScrollUi} {...lanesDragProps}>
          <div
            className="tl-inner"
            ref={lanesRef}
            style={{ width: contentWidth, minHeight: displayedTracks.length * TIMELINE.trackHeight }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) api.select(null);
            }}
            onContextMenu={(e) => {
              const el = (e.target as HTMLElement).closest('[data-clip-id]') as HTMLElement | null;
              const id = el?.dataset.clipId;
              const clip = id ? project.clips.find((c) => c.id === id) : undefined;
              if (clip) {
                e.preventDefault();
                api.select(clip.id);
                clipMenu.open(e, clipMenuItems(clip));
              }
            }}
          >
            {displayedTracks.map((track) => (
              <div
                key={track.id}
                ref={(el) => {
                  if (el) laneRefs.current.set(track.id, el);
                  else laneRefs.current.delete(track.id);
                }}
                className={`tl-lane kind-${track.kind}${track.locked ? ' locked' : ''}${hoverLane === track.id ? ' drop-target' : ''}`}
                style={{ height: TIMELINE.trackHeight }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) api.select(null);
                }}
              >
                {clipsOfTrack(project, track.id).map((clip) => (
                  <TimelineClip
                    key={clip.id}
                    clip={clip}
                    media={mediaById.get(clip.mediaId ?? '')}
                    pps={pps}
                    selected={selection === clip.id}
                    razor={tool === 'razor'}
                    onPointerDown={beginClipDrag}
                  />
                ))}
              </div>
            ))}

            {project.clips.length === 0 && (
              <div className="tl-empty">
                <strong>Timeline is empty</strong>
                <span>Drag media from the library, or use “Add title”.</span>
              </div>
            )}

            {inPoint != null && outPoint != null && outPoint > inPoint && (
              <div className="tl-range" style={{ left: inPoint * pps, width: (outPoint - inPoint) * pps }} />
            )}

            {snapLine != null && <div className="tl-snapline" style={{ left: snapLine * pps }} />}

            <div className="tl-playhead-line" style={{ left: playhead * pps }} />
          </div>
        </div>
      </div>

      <div className="tl-statusbar">
        <span>
          {project.clips.length} clip{project.clips.length === 1 ? '' : 's'} · {displayedTracks.length} tracks · {project.fps} fps
        </span>
        <span className="tl-statusbar-right">
          {tool === 'razor' ? 'Razor: click a clip to cut it' : snapping ? 'Snapping on — hold Alt to bypass' : 'Snapping off'}
        </span>
      </div>

      {clipMenu.menu}
      {trackMenu.menu}
    </section>
  );
}

