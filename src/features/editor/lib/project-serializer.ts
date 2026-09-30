import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createId } from "@/lib/utils";
import { PROJECT_FILE_EXTENSION } from "@/config/defaults";
import type { Project } from "../types/project";
import type { MediaAsset } from "../types/media";
import { projectSchema } from "./project-schema";
import { migrateTracks } from "./clip-operations";
import { loadBlob, saveBlob } from "./opfs-storage";

const MANIFEST_NAME = "project.json";
const MEDIA_DIR = "media";

interface WadheekFileManifest {
  format: "wadheek-project";
  version: 1;
  project: Project;
  media: MediaAsset[];
}

/**
 * Serialize a project + its referenced media blobs into a single `.wadheek`
 * file (a zip containing a JSON manifest and the raw media files).
 */
export async function exportProjectFile(project: Project, media: MediaAsset[]): Promise<Blob> {
  const referenced = media.filter((m) => project.mediaIds.includes(m.id));
  const files: Record<string, Uint8Array> = {};

  const manifest: WadheekFileManifest = {
    format: "wadheek-project",
    version: 1,
    project,
    media: referenced,
  };
  files[MANIFEST_NAME] = strToU8(JSON.stringify(manifest));

  for (const asset of referenced) {
    const blob = await loadBlob(asset.id);
    if (blob) {
      files[`${MEDIA_DIR}/${asset.id}`] = new Uint8Array(await blob.arrayBuffer());
    }
  }

  const zipped = zipSync(files, { level: 0 }); // media is already compressed
  const buffer = new Uint8Array(zipped.length);
  buffer.set(zipped);
  return new Blob([buffer.buffer as ArrayBuffer], { type: "application/zip" });
}

export function projectFileName(project: Project): string {
  const safe = project.name.replace(/[^\w\-]+/g, "-").toLowerCase() || "project";
  return `${safe}${PROJECT_FILE_EXTENSION}`;
}

/**
 * Import a `.wadheek` file: validates the manifest, re-ids the project,
 * stores media blobs, and returns the new project + media entries.
 */
export async function importProjectFile(
  file: File
): Promise<{ project: Project; media: MediaAsset[] }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(data);
  const manifestRaw = entries[MANIFEST_NAME];
  if (!manifestRaw) throw new Error("Not a Wadheek project file");

  const manifest = JSON.parse(strFromU8(manifestRaw)) as WadheekFileManifest;
  if (manifest.format !== "wadheek-project") throw new Error("Unknown project format");

  const parsed = projectSchema.safeParse(manifest.project);
  if (!parsed.success) throw new Error("Project manifest failed validation");

  const project: Project = {
    ...(parsed.data as unknown as Project),
    id: createId("proj"),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timeline: {
      ...parsed.data.timeline,
      tracks: migrateTracks(parsed.data.timeline.tracks as Project["timeline"]["tracks"]),
    },
  };

  const media: MediaAsset[] = [];
  for (const asset of manifest.media) {
    const bytes = entries[`${MEDIA_DIR}/${asset.id}`];
    if (!bytes) continue;
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    await saveBlob(asset.id, new Blob([copy.buffer as ArrayBuffer], { type: asset.mime }));
    media.push(asset);
  }

  return { project, media };
}
