import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Film, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useEditor, usePlayback } from '@/features/editor/EditorContext';
import { Field, Toggle } from '@/components/ui/controls';
import { useToast } from '@/components/ui/Toast';
import { formatTimecode } from '@/lib/time';

type Phase = 'idle' | 'preparing' | 'recording' | 'done' | 'error';

const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/**
 * Export renders the program in real time to WebM (or MP4 where supported)
 * through an offscreen canvas capture + MediaRecorder, mixing clip audio via
 * the renderer's WebAudio graph. If the browser produces no data with audio
 * (some sandboxed/embedded contexts), it automatically retries video-only.
 */
export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useEditor();
  const playback = usePlayback();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [useRange, setUseRange] = useState(false);
  const [scale, setScale] = useState(1);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExt, setResultExt] = useState('webm');
  const [resultSize, setResultSize] = useState(0);
  const [audioFallbackUsed, setAudioFallbackUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const watchRef = useRef<number | null>(null);
  const cleanupFns = useRef<Array<() => void>>([]);

  const { project } = api;
  const hasRange = playback.inPoint != null && playback.outPoint != null && playback.outPoint > playback.inPoint;
  const start = useRange && hasRange ? (playback.inPoint ?? 0) : 0;
  const end = useRange && hasRange ? (playback.outPoint ?? 0) : playback.duration;

  const cleanupWatch = () => {
    if (watchRef.current != null) {
      window.clearInterval(watchRef.current);
      watchRef.current = null;
    }
  };

  const teardown = () => {
    cleanupWatch();
    for (const fn of cleanupFns.current) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    cleanupFns.current = [];
  };

  useEffect(
    () => () => {
      teardown();
    },
    [],
  );

  useEffect(() => {
    if (!open && phase === 'recording') cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function cancel(): void {
    teardown();
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    chunksRef.current = [];
    api.pause();
    setPhase('idle');
    setProgress(0);
  }

  async function startExport(withAudio: boolean): Promise<void> {
    const renderer = api.renderer;
    if (!renderer) {
      setError('Preview is still initializing — try again in a moment.');
      setPhase('error');
      return;
    }
    const mime = pickMime();
    if (!mime) {
      setError('This browser does not support MediaRecorder video capture.');
      setPhase('error');
      return;
    }
    if (end <= start) {
      setError('Nothing to export — the timeline is empty.');
      setPhase('error');
      return;
    }

    setError(null);
    setResultUrl(null);
    setAudioFallbackUsed(false);
    setPhase('preparing');
    setProgress(0);

    api.pause();
    api.setLoop(false);
    renderer.userGesture();
    api.seek(start);
    await new Promise((r) => setTimeout(r, 260));

    // Offscreen export canvas — the program is composed directly into it each
    // tick. Capturing the onscreen composited canvas can stall rendering on
    // software compositors, so this surface stays detached from the DOM.
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const outW = even(project.width * scale);
    const outH = even(project.height * scale);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = outW;
    exportCanvas.height = outH;
    renderer.setExportCanvas(exportCanvas);
    cleanupFns.current.push(() => renderer.setExportCanvas(null));

    const stream = exportCanvas.captureStream(project.fps);
    if (withAudio) {
      renderer.userGesture();
      for (const track of renderer.audioTracks()) stream.addTrack(track);
    }

    let recorder: MediaRecorder;
    try {
      const bitrate = Math.min(16, Math.max(2.5, (outW * outH * project.fps) / 600000)) * 1_000_000;
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    } catch {
      teardown();
      setError('Could not start the recorder with these settings.');
      setPhase('error');
      return;
    }
    recRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      cleanupWatch();
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      api.pause();
      if (blob.size === 0) {
        if (withAudio) {
          // Some embedded browsers produce nothing when audio tracks are
          // captured — retry once as video-only.
          setAudioFallbackUsed(true);
          setIncludeAudio(false);
          void startExport(false);
          return;
        }
        teardown();
        setError('Recording produced no data. Try a shorter range or another browser.');
        setPhase('error');
        return;
      }
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultExt(mime.includes('mp4') ? 'mp4' : 'webm');
      setResultSize(blob.size);
      setPhase('done');
      setProgress(1);
      toast.push('Export finished — file is ready to download', 'success');
    };
    recorder.start(250);
    setPhase('recording');
    api.play();

    watchRef.current = window.setInterval(() => {
      const t = playheadGetter.current();
      setProgress(Math.min(1, Math.max(0, (t - start) / Math.max(0.001, end - start))));
      if (t >= end - 1e-3) finish();
    }, 120);
  }

  function finish(): void {
    cleanupWatch();
    api.pause();
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  // Read the live playhead without re-rendering this dialog at 60fps.
  const playheadGetter = useRef<() => number>(() => 0);
  playheadGetter.current = () => playback.playhead;

  const ext = resultExt;
  const fileName = `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'export'}.${ext}`;

  return (
    <Modal
      open={open}
      onClose={() => (phase === 'recording' ? cancel() : onClose())}
      title="Export video"
      subtitle={`${project.width}×${project.height} · ${project.fps} fps · ${formatTimecode(end - start, project.fps)}`}
      width={480}
      footer={
        phase === 'recording' ? (
          <button className="btn danger" onClick={cancel}>
            <X size={14} /> Stop & discard
          </button>
        ) : phase === 'done' && resultUrl ? (
          <>
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <a className="btn primary" href={resultUrl} download={fileName} onClick={() => toast.push('Download started', 'success')}>
              <Download size={14} /> Download {ext.toUpperCase()}
            </a>
          </>
        ) : (
          <>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={phase === 'preparing' || playback.duration === 0} onClick={() => void startExport(includeAudio)}>
              {phase === 'preparing' ? <Loader2 size={14} className="spin" /> : <Film size={14} />}
              {phase === 'preparing' ? 'Preparing…' : 'Start export'}
            </button>
          </>
        )
      }
    >
      {phase === 'recording' ? (
        <div className="export-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p>
            Recording the program in real time — <strong>{Math.round(progress * 100)}%</strong>
          </p>
          <p className="subtle">Keep this tab in the foreground for a clean capture.</p>
        </div>
      ) : phase === 'done' && resultUrl ? (
        <div className="export-done">
          <Check size={22} />
          <div>
            <strong>Export complete</strong>
            <p className="subtle">
              {(resultSize / 1024 / 1024).toFixed(1)} MB · {ext.toUpperCase()} · {audioFallbackUsed ? 'video only (audio capture unavailable in this browser)' : includeAudio ? 'with audio mix' : 'video only'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="export-note">
            The program is captured live from the monitor with per-clip transforms, text, fades, and mixed audio — entirely in your browser.
          </p>
          <div className="export-toggles">
            <Toggle checked={includeAudio} onChange={setIncludeAudio} label="Include audio mix" />
            <Toggle
              checked={useRange && hasRange}
              onChange={(v) => setUseRange(v)}
              label={hasRange ? `In/out range (${formatTimecode(start, project.fps)} → ${formatTimecode(end, project.fps)})` : 'In/out range (set I / O on the ruler first)'}
            />
          </div>
          <Field label="Resolution">
            <select
              className="export-scale"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              <option value={1}>Full · {project.width}×{project.height}</option>
              <option value={0.75}>75% · {Math.round(project.width * 0.75)}×{Math.round(project.height * 0.75)}</option>
              <option value={0.5}>Half · {Math.round(project.width * 0.5)}×{Math.round(project.height * 0.5)} (faster)</option>
            </select>
          </Field>
          <Field label="Estimated output">
            <span className="stat-list flat">
              <span>{formatTimecode(end - start, project.fps)}</span>
              <span>· {Math.round(project.width * scale)}×{Math.round(project.height * scale)}</span>
              <span>· {includeAudio ? 'with audio' : 'video only'}</span>
            </span>
          </Field>
          {error && <p className="form-error">{error}</p>}
        </>
      )}
    </Modal>
  );
}
