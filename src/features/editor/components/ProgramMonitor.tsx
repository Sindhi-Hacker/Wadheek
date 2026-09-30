import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEditor, usePlayback } from '@/features/editor/EditorContext';
import { ProgramRenderer } from '@/features/editor/lib/renderer';
import { formatTimecode } from '@/lib/time';
import { useWorkspace } from '@/features/projects/WorkspaceContext';

/** Program monitor: canvas preview + transport controls. */
export function ProgramMonitor() {
  const api = useEditor();
  const playback = usePlayback();
  const workspace = useWorkspace();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ProgramRenderer | null>(null);

  const { project } = api;
  const { playhead, playing, rate, loop, duration, inPoint, outPoint } = playback;

  const mediaResolver = useMemo(
    () => (id: string) => workspace.media.find((m) => m.id === id),
    [workspace.media],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ProgramRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setMediaResolver(mediaResolver);
    api.registerRenderer(renderer);
    return () => {
      api.registerRenderer(null);
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setMediaResolver(mediaResolver);
  }, [mediaResolver]);

  const frame = 1 / Math.max(1, project.fps);
  const rateLabel = rate !== 1 ? `${rate > 0 ? '' : ''}${rate}×` : null;

  return (
    <section className="monitor" aria-label="Program monitor">
      <div className="monitor-stage">
        <canvas ref={canvasRef} className="monitor-canvas" width={project.width} height={project.height} />
        {duration === 0 && (
          <div className="monitor-empty">
            <strong>Nothing on the timeline</strong>
            <span>Add media or a title to see your program here.</span>
          </div>
        )}
        <span className="monitor-timecode">{formatTimecode(playhead, project.fps)}</span>
        <span className="monitor-resolution">
          {project.width}×{project.height} · {project.fps} fps
        </span>
      </div>

      <div className="transport" role="toolbar" aria-label="Transport controls">
        <div className="transport-left">
          <button className="t-btn" title="Go to start (Home)" onClick={() => api.seek(0)}>
            <ChevronsLeft size={15} />
          </button>
          <button className="t-btn" title="Previous frame (←)" onClick={() => api.nudge(-frame)}>
            <SkipBack size={14} />
          </button>
        </div>

        <div className="transport-center">
          <button className={`t-btn${loop ? ' active' : ''}`} title="Loop playback" onClick={() => api.setLoop(!loop)}>
            <Repeat size={14} />
          </button>
          <button className="play-btn" title={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={() => api.togglePlay()}>
            {playing && rate > 0 ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className={`t-btn${inPoint != null ? ' active' : ''}`} title="Mark in (I)" onClick={() => api.markIn()}>
            <ArrowLeftToLine size={14} />
          </button>
          <button className={`t-btn${outPoint != null ? ' active' : ''}`} title="Mark out (O)" onClick={() => api.markOut()}>
            <ArrowRightToLine size={14} />
          </button>
        </div>

        <div className="transport-right">
          <button className="t-btn" title="Next frame (→)" onClick={() => api.nudge(frame)}>
            <SkipForward size={14} />
          </button>
          <button className="t-btn" title="Go to end (End)" onClick={() => api.seek(duration)}>
            <ChevronsRight size={15} />
          </button>
        </div>

        <div className="transport-time">
          <strong>{formatTimecode(playhead, project.fps)}</strong>
          <span>/ {formatTimecode(duration, project.fps)}</span>
          {rateLabel && <em className={rate < 0 ? 'reverse' : ''}>{rateLabel}</em>}
          {playing && rate < 0 && <em className="reverse">REV</em>}
        </div>
      </div>
    </section>
  );
}
