import React, { useMemo, useRef, useState } from 'react';
import { Film, Music4, Image as ImageIcon, Plus, Search, Trash2, Type, Upload } from 'lucide-react';
import { useEditor, usePlayback } from '@/features/editor/EditorContext';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { mediaDurationLabel, type MediaRecord } from '@/features/media/types';
import { EmptyState } from '@/components/ui/controls';
import { useContextMenu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';

type Filter = 'all' | 'video' | 'audio' | 'image';

const FILTERS: Array<{ id: Filter; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All', icon: null },
  { id: 'video', label: 'Video', icon: <Film size={11} /> },
  { id: 'audio', label: 'Audio', icon: <Music4 size={11} /> },
  { id: 'image', label: 'Images', icon: <ImageIcon size={11} /> },
];

export function MediaPanel() {
  const api = useEditor();
  const playback = usePlayback();
  const workspace = useWorkspace();
  const toast = useToast();
  const menu = useContextMenu();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workspace.media.filter((m) => (filter === 'all' || m.kind === filter) && (!q || m.name.toLowerCase().includes(q)));
  }, [workspace.media, query, filter]);

  const onImport = async (files: File[]) => {
    const ok = files.filter((f) => /video\/|audio\/|image\//.test(f.type) || /\.(mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac|opus|png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f.name));
    if (!ok.length) return;
    setImporting(true);
    try {
      const res = await workspace.importFiles(ok);
      if (res.added) toast.push(`Imported ${res.added} file${res.added > 1 ? 's' : ''}`, 'success');
      for (const err of res.errors) toast.push(err, 'error');
    } finally {
      setImporting(false);
    }
  };

  const addAtPlayhead = (m: MediaRecord) => {
    const clip = api.addMediaClip(m.id, { at: playback.playhead });
    if (clip) toast.push(`Added “${m.name}”`, 'success');
    else toast.push('No compatible track — add a track first', 'error');
  };

  return (
    <aside
      className={`panel panel-left${dragActive ? ' drag-active' : ''}`}
      aria-label="Media library"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setDragActive(false);
          void onImport(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <div className="panel-head">
        <span className="panel-title">Media</span>
        <span className="panel-head-actions">
          <button className="mini-btn" title="Add title clip" onClick={() => api.addTextClip()}>
            <Type size={12} />
          </button>
          <button className="mini-btn" title="Import files" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload size={12} />
          </button>
        </span>
      </div>

      <div className="panel-toolbar">
        <span className="search">
          <Search size={12} />
          <input placeholder="Search media" value={query} onChange={(e) => setQuery(e.target.value)} />
        </span>
        <div className="chip-row">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-scroll">
        {items.length === 0 ? (
          <EmptyState
            icon={importing ? <Upload size={20} className="spin" /> : <Film size={20} />}
            title={importing ? 'Importing…' : query || filter !== 'all' ? 'Nothing found' : 'No media yet'}
            hint={query || filter !== 'all' ? 'Try another search or filter.' : 'Drop files here or click import.'}
            action={
              !query && filter === 'all' && !importing ? (
                <button className="btn primary small" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} /> Import
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="media-list">
            {items.map((m) => (
              <div
                key={m.id}
                className={`media-item kind-${m.kind}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-wadheek-media', m.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => addAtPlayhead(m)}
                onContextMenu={(e) =>
                  menu.open(e, [
                    { id: 'add', label: 'Add at playhead', icon: <Plus size={14} />, onSelect: () => addAtPlayhead(m) },
                    { id: 'del', label: 'Delete asset', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, onSelect: () => void workspace.deleteMedia(m.id) },
                  ])
                }
                title={`${m.name} — double-click or drag to timeline`}
              >
                <div className="media-thumb">
                  {m.thumbnail ? <img src={m.thumbnail} alt="" draggable={false} /> : <span className="media-kind-icon">{m.kind === 'audio' ? <Music4 size={16} /> : <ImageIcon size={16} />}</span>}
                  <span className="media-duration">{mediaDurationLabel(m)}</span>
                </div>
                <div className="media-item-info">
                  <b>{m.name}</b>
                  <span>{m.kind === 'image' ? 'still' : `${Math.round(m.duration)}s`}</span>
                </div>
                <button className="media-add" title="Add at playhead" onClick={() => addAtPlayhead(m)}>
                  <Plus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        hidden
        onChange={(e) => {
          void onImport(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      {menu.menu}
    </aside>
  );
}
