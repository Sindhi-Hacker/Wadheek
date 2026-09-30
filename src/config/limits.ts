/** Hard limits and guard rails, kept out of components so they can be tuned centrally. */
export const LIMITS = {
  maxTracks: 12,
  maxClipsPerTrack: 200,
  maxMediaFileBytes: 2 * 1024 * 1024 * 1024, // 2 GB per file
  maxProjectNameLength: 80,
  maxMarkerNameLength: 40,
  maxTextLength: 500,
  thumbnailWidth: 96,
  thumbnailHeight: 54,
  filmstripSamples: 8,
  waveformSamples: 2000,
  maxUndoDepth: 100,
  maxRecentProjects: 24,
} as const;

export const ACCEPTED_MIME = {
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/ogg"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac", "audio/webm", "audio/x-m4a"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/avif"],
} as const;

export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_MIME.video,
  ...ACCEPTED_MIME.audio,
  ...ACCEPTED_MIME.image,
].join(",");
