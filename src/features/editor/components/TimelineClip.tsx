import React, { memo, useEffect, useRef } from 'react';
import { FileAudio2, FileImage, FileVideo, Type } from 'lucide-react';
import type { MediaRecord } from '@/features/media/types';
import type { Clip } from '@/features/projects/types';

export type ClipDragMode = 'move' | 'trim-start' | 'trim-end';

interface TimelineClipProps {
  clip: Clip;
  media: MediaRecord | undefined;
  pps: number;
  selected: boolean;
  razor: boolean;
  onPointerDown: (e: React.PointerEvent, clip: Clip, mode: ClipDragMode) => void;
  onDoubleClick?: (clip: Clip) => void;
}

function drawWaveform(canvas: HTMLCanvasElement, media: MediaRecord, clip: Clip) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx || !media.waveform) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const peaks = media.waveform;
  const srcDur = Math.max(0.001, media.duration);
  const srcStart = clip.in;
  const srcEnd = clip.in + clip.duration * clip.speed;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const mid = h / 2;
  for (let x = 0; x < w; x++) {
    const t0 = srcStart + ((srcEnd - srcStart) * x) / w;
    const t1 = srcStart + ((srcEnd - srcStart) * (x + 1)) / w;
    const i0 = Math.floor((t0 / srcDur) * peaks.length);
    const i1 = Math.max(i0 + 1, Math.ceil((t1 / srcDur) * peaks.length));
    let peak = 0;
    for (let i = i0; i < i1 && i < peaks.length; i++) peak = Math.max(peak, peaks[i]);
    const bar = Math.max(1, peak * (h * 0.92));
    ctx.fillRect(x, mid - bar / 2, 1, bar);
  }
}

export const TimelineClip = memo(function TimelineClip({ clip, media, pps, selected, razor, onPointerDown, onDoubleClick }: TimelineClipProps) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const width = Math.max(6, clip.duration * pps);
  const filmstrip: string[] = media?.filmstrip ?? [];
  const thumbnail: string | undefined = media?.thumbnail ?? undefined;
  const mediaDuration = media?.duration ?? 0;

  useEffect(() => {
    if (clip.kind === 'audio' && media && waveRef.current) {
      drawWaveform(waveRef.current, media, clip);
    }
  }, [clip, media, width]);

  const kindIcon =
    clip.kind === 'video' ? <FileVideo size={11} /> : clip.kind === 'audio' ? <FileAudio2 size={11} /> : clip.kind === 'image' ? <FileImage size={11} /> : <Type size={11} />;

  const label = clip.kind === 'text' ? clip.text?.content.split('\n')[0] || 'Title' : clip.name;

  return (
    <div
      className={`tl-clip kind-${clip.kind}${selected ? ' selected' : ''}${razor ? ' razor-hover' : ''}`}
      style={{ left: clip.start * pps, width }}
      data-clip-id={clip.id}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const edge = 8;
        let mode: ClipDragMode = 'move';
        if (localX <= edge && clip.duration * pps > 18) mode = 'trim-start';
        else if (rect.width - localX <= edge && clip.duration * pps > 18) mode = 'trim-end';
        onPointerDown(e, clip, mode);
      }}
      onDoubleClick={() => onDoubleClick?.(clip)}
      title={`${clip.name} · ${clip.duration.toFixed(2)}s`}
    >
      <span className="tl-clip-fade-in" style={{ width: Math.min(width * 0.5, clip.fadeIn * pps) }} />
      <span className="tl-clip-fade-out" style={{ width: Math.min(width * 0.5, clip.fadeOut * pps) }} />
      <div className="tl-clip-head">
        {kindIcon}
        <span className="tl-clip-name">{label}</span>
      </div>
      <div className="tl-clip-body">
        {clip.kind === 'video' && media?.filmstrip?.length ? (
          <div className="tl-thumbs">
            {Array.from({ length: Math.max(1, Math.ceil(width / 56)) }).map((_, i) => {
              const srcT = clip.in + ((i + 0.5) * (clip.duration * clip.speed)) / Math.max(1, Math.ceil(width / 56));
              const idx = Math.min(media.filmstrip.length - 1, Math.max(0, Math.floor((srcT / Math.max(0.001, media.duration)) * media.filmstrip.length)));
              return <img key={i} src={media.filmstrip[idx]} alt="" draggable={false} />;
            })}
          </div>
        ) : clip.kind === 'image' && thumbnail ? (
          <div className="tl-thumbs">
            {Array.from({ length: Math.max(1, Math.ceil(width / 84)) }).map((_, i) => (
              <img key={i} src={thumbnail} alt="" draggable={false} />
            ))}
          </div>
        ) : clip.kind === 'audio' ? (
          media?.waveform ? <canvas ref={waveRef} className="tl-wave" /> : <div className="tl-wave-placeholder" />
        ) : clip.kind === 'text' ? (
          <div className="tl-text-preview">{clip.text?.content}</div>
        ) : null}
      </div>
      <span className="tl-grip tl-grip-l" />
      <span className="tl-grip tl-grip-r" />
    </div>
  );
});
