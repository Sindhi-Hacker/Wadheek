import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PRESET_ID, PROJECT_PRESETS } from '@/config/defaults';
import { idb, localKv } from '@/lib/db';
import { kvGet, kvSet, putRecord, deleteRecord, listRecords } from '@/lib/storage';
import { uid } from '@/lib/id';
import { cloneProject, createProject, type Project } from '@/features/projects/types';
import type { MediaRecord } from '@/features/media/types';
import { importFile } from '@/features/media/importer';
import { generateSeed } from '@/features/media/seed';

/**
 * WorkspaceStore: the local-first data layer shared by every page.
 * Projects + media live in IndexedDB; the UI never holds hardcoded data.
 */

export interface WorkspaceSettings {
  defaultPresetId: string;
  autosave: boolean;
  showShortcutsHint: boolean;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultPresetId: DEFAULT_PRESET_ID,
  autosave: true,
  showShortcutsHint: true,
};

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface WorkspaceContextValue {
  ready: boolean;
  projects: Project[];
  media: MediaRecord[];
  settings: WorkspaceSettings;
  saveState: SaveState;
  createNewProject: (name: string, presetId?: string, fps?: number) => Project;
  updateProject: (project: Project, options?: { silent?: boolean }) => void;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<Project | undefined>;
  getProject: (id: string) => Project | undefined;
  importFiles: (files: File[]) => Promise<{ added: number; errors: string[] }>;
  deleteMedia: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  mediaUrl: (id: string) => string | undefined;
  reload: () => void;
  totalDuration: (id: string) => number;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Module-level seed guard: React StrictMode (and hot reloads) can mount the
 * provider twice; memoizing the seeding promise guarantees the sample data is
 * generated and written exactly once per browser session.
 */
let seedPromise: Promise<void> | null = null;
function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const seed = await generateSeed();
      await Promise.all(seed.media.map((m) => putRecord(idb.stores.media, m)));
      await putRecord(idb.stores.projects, seed.sampleProject);
      await kvSet('seeded', true);
    })();
    seedPromise.catch(() => {
      // Allow a later retry if seeding failed (e.g. transient IDB error).
      seedPromise = null;
    });
  }
  return seedPromise;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const urlCache = useRef(new Map<string, string>());
  const seededRef = useRef(false);

  const persistSettings = useCallback((next: WorkspaceSettings) => {
    setSettings(next);
    void kvSet('settings', next);
  }, []);

  const load = useCallback(async () => {
    const [projectList, mediaList, storedSettings, seedFlag] = await Promise.all([
      listRecords<Project>(idb.stores.projects),
      listRecords<MediaRecord>(idb.stores.media),
      kvGet<WorkspaceSettings>('settings', DEFAULT_SETTINGS),
      kvGet<boolean>('seeded', false),
    ]);

    let projects = projectList;
    let media = mediaList;

    if (!seedFlag && projects.length === 0 && media.length === 0) {
      // First run: generate procedural sample assets + demo project.
      try {
        await ensureSeeded();
        // Re-read — a concurrent load (StrictMode double-mount) may have written already.
        [projects, media] = await Promise.all([listRecords<Project>(idb.stores.projects), listRecords<MediaRecord>(idb.stores.media)]);
        seededRef.current = true;
      } catch (err) {
        // Seeding is best-effort; the app works fine with an empty library.
        console.warn('[wadheek] sample data seeding skipped:', err);
      }
    }

    // Deserialize safely.
    const clean = projects
      .filter((p) => p && p.id && Array.isArray(p.tracks) && Array.isArray(p.clips))
      .map((p) => ({ ...p, clips: p.clips.filter((c) => c && c.id) })) as Project[];
    clean.sort((a, b) => b.updatedAt - a.updatedAt);

    setProjects(clean);
    setMedia(media.filter((m) => m && m.id && m.blob).sort((a, b) => b.createdAt - a.createdAt));
    setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProject = useCallback(
    (project: Project, options?: { silent?: boolean }) => {
      const next = { ...project, updatedAt: Date.now() };
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === next.id);
        if (idx === -1) return [next, ...prev];
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      });
      if (options?.silent) return;
      setSaveState('saving');
      putRecord(idb.stores.projects, next)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [],
  );

  const createNewProject = useCallback(
    (name: string, presetId?: string, fps?: number) => {
      const preset = PROJECT_PRESETS.find((p) => p.id === (presetId ?? settings.defaultPresetId)) ?? PROJECT_PRESETS[0];
      const project = createProject(name, preset.width, preset.height, fps ?? preset.fps);
      setProjects((prev) => [project, ...prev]);
      setSaveState('saving');
      void putRecord(idb.stores.projects, project).then(() => setSaveState('saved'));
      return project;
    },
    [settings.defaultPresetId],
  );

  const deleteProject = useCallback(async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteRecord(idb.stores.projects, id);
  }, []);

  const duplicateProject = useCallback(
    async (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return undefined;
      const copy = cloneProject(source);
      copy.id = uid('prj_');
      copy.name = `${source.name} copy`;
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      setProjects((prev) => [copy, ...prev]);
      await putRecord(idb.stores.projects, copy);
      return copy;
    },
    [projects],
  );

  const getProject = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);

  const importFiles = useCallback(async (files: File[]) => {
    const errors: string[] = [];
    const added: MediaRecord[] = [];
    for (const file of files) {
      try {
        const record = await importFile(file);
        if (record) {
          await putRecord(idb.stores.media, record);
          added.push(record);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Could not import ${file.name}`);
      }
    }
    if (added.length) setMedia((prev) => [...added, ...prev]);
    return { added: added.length, errors };
  }, []);

  const deleteMedia = useCallback(async (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
    const url = urlCache.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.current.delete(id);
    }
    await deleteRecord(idb.stores.media, id);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<WorkspaceSettings>) => {
      persistSettings({ ...settings, ...patch });
    },
    [persistSettings, settings],
  );

  const mediaUrl = useCallback((id: string) => {
    const cached = urlCache.current.get(id);
    if (cached) return cached;
    const record = media.find((m) => m.id === id);
    if (!record) return undefined;
    const url = URL.createObjectURL(record.blob);
    urlCache.current.set(id, url);
    return url;
  }, [media]);

  const totalDuration = useCallback((id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return 0;
    return p.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  }, [projects]);

  // Keep localKv settings mirror in sync for synchronous readers.
  useEffect(() => {
    localKv.set('wadheek:settings', settings);
  }, [settings]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ready,
      projects,
      media,
      settings,
      saveState,
      createNewProject,
      updateProject,
      deleteProject,
      duplicateProject,
      getProject,
      importFiles,
      deleteMedia,
      updateSettings,
      mediaUrl,
      reload: () => void load(),
      totalDuration,
    }),
    [ready, projects, media, settings, saveState, createNewProject, updateProject, deleteProject, duplicateProject, getProject, importFiles, deleteMedia, updateSettings, mediaUrl, load, totalDuration],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
