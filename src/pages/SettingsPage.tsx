import React, { useEffect, useState } from 'react';
import { Database, Monitor, Moon, Palette, ShieldCheck, Sun, Trash2, Zap } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Field, Toggle } from '@/components/ui/controls';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { useWorkspace } from '@/features/projects/WorkspaceContext';
import { describeUsage, storageUsage, wipeAllData } from '@/lib/storage';
import { useToast } from '@/components/ui/Toast';
import { PROJECT_PRESETS } from '@/config/defaults';

export function SettingsPage({ onShortcuts }: { onShortcuts: () => void }) {
  const theme = useTheme();
  const workspace = useWorkspace();
  const toast = useToast();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [workspace.projects, workspace.media]);

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ReactNode; desc: string }> = [
    { value: 'light', label: 'Light', icon: <Sun size={16} />, desc: 'Bright studio white' },
    { value: 'dark', label: 'Dark', icon: <Moon size={16} />, desc: 'Cinema dim' },
    { value: 'system', label: 'System', icon: <Monitor size={16} />, desc: 'Follow your device' },
  ];

  return (
    <div className="app-page">
      <TopBar active="settings" onShortcuts={onShortcuts} />
      <main className="main narrow">
        <div className="page-head">
          <div>
            <div className="eyebrow">Workspace</div>
            <h1>Settings</h1>
            <p className="subtle">Preferences are stored in this browser — no account, no cloud.</p>
          </div>
        </div>

        <section className="settings-card">
          <header>
            <span className="settings-icon">
              <Palette size={16} />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>Every surface uses theme tokens — nothing is hardcoded to a single look.</p>
            </div>
          </header>
          <div className="theme-cards">
            {themeOptions.map((o) => (
              <button key={o.value} className={`theme-card${theme.mode === o.value ? ' active' : ''}`} onClick={() => theme.setMode(o.value)}>
                {o.icon}
                <b>{o.label}</b>
                <span>{o.desc}</span>
                {theme.mode === o.value && <em>Active</em>}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span className="settings-icon">
              <Zap size={16} />
            </span>
            <div>
              <h2>Editor defaults</h2>
              <p>Applied to new projects and to the editing session.</p>
            </div>
          </header>
          <Field label="Default project format">
            <div className="preset-grid">
              {PROJECT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`preset-card${workspace.settings.defaultPresetId === p.id ? ' active' : ''}`}
                  onClick={() => workspace.updateSettings({ defaultPresetId: p.id })}
                >
                  <span className={`preset-aspect aspect-${p.aspect.replace(':', 'x')}`} />
                  <b>{p.label}</b>
                  <span>
                    {p.width}×{p.height} · {p.fps} fps
                  </span>
                </button>
              ))}
            </div>
          </Field>
          <Toggle checked={workspace.settings.autosave} onChange={(v) => workspace.updateSettings({ autosave: v })} label="Autosave projects while editing" />
        </section>

        <section className="settings-card">
          <header>
            <span className="settings-icon">
              <Database size={16} />
            </span>
            <div>
              <h2>Local storage</h2>
              <p>
                {usage ? describeUsage(usage.usage, usage.quota) : 'Measuring…'} used by {workspace.projects.length} project{workspace.projects.length === 1 ? '' : 's'} and{' '}
                {workspace.media.length} media asset{workspace.media.length === 1 ? '' : 's'}.
              </p>
            </div>
          </header>
          <div className="settings-row">
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Delete ALL local projects, media, and settings from this browser? This cannot be undone.')) {
                  void wipeAllData().then(() => {
                    localStorage.removeItem('wadheek:theme');
                    toast.push('All local data cleared — reloading', 'success');
                    setTimeout(() => location.reload(), 700);
                  });
                }
              }}
            >
              <Trash2 size={14} /> Clear all local data
            </button>
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span className="settings-icon">
              <ShieldCheck size={16} />
            </span>
            <div>
              <h2>Privacy</h2>
              <p>Wadheek is local-first. Media is imported, edited, and exported entirely in your browser — nothing is uploaded, and no keys or services are required.</p>
            </div>
          </header>
        </section>
      </main>
    </div>
  );
}
