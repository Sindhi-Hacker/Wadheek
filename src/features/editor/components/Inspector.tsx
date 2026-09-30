import React from 'react';
import { Copy, Film, Music4, Image as ImageIcon, RotateCcw, SlidersHorizontal, Trash2, Type } from 'lucide-react';
import { useEditor, usePlayback } from '@/features/editor/EditorContext';
import { Field, NumberField, SegmentedControl, SliderField } from '@/components/ui/controls';
import { FPS_OPTIONS } from '@/config/defaults';
import { formatTimecode } from '@/lib/time';

export function Inspector() {
  const api = useEditor();
  const playback = usePlayback();
  const { project, selectedClip: clip } = api;

  if (!clip) {
    return (
      <aside className="panel panel-right" aria-label="Inspector">
        <div className="panel-head">
          <span className="panel-title">Project</span>
        </div>
        <div className="panel-scroll">
          <div className="inspector-section">
            <div className="inspector-title">
              <SlidersHorizontal size={13} />
              <span>Sequence settings</span>
            </div>
            <Field label="Name">
              <input value={project.name} onChange={(e) => api.patchProject({ name: e.target.value })} />
            </Field>
            <div className="two-fields">
              <Field label="Width">
                <NumberField value={project.width} min={16} max={7680} step={2} onChange={(v) => api.patchProject({ width: Math.round(v) })} suffix="px" />
              </Field>
              <Field label="Height">
                <NumberField value={project.height} min={16} max={4320} step={2} onChange={(v) => api.patchProject({ height: Math.round(v) })} suffix="px" />
              </Field>
            </div>
            <Field label="Frame rate">
              <div className="fps-row">
                {FPS_OPTIONS.map((f) => (
                  <button key={f} className={`chip${project.fps === f ? ' active' : ''}`} onClick={() => api.patchProject({ fps: f })}>
                    {f}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Background">
              <span className="color-row">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(project.background) ? project.background : '#000000'} onChange={(e) => api.patchProject({ background: e.target.value })} />
                <code>{project.background}</code>
              </span>
            </Field>
          </div>

          <div className="inspector-section">
            <div className="inspector-title">
              <Film size={13} />
              <span>Statistics</span>
            </div>
            <dl className="stat-list">
              <div>
                <dt>Duration</dt>
                <dd>{formatTimecode(playback.duration, project.fps)}</dd>
              </div>
              <div>
                <dt>Clips</dt>
                <dd>{project.clips.length}</dd>
              </div>
              <div>
                <dt>Tracks</dt>
                <dd>{project.tracks.length}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="inspector-section">
            <div className="inspector-title">
              <Type size={13} />
              <span>Quick add</span>
            </div>
            <button className="btn small full" onClick={() => api.addTextClip()}>
              <Type size={13} /> Add title at playhead
            </button>
          </div>

          <p className="inspector-hint">Select a clip on the timeline to edit its properties. Everything auto-saves to this browser.</p>
        </div>
      </aside>
    );
  }

  const isVisual = clip.kind !== 'audio';
  const hasAudio = clip.kind === 'audio' || clip.kind === 'video';
  const patch = (p: Parameters<typeof api.updateClip>[1], commit = false) => api.updateClip(clip.id, p, commit ? { commit: true, label: 'Edit clip' } : undefined);
  const commitNow = () => api.commit('Adjust clip');

  const kindIcon = clip.kind === 'video' ? <Film size={12} /> : clip.kind === 'audio' ? <Music4 size={12} /> : clip.kind === 'image' ? <ImageIcon size={12} /> : <Type size={12} />;

  return (
    <aside className="panel panel-right" aria-label="Inspector">
      <div className="panel-head">
        <span className="panel-title">Inspector</span>
        <span className="panel-head-actions">
          <button className="mini-btn" title="Duplicate clip (⌘D)" onClick={() => api.duplicateSelected()}>
            <Copy size={12} />
          </button>
          <button className="mini-btn danger" title="Delete clip (Del)" onClick={() => api.deleteSelected(false)}>
            <Trash2 size={12} />
          </button>
        </span>
      </div>

      <div className="panel-scroll">
        <div className={`clip-banner kind-${clip.kind}`}>
          <span className="clip-kind-icon">{kindIcon}</span>
          <div className="clip-banner-main">
            <b>{clip.kind.toUpperCase()}</b>
            <span>
              {formatTimecode(clip.start, project.fps)} → {formatTimecode(clip.start + clip.duration, project.fps)}
            </span>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-title">
            <span>Clip name</span>
          </div>
          <input className="clip-name-input" value={clip.name} onChange={(e) => patch({ name: e.target.value })} onBlur={() => api.commit('Rename clip')} />
        </div>

        {clip.kind === 'text' && clip.text && (
          <div className="inspector-section">
            <div className="inspector-title">
              <Type size={13} />
              <span>Text</span>
            </div>
            <Field label="Content">
              <textarea rows={3} value={clip.text.content} onChange={(e) => patch({ text: { ...clip.text!, content: e.target.value } })} onBlur={() => api.commit('Edit text')} />
            </Field>
            <div className="two-fields">
              <Field label="Size">
                <NumberField value={clip.text.size} min={8} max={480} onChange={(v) => patch({ text: { ...clip.text!, size: v } }, true)} suffix="px" />
              </Field>
              <Field label="Color">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(clip.text.color) ? clip.text.color : '#ffffff'} onChange={(e) => patch({ text: { ...clip.text!, color: e.target.value } }, true)} />
              </Field>
            </div>
            <Field label="Alignment">
              <SegmentedControl
                value={clip.text.align}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(v) => patch({ text: { ...clip.text!, align: v } }, true)}
              />
            </Field>
            <label className="check-row">
              <input type="checkbox" checked={clip.text.bold} onChange={(e) => patch({ text: { ...clip.text!, bold: e.target.checked } }, true)} />
              Bold
            </label>
            <label className="check-row">
              <input type="checkbox" checked={clip.text.shadow} onChange={(e) => patch({ text: { ...clip.text!, shadow: e.target.checked } }, true)} />
              Drop shadow
            </label>
          </div>
        )}

        <div className="inspector-section">
          <div className="inspector-title">
            <span>Timing</span>
          </div>
          <div className="two-fields">
            <Field label="Start">
              <NumberField value={clip.start} min={0} step={0.1} onChange={(v) => patch({ start: Math.max(0, v) }, true)} suffix="s" />
            </Field>
            <Field label="Duration">
              <NumberField value={clip.duration} min={0.05} step={0.1} onChange={(v) => patch({ duration: Math.max(0.05, v) }, true)} suffix="s" />
            </Field>
          </div>
          {clip.mediaId && clip.kind !== 'image' && (
            <Field label="Speed">
              <SliderField value={clip.speed} min={0.25} max={4} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => patch({ speed: v })} />
            </Field>
          )}
        </div>

        {isVisual && (
          <div className="inspector-section">
            <div className="inspector-title">
              <span>Transform</span>
              <button className="mini-btn" title="Reset transform" onClick={() => patch({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, true)}>
                <RotateCcw size={11} />
              </button>
            </div>
            <div className="two-fields">
              <Field label="Position X">
                <NumberField value={clip.x} step={10} onChange={(v) => patch({ x: v }, true)} suffix="px" />
              </Field>
              <Field label="Position Y">
                <NumberField value={clip.y} step={10} onChange={(v) => patch({ y: v }, true)} suffix="px" />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="Scale">
                <NumberField value={clip.scale} min={0.05} max={8} step={0.05} onChange={(v) => patch({ scale: v }, true)} suffix="×" />
              </Field>
              <Field label="Rotation">
                <NumberField value={clip.rotation} min={-180} max={180} step={1} onChange={(v) => patch({ rotation: v }, true)} suffix="°" />
              </Field>
            </div>
            <Field label="Opacity">
              <SliderField value={clip.opacity} min={0} max={1} onChange={(v) => patch({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </Field>
          </div>
        )}

        <div className="inspector-section">
          <div className="inspector-title">
            <span>Fades</span>
          </div>
          <Field label="Fade in">
            <SliderField value={clip.fadeIn} min={0} max={Math.max(0.1, clip.duration / 2)} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(v) => patch({ fadeIn: v })} />
          </Field>
          <Field label="Fade out">
            <SliderField value={clip.fadeOut} min={0} max={Math.max(0.1, clip.duration / 2)} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(v) => patch({ fadeOut: v })} />
          </Field>
        </div>

        {hasAudio && (
          <div className="inspector-section">
            <div className="inspector-title">
              <Music4 size={13} />
              <span>Audio</span>
            </div>
            <Field label="Volume">
              <SliderField value={clip.volume} min={0} max={1} onChange={(v) => patch({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </Field>
          </div>
        )}

        <div className="inspector-section danger-zone">
          <button className="btn small full" onClick={() => api.duplicateSelected()}>
            <Copy size={13} /> Duplicate clip
          </button>
          <button className="btn small danger full" onClick={() => api.deleteSelected(false)}>
            <Trash2 size={13} /> Delete clip
          </button>
          <button className="btn small danger ghost full" onClick={() => api.deleteSelected(true)}>
            Ripple delete
          </button>
        </div>
      </div>
    </aside>
  );
}
