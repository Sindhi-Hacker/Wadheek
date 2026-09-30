import { createStore, del, get, keys, set } from "idb-keyval";
import { STORAGE_KEYS } from "@/config/defaults";
import type { Project, ProjectSummary } from "../types/project";
import type { MediaAsset } from "../types/media";

const store = createStore("wadheek", "kv");

export const idb = {
  get: <T>(key: string) => get<T>(key, store),
  set: (key: string, value: unknown) => set(key, value, store),
  del: (key: string) => del(key, store),
  keys: () => keys(store),
};

/* ---------------- projects ---------------- */

export async function loadProjectIndex(): Promise<ProjectSummary[]> {
  return (await idb.get<ProjectSummary[]>(STORAGE_KEYS.projectsIndex)) ?? [];
}

export async function saveProjectIndex(index: ProjectSummary[]): Promise<void> {
  await idb.set(STORAGE_KEYS.projectsIndex, index);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return idb.get<Project>(STORAGE_KEYS.project(id));
}

export async function saveProject(project: Project): Promise<void> {
  await idb.set(STORAGE_KEYS.project(project.id), project);
}

export async function deleteProjectDoc(id: string): Promise<void> {
  await idb.del(STORAGE_KEYS.project(id));
}

/* ---------------- media metadata ---------------- */

export async function loadMediaIndex(): Promise<MediaAsset[]> {
  return (await idb.get<MediaAsset[]>(STORAGE_KEYS.media)) ?? [];
}

export async function saveMediaIndex(index: MediaAsset[]): Promise<void> {
  await idb.set(STORAGE_KEYS.media, index);
}

/* ---------------- derived data ---------------- */

export async function saveWaveform(mediaId: string, peaks: Float32Array): Promise<void> {
  await idb.set(STORAGE_KEYS.waveform(mediaId), peaks);
}

export async function loadWaveform(mediaId: string): Promise<Float32Array | undefined> {
  return idb.get<Float32Array>(STORAGE_KEYS.waveform(mediaId));
}

export async function saveThumbnails(mediaId: string, thumbs: Blob[]): Promise<void> {
  await idb.set(STORAGE_KEYS.thumbs(mediaId), thumbs);
}

export async function loadThumbnails(mediaId: string): Promise<Blob[] | undefined> {
  return idb.get<Blob[]>(STORAGE_KEYS.thumbs(mediaId));
}

export async function deleteDerived(mediaId: string): Promise<void> {
  await Promise.all([
    idb.del(STORAGE_KEYS.waveform(mediaId)),
    idb.del(STORAGE_KEYS.thumbs(mediaId)),
  ]);
}

/* ---------------- session ---------------- */

export async function saveLastSession(projectId: string | null): Promise<void> {
  await idb.set(STORAGE_KEYS.lastSession, projectId);
}

export async function loadLastSession(): Promise<string | null> {
  return (await idb.get<string | null>(STORAGE_KEYS.lastSession)) ?? null;
}

/** Wipe every Wadheek key (used by Settings > Clear all data). */
export async function clearAllIdb(): Promise<void> {
  const allKeys = await idb.keys();
  await Promise.all(allKeys.map((k) => idb.del(k as string)));
}
