import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Loader2,
  MonitorPlay,
  PanelLeft,
  PanelRight,
  Save,
  TriangleAlert,
  Undo2,
  Redo2,
  Command,
  Film,
  Plus,
  Play,
  Pause,
  Scissors,
  Copy,
  Trash2,
  Magnet,
  Video,
  Music4,
  Type,
  Home,
} from 'lucide-react';
import { TopBar, navigate } from '@/components/layout/TopBar';
import { EditorProvider, useEditor, usePlayback } from '@/features/editor/EditorContext';
import { MediaPanel } from '@/features/editor/components/MediaPanel';
import { ProgramMonitor } from '@/features/editor/components/ProgramMonitor';
import { Timeline } from '@/features/editor/components/Timeline';
import { Inspector } from '@/features/editor/components/Inspector';
import { ExportDialog } from '@/features/editor/components/ExportDialog';
import { CommandPalette, type Command as CommandAction } from '@/features/editor/components/CommandPalette';
import { ShortcutsDialog } from '@/features/editor/components/ShortcutsDialog';
import { useShortcuts, type ShortcutOptions } from '@/features/editor/hooks/useShortcuts';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { formatTimecode } from '@/lib/time';

function SaveBadge() {
  const workspace = useWorkspace();
  const map: Record<string, React.ReactNode> = {
    saving: (
      <>
        <Loader2 size={12} className="spin" /> Saving…
      </>
    ),
    saved: (
      <>
        <Check size={12} /> Saved locally
      </>
    ),
    error: (
      <>
        <TriangleAlert size={12} /> Save failed
      </>
    ),
    idle: (
      <>
        <Save size={12} /> Autosave on
      </>
    ),
  };
  return <span className={`save-badge ${workspace.saveState}`}>{map[workspace.saveState] ?? map.idle}</span>;
}

function EditorToolbar({
  onExport,
  onPalette,
  onShortcuts,
  leftOpen,
  rightOpen,
  setLeftOpen,
  setRightOpen,
}: {
  onExport: () => void;
  onPalette: () => void;
  onShortcuts: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
}) {
  const api = useEditor();
  const playback = usePlayback();

  return (
    <div className="editor-toolbar">
      <button className="btn ghost small" onClick={() => navigate({ page: 'home' })} title="Back to projects">
        <ArrowLeft size={14} />
        <span className="hide-narrow">Projects</span>
      </button>
      <span className="toolbar-divider" />
      <button className="icon-btn subtle" onClick={() => setLeftOpen(!leftOpen)} title="Toggle media panel" aria-pressed={leftOpen}>
        <PanelLeft size={14} />
      </button>
      <button className="icon-btn subtle" onClick={() => setRightOpen(!rightOpen)} title="Toggle inspector" aria-pressed={rightOpen}>
        <PanelRight size={14} />
      </button>

      <input
        className="project-name"
        value={api.project.name}
        onChange={(e) => api.patchProject({ name: e.target.value })}
        onBlur={() => api.commit('Rename project')}
        aria-label="Project name"
        spellCheck={false}
      />
      <span className="project-badge">
        {api.project.width}×{api.project.height} · {api.project.fps} fps · {formatTimecode(playback.duration, api.project.fps)}
      </span>

      <span className="toolbar-spacer" />

      <SaveBadge />

      <span className="toolbar-divider" />
      <button className="icon-btn subtle" onClick={() => api.undo()} title="Undo (⌘Z)" disabled={!api.canUndo}>
        <Undo2 size={15} />
      </button>
      <button className="icon-btn subtle" onClick={() => api.redo()} title="Redo (⇧⌘Z)" disabled={!api.canRedo}>
        <Redo2 size={15} />
      </button>
      <span className="toolbar-divider" />
      <button className="btn ghost small" onClick={onPalette} title="Command palette (⌘K)">
        <Command size={13} />
        <kbd>⌘K</kbd>
      </button>
      <button className="btn primary small" onClick={onExport} title="Export (⌘E)">
        <CloudUpload size={14} />
        <span className="hide-narrow">Export</span>
      </button>
    </div>
  );
}

function EditorInner({
  projectId,
  onShortcuts,
}: {
  projectId: string;
  onShortcuts: () => void;
}) {
  const api = useEditor();
  const playback = usePlayback();
  const workspace = useWorkspace();
  const [exportOpen, setExportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 900);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 1150);
  const timelineHostRef = useRef<HTMLDivElement>(null);
  const [viewportPx, setViewportPx] = useState(900);

  useEffect(() => {
    const el = timelineHostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportPx(el.clientWidth - 160));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const optsRef = useRef<ShortcutOptions>({ onPalette: () => setPaletteOpen(true), onShortcuts, onExport: () => setExportOpen(true), viewportPx });
  optsRef.current = { onPalette: () => setPaletteOpen(true), onShortcuts, onExport: () => setExportOpen(true), viewportPx };
  useShortcuts(api, optsRef);

  const commands: CommandAction[] = useMemo(() => {
    const cmds: CommandAction[] = [
      { id: 'play', label: 'Play / pause', shortcut: 'Space', group: 'Playback', run: () => api.togglePlay() },
      { id: 'stop', label: 'Stop and return to start', group: 'Playback', run: () => api.stop() },
      { id: 'loop', label: playback.loop ? 'Disable loop playback' : 'Enable loop playback', group: 'Playback', run: () => api.setLoop(!playback.loop) },
      { id: 'markin', label: 'Mark in at playhead', shortcut: 'I', group: 'Playback', run: () => api.markIn() },
      { id: 'markout', label: 'Mark out at playhead', shortcut: 'O', group: 'Playback', run: () => api.markOut() },
      { id: 'clearrange', label: 'Clear in/out range', group: 'Playback', run: () => api.clearRange() },
      { id: 'split', label: 'Split clips at playhead', shortcut: 'S', group: 'Edit', run: () => api.splitAtPlayhead() },
      { id: 'dup', label: 'Duplicate selected clip', shortcut: '⌘D', group: 'Edit', run: () => api.duplicateSelected() },
      { id: 'del', label: 'Delete selected clip', shortcut: 'Del', group: 'Edit', run: () => api.deleteSelected(false) },
      { id: 'ripple', label: 'Ripple delete selected clip', shortcut: '⇧Del', group: 'Edit', run: () => api.deleteSelected(true) },
      { id: 'title', label: 'Add title at playhead', group: 'Insert', run: () => api.addTextClip() },
      { id: 'addvideo', label: 'Add video track', group: 'Insert', run: () => api.addTrack('video') },
      { id: 'addaudio', label: 'Add audio track', group: 'Insert', run: () => api.addTrack('audio') },
      { id: 'razor', label: 'Razor tool', shortcut: 'C', group: 'Tools', run: () => api.setTool('razor') },
      { id: 'select', label: 'Selection tool', shortcut: 'V', group: 'Tools', run: () => api.setTool('select') },
      { id: 'snap', label: api.snapping ? 'Disable snapping' : 'Enable snapping', group: 'Tools', run: () => api.setSnapping(!api.snapping) },
      { id: 'zoomin', label: 'Zoom in timeline', shortcut: '+', group: 'View', run: () => api.zoomIn() },
      { id: 'zoomout', label: 'Zoom out timeline', shortcut: '−', group: 'View', run: () => api.zoomOut() },
      { id: 'zoomfit', label: 'Fit timeline', shortcut: 'F', group: 'View', run: () => api.zoomFit(viewportPx) },
      { id: 'undo', label: 'Undo', shortcut: '⌘Z', group: 'History', run: () => api.undo() },
      { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z', group: 'History', run: () => api.redo() },
      { id: 'export', label: 'Export video', shortcut: '⌘E', group: 'App', run: () => setExportOpen(true) },
      { id: 'shortcuts', label: 'Keyboard shortcuts', shortcut: '?', group: 'App', run: onShortcuts },
      { id: 'home', label: 'Back to projects', group: 'App', run: () => navigate({ page: 'home' }) },
      { id: 'settings', label: 'Open settings', group: 'App', run: () => navigate({ page: 'settings' }) },
    ];
    for (const m of workspace.media) {
      cmds.push({
        id: `add-${m.id}`,
        label: `Insert “${m.name}” at playhead`,
        hint: m.kind,
        group: 'Insert',
        run: () => api.addMediaClip(m.id, { at: playback.playhead }),
      });
    }
    return cmds;
  }, [api, playback.loop, playback.playhead, workspace.media, viewportPx, onShortcuts]);

  const missing = workspace.ready && !workspace.getProject(projectId);

  return (
    <div className="app-page editor-page">
      <TopBar active="editor" onShortcuts={onShortcuts} />
      <EditorToolbar
        onExport={() => setExportOpen(true)}
        onPalette={() => setPaletteOpen(true)}
        onShortcuts={onShortcuts}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        setLeftOpen={setLeftOpen}
        setRightOpen={setRightOpen}
      />

      {missing ? (
        <div className="editor-missing">
          <Film size={26} />
          <h2>Project not found</h2>
          <p>It may have been deleted from this browser.</p>
          <button className="btn primary" onClick={() => navigate({ page: 'home' })}>
            <Home size={14} /> Back to projects
          </button>
        </div>
      ) : (
        <div className={`workspace left-${leftOpen ? 'open' : 'closed'} right-${rightOpen ? 'open' : 'closed'}`}>
          <MediaPanel />
          <div className="workspace-center" ref={timelineHostRef}>
            <ProgramMonitor />
            <Timeline />
          </div>
          <Inspector />
        </div>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}

export function EditorPage({ projectId, onShortcuts }: { projectId: string; onShortcuts: () => void }) {
  return (
    <EditorProvider projectId={projectId}>
      <EditorInner projectId={projectId} onShortcuts={onShortcuts} />
    </EditorProvider>
  );
}
