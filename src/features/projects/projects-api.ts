import { createId } from "@/lib/utils";
import { DEFAULT_PROJECT_SETTINGS, DEFAULT_TRACKS } from "@/config/defaults";
import { LIMITS } from "@/config/limits";
import type { Project, ProjectSettings, ProjectSummary } from "@/features/editor/types/project";
import type { Track, TrackKind } from "@/features/editor/types/track";
import { timelineDuration } from "@/features/editor/lib/timeline-math";
import {
  deleteProjectDoc,
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from "@/features/editor/lib/idb-storage";

function defaultTracks(): Track[] {
  return DEFAULT_TRACKS.map((t) => ({
    id: createId("track"),
    kind: t.kind as TrackKind,
    name: t.name,
    muted: false,
    solo: false,
    locked: false,
    hidden: false,
    clips: [],
  }));
}

export function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    duration: timelineDuration(project.timeline.tracks),
    clipCount: project.timeline.tracks.reduce((n, t) => n + t.clips.length, 0),
    aspectId: project.settings.aspectId,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const index = await loadProjectIndex();
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return loadProject(id);
}

export async function createProject(
  name: string,
  settings?: Partial<ProjectSettings>
): Promise<Project> {
  const project: Project = {
    id: createId("proj"),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: { ...DEFAULT_PROJECT_SETTINGS, ...settings },
    timeline: { tracks: defaultTracks(), markers: [], inPoint: null, outPoint: null },
    mediaIds: [],
  };
  await persistProject(project);
  return project;
}

export async function persistProject(project: Project): Promise<void> {
  await saveProject(project);
  const index = await loadProjectIndex();
  const summary = summarize(project);
  const next = [summary, ...index.filter((p) => p.id !== project.id)].slice(
    0,
    LIMITS.maxRecentProjects
  );
  await saveProjectIndex(next);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const project = await loadProject(id);
  if (!project) return;
  project.name = name;
  project.updatedAt = Date.now();
  await persistProject(project);
}

export async function duplicateProject(id: string): Promise<Project | undefined> {
  const project = await loadProject(id);
  if (!project) return undefined;
  const copy: Project = structuredClone(project);
  copy.id = createId("proj");
  copy.name = `${project.name} copy`;
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  await persistProject(copy);
  return copy;
}

export async function deleteProject(id: string): Promise<void> {
  await deleteProjectDoc(id);
  const index = await loadProjectIndex();
  await saveProjectIndex(index.filter((p) => p.id !== id));
}

export async function saveImportedProject(project: Project): Promise<void> {
  await persistProject(project);
}
