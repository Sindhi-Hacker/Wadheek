import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Copy,
  Film,
  FolderOpen,
  HardDrive,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { TopBar, navigate } from '@/components/layout/TopBar';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Field } from '@/components/ui/controls';
import { useToast } from '@/components/ui/Toast';
import { useContextMenu } from '@/components/ui/Menu';
import { FPS_OPTIONS, PROJECT_PRESETS } from '@/config/defaults';
import { formatDuration, formatRelative } from '@/lib/time';
import { describeUsage, storageUsage } from '@/lib/storage';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { projectDuration } from '@/features/projects/types';
import { mediaDurationLabel } from '@/features/media/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function DashboardPage({ onShortcuts }: { onShortcuts: () => void }) {
  const workspace = useWorkspace();
  const toast = useToast();
  const menu = useContextMenu();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [workspace.projects, workspace.media]);

  const filtered = useMemo(
    () => workspace.projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [workspace.projects, query],
  );

  const onImport = async (files: File[]) => {
    if (!files.length) return;
    setImporting(true);
    try {
      const res = await workspace.importFiles(files);
      if (res.added) toast.push(`Imported ${res.added} file${res.added > 1 ? 's' : ''}`, 'success');
      for (const err of res.errors) toast.push(err, 'error');
    } finally {
      setImporting(false);
    }
  };

  const projectMenu = (p: { id: string; name: string }) => [
    { id: 'open', label: 'Open project', icon: <FolderOpen size={14} />, onSelect: () => navigate({ page: 'editor', projectId: p.id }) },
    { id: 'rename', label: 'Rename…', icon: <Pencil size={14} />, onSelect: () => setRenaming(p.id) },
    {
      id: 'dup',
      label: 'Duplicate',
      icon: <Copy size={14} />,
      onSelect: () => {
        void workspace.duplicateProject(p.id).then(() => toast.push('Project duplicated', 'success'));
      },
    },
    {
      id: 'del',
      label: 'Delete project',
      icon: <Trash2 size={14} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => {
        if (confirm(`Delete “${p.name}”? This cannot be undone.`)) {
          void workspace.deleteProject(p.id).then(() => toast.push('Project deleted'));
        }
      },
    },
  ];

  return (
    <div className="app-page">
      <TopBar active="home" onShortcuts={onShortcuts} />
      <main className="main">
        <div className="page-head">
          <div>
            <div className="eyebrow">Local-first workspace</div>
            <h1>{greeting()}</h1>
            <p className="subtle">Everything stays on this device. Pick up a project or import new media.</p>
          </div>
          <div className="page-head-actions">
            <button className="btn" onClick={() => document.getElementById('media-import-input')?.click()} disabled={importing}>
              <Upload size={14} />
              {importing ? 'Importing…' : 'Import media'}
            </button>
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              New project
            </button>
          </div>
        </div>

        <input
          id="media-import-input"
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          hidden
          onChange={(e) => {
            void onImport(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />

        <section className="stats-row" aria-label="Workspace statistics">
          <div className="stat">
            <Layers size={15} />
            <strong>{workspace.projects.length}</strong>
            <span>Projects</span>
          </div>
          <div className="stat">
            <Film size={15} />
            <strong>{workspace.media.length}</strong>
            <span>Media assets</span>
          </div>
          <div className="stat">
            <HardDrive size={15} />
            <strong>{usage ? describeUsage(usage.usage, usage.quota) : '—'}</strong>
            <span>Local storage</span>
          </div>
          <div className="stat">
            <Clock3 size={15} />
            <strong>{formatDuration(workspace.projects.reduce((s, p) => s + projectDuration(p), 0))}</strong>
            <span>Total edited</span>
          </div>
        </section>

        <div className="section-head">
          <h2>Projects</h2>
          <span className="search">
            <Search size={13} />
            <input placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Film size={22} />}
            title={query ? 'No projects match your search' : 'No projects yet'}
            hint={query ? 'Try a different name.' : 'Create your first project — it is saved right here in your browser.'}
            action={
              !query ? (
                <button className="btn primary" onClick={() => setCreating(true)}>
                  <Plus size={15} /> New project
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="projects-grid">
            <button className="new-card" onClick={() => setCreating(true)}>
              <span className="plus">
                <Plus size={20} />
              </span>
              <b>New project</b>
              <span>Blank canvas</span>
            </button>
            {filtered.map((p) => {
              const dur = projectDuration(p);
              const preset = PROJECT_PRESETS.find((x) => x.width === p.width && x.height === p.height);
              const aspect = preset?.aspect ?? `${p.width}×${p.height}`;
              return (
                <article
                  key={p.id}
                  className="project-card"
                  tabIndex={0}
                  onClick={() => navigate({ page: 'editor', projectId: p.id })}
                  onKeyDown={(e) => e.key === 'Enter' && navigate({ page: 'editor', projectId: p.id })}
                  onContextMenu={(e) => menu.open(e, projectMenu(p))}
                >
                  <div className={`project-thumb hue-${hashHue(p.id) % 6}`}>
                    <span className="thumb-duration">
                      <Film size={11} /> {formatDuration(dur)}
                    </span>
                    <span className="thumb-aspect">{aspect}</span>
                  </div>
                  <div className="project-meta">
                    <div className="project-meta-main">
                      <h3>{p.name}</h3>
                      <p>
                        {p.clips.length} clip{p.clips.length === 1 ? '' : 's'} · {p.fps} fps · {formatRelative(p.updatedAt)}
                      </p>
                    </div>
                    <button className="more" aria-label="Project actions" onClick={(e) => { e.stopPropagation(); menu.open(e, projectMenu(p)); }}>
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="section-head">
          <h2>Media library</h2>
          <span className="section-head-hint">Shared across projects · stored in this browser</span>
        </div>

        {workspace.media.length === 0 ? (
          <EmptyState
            icon={<Video size={22} />}
            title="No media yet"
            hint="Import video, audio, or images — they never leave your device."
            action={
              <button className="btn primary" onClick={() => document.getElementById('media-import-input')?.click()}>
                <Upload size={14} /> Import media
              </button>
            }
          />
        ) : (
          <div
            className="media-strip"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onImport(Array.from(e.dataTransfer.files ?? []));
            }}
          >
            {workspace.media.map((m) => (
              <div key={m.id} className="media-card" title={`${m.name} · ${m.mime}`}>
                <div className={`media-preview kind-${m.kind}`}>
                  {m.thumbnail ? <img src={m.thumbnail} alt="" draggable={false} /> : <span className="media-kind-icon">{m.kind === 'audio' ? '♪' : '▣'}</span>}
                </div>
                <div className="media-card-info">
                  <b>{m.name}</b>
                  <span>
                    {mediaDurationLabel(m)} · {m.kind}
                  </span>
                </div>
                <button className="media-del" aria-label={`Delete ${m.name}`} onClick={() => void workspace.deleteMedia(m.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {menu.menu}

      <NewProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(name, presetId, fps) => {
          const project = workspace.createNewProject(name, presetId, fps);
          setCreating(false);
          toast.push(`Created “${project.name}”`, 'success');
          navigate({ page: 'editor', projectId: project.id });
        }}
      />

      <RenameModal
        id={renaming}
        initial={renaming ? workspace.projects.find((p) => p.id === renaming)?.name ?? '' : ''}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => {
          const p = workspace.projects.find((x) => x.id === renaming);
          if (p) workspace.updateProject({ ...p, name });
          setRenaming(null);
          toast.push('Project renamed', 'success');
        }}
      />
    </div>
  );
}

function RenameModal({ id, initial, onClose, onSubmit }: { id: string | null; initial: string; onClose: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial, id]);
  return (
    <Modal
      open={id != null}
      onClose={onClose}
      title="Rename project"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              if (name.trim()) onSubmit(name.trim());
            }}
          >
            Rename
          </button>
        </>
      }
    >
      <Field label="Project name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSubmit(name.trim())} />
      </Field>
    </Modal>
  );
}

function NewProjectModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, presetId: string, fps: number) => void }) {
  const workspace = useWorkspace();
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(workspace.settings.defaultPresetId);
  const [fps, setFps] = useState<number | null>(null);
  const preset = PROJECT_PRESETS.find((p) => p.id === presetId) ?? PROJECT_PRESETS[0];
  const effectiveFps = fps ?? preset.fps;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      subtitle="Video settings can be changed later in the inspector."
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onCreate(name || 'Untitled project', presetId, effectiveFps)}>
            <Plus size={15} /> Create project
          </button>
        </>
      }
    >
      <Field label="Project name">
        <input
          autoFocus
          placeholder="Untitled project"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate(name || 'Untitled project', presetId, effectiveFps)}
        />
      </Field>
      <Field label="Format">
        <div className="preset-grid">
          {PROJECT_PRESETS.map((p) => (
            <button key={p.id} className={`preset-card${presetId === p.id ? ' active' : ''}`} onClick={() => setPresetId(p.id)}>
              <span className={`preset-aspect aspect-${p.aspect.replace(':', 'x')}`} />
              <b>{p.label}</b>
              <span>
                {p.width}×{p.height}
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Frame rate">
        <div className="fps-row">
          {FPS_OPTIONS.map((f) => (
            <button key={f} className={`chip${effectiveFps === f ? ' active' : ''}`} onClick={() => setFps(f)}>
              {f} fps
            </button>
          ))}
        </div>
      </Field>
    </Modal>
  );
}
