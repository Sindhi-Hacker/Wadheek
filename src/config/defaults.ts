/**
 * Centralized product defaults and limits.
 * Nothing in the UI should hardcode these values — import from here.
 */

export const APP = {
  name: 'Wadheek',
  tagline: 'Video Studio',
  storageKeyTheme: 'wadheek:theme',
  db: 'wadheek',
  dbVersion: 1,
} as const;

export const TIMELINE = {
  /** Minimum clip duration in seconds (one frame at 60fps). */
  minClipDuration: 1 / 60,
  /** Zoom range in pixels per second. */
  minZoom: 4,
  maxZoom: 400,
  defaultZoom: 60,
  /** Pointer distance (px) under which clip edges are grabbable. */
  edgeGrabPx: 7,
  /** Snap distance (px) converted to seconds at current zoom. */
  snapPx: 9,
  /** Seconds of empty tail kept after the last clip. */
  tailPadding: 8,
  trackHeight: 56,
  headerWidth: 152,
  rulerHeight: 28,
} as const;

export const EDITOR = {
  historyLimit: 120,
  autosaveDebounceMs: 700,
  /** Playback drift (seconds) beyond which a media element is re-seeked. */
  syncDrift: 0.28,
  maxPlaybackRate: 16,
  shuttleRates: [1, 2, 4, 8, 16],
} as const;

export const MEDIA = {
  thumbnailWidth: 320,
  filmstripFrames: 8,
  waveformBuckets: 1600,
  maxImportFileBytes: 2 * 1024 * 1024 * 1024, // 2 GB safety cap
  acceptedMime: [
    'video/*',
    'audio/*',
    'image/*',
  ],
} as const;

export type ProjectPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  fps: number;
  aspect: string;
};

export const PROJECT_PRESETS: ProjectPreset[] = [
  { id: 'landscape-1080', label: 'Landscape 1080p', width: 1920, height: 1080, fps: 30, aspect: '16:9' },
  { id: 'landscape-720', label: 'Landscape 720p', width: 1280, height: 720, fps: 30, aspect: '16:9' },
  { id: 'portrait-1080', label: 'Portrait 1080p', width: 1080, height: 1920, fps: 30, aspect: '9:16' },
  { id: 'square-1080', label: 'Square 1080p', width: 1080, height: 1080, fps: 30, aspect: '1:1' },
  { id: 'cinema-24', label: 'Cinematic 24p', width: 1920, height: 1080, fps: 24, aspect: '16:9' },
];

export const FPS_OPTIONS = [24, 25, 30, 50, 60];

export const DEFAULT_PRESET_ID = 'landscape-1080';

export const CLIP_COLORS = {
  video: 'video',
  image: 'image',
  audio: 'audio',
  text: 'text',
} as const;
