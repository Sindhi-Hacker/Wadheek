import type { AspectRatioPreset, ProjectSettings } from "@/features/editor/types/project";

/** Namespaced browser-storage keys. Everything Wadheek persists lives under these. */
export const STORAGE_KEYS = {
  theme: "wadheek.theme",
  projectsIndex: "wadheek.projects.index",
  project: (id: string) => `wadheek.project.${id}`,
  media: "wadheek.media.index",
  mediaBlob: (id: string) => `wadheek.blob.${id}`,
  waveform: (id: string) => `wadheek.waveform.${id}`,
  thumbs: (id: string) => `wadheek.thumbs.${id}`,
  lastSession: "wadheek.session.last",
  settings: "wadheek.settings",
} as const;

/** Aspect-ratio / resolution presets offered when creating a project. */
export const ASPECT_PRESETS: AspectRatioPreset[] = [
  { id: "16:9", label: "Widescreen 16:9", width: 1920, height: 1080, description: "YouTube, TV" },
  { id: "9:16", label: "Vertical 9:16", width: 1080, height: 1920, description: "Reels, Shorts, TikTok" },
  { id: "1:1", label: "Square 1:1", width: 1080, height: 1080, description: "Feed posts" },
  { id: "4:5", label: "Portrait 4:5", width: 1080, height: 1350, description: "Instagram portrait" },
  { id: "21:9", label: "Cinematic 21:9", width: 2560, height: 1080, description: "Ultra-wide film" },
];

export const FPS_OPTIONS = [24, 25, 30, 50, 60] as const;

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  aspectId: "16:9",
  background: "#000000",
};

export const DEFAULT_TRACKS = [
  { kind: "text", name: "Text 1" },
  { kind: "overlay", name: "Overlay 1" },
  { kind: "video", name: "Video 1" },
  { kind: "audio", name: "Audio 1" },
] as const;

/** Timeline defaults */
export const TIMELINE_DEFAULTS = {
  pixelsPerSecond: 80,
  minPixelsPerSecond: 4,
  maxPixelsPerSecond: 800,
  zoomStep: 1.35,
  trackHeight: 64,
  audioTrackHeight: 56,
  compactTrackHeight: 48,
  snapThresholdPx: 8,
  defaultImageDuration: 5,
  defaultTextDuration: 4,
  defaultStickerDuration: 3,
  defaultDrawingDuration: 5,
  defaultFreezeDuration: 1,
  defaultStickerSize: 220,
  minClipDuration: 0.05,
  rulerHeight: 28,
  autoScrollEdgePx: 48,
} as const;

/** Playback */
export const PLAYBACK_DEFAULTS = {
  shuttleSpeeds: [-8, -4, -2, -1, 0, 1, 2, 4, 8],
  frameStepSmall: 1,
  frameStepLarge: 10,
} as const;

/** Autosave */
export const AUTOSAVE = {
  debounceMs: 800,
  indicatorResetMs: 2000,
} as const;

/** Speed control range */
export const SPEED_RANGE = { min: 0.25, max: 4, step: 0.05, presets: [0.25, 0.5, 1, 1.5, 2, 4] } as const;

/** Transition types and default duration (seconds). */
export const TRANSITIONS = {
  types: [
    { id: "none", label: "None" },
    { id: "crossfade", label: "Crossfade" },
    { id: "dip-black", label: "Dip to Black" },
    { id: "dip-white", label: "Dip to White" },
    { id: "slide", label: "Slide" },
    { id: "wipe", label: "Wipe" },
    { id: "zoom", label: "Zoom" },
  ],
  defaultDuration: 0.5,
  minDuration: 0.1,
  maxDuration: 3,
} as const;

/** Text overlay defaults */
export const TEXT_DEFAULTS = {
  content: "Title",
  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilies: [
    { id: "Inter, system-ui, sans-serif", label: "Inter" },
    { id: "Georgia, 'Times New Roman', serif", label: "Georgia" },
    { id: "'Courier New', monospace", label: "Courier" },
    { id: "'Arial Black', Arial, sans-serif", label: "Arial Black" },
    { id: "'Comic Sans MS', cursive", label: "Comic Sans" },
    { id: "Impact, sans-serif", label: "Impact" },
    { id: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
    { id: "Verdana, Geneva, sans-serif", label: "Verdana" },
    { id: "'Palatino Linotype', 'Book Antiqua', serif", label: "Palatino" },
    { id: "'Brush Script MT', cursive", label: "Brush Script" },
  ],
  fontSize: 72,
  fontWeight: 700,
  color: "#ffffff",
  align: "center" as const,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowBlur: 8,
  shadowColor: "#000000cc",
  background: "transparent",
  animations: [
    { id: "none", label: "None" },
    { id: "fade", label: "Fade" },
    { id: "slide-up", label: "Slide Up" },
    { id: "slide-down", label: "Slide Down" },
    { id: "scale", label: "Scale" },
  ],
} as const;

/** One-tap text style presets (InShot-style looks). */
export const TEXT_PRESETS = [
  {
    id: "title",
    label: "Title",
    style: { fontSize: 96, fontWeight: 800, color: "#ffffff", strokeWidth: 0, shadowBlur: 18, background: "transparent", letterSpacing: 0 },
  },
  {
    id: "subtitle",
    label: "Subtitle",
    style: { fontSize: 44, fontWeight: 500, color: "#ffffffcc", strokeWidth: 0, shadowBlur: 6, background: "transparent", letterSpacing: 0.5 },
  },
  {
    id: "caption",
    label: "Caption",
    style: { fontSize: 56, fontWeight: 700, color: "#ffffff", strokeWidth: 0, shadowBlur: 0, background: "#00000080", letterSpacing: 0 },
  },
  {
    id: "neon",
    label: "Neon",
    style: { fontSize: 84, fontWeight: 800, color: "#22d3ee", strokeWidth: 0, shadowBlur: 42, shadowColor: "#22d3ee", background: "transparent", letterSpacing: 2 },
  },
  {
    id: "meme",
    label: "Meme",
    style: { fontSize: 64, fontWeight: 900, color: "#ffffff", strokeColor: "#000000", strokeWidth: 8, shadowBlur: 0, background: "transparent", letterSpacing: 0 },
  },
  {
    id: "news",
    label: "News Bar",
    style: { fontSize: 48, fontWeight: 700, color: "#ffffff", strokeWidth: 0, shadowBlur: 0, background: "#dc2626", letterSpacing: 0 },
  },
  {
    id: "karaoke",
    label: "Karaoke",
    style: { fontSize: 60, fontWeight: 800, color: "#facc15", strokeColor: "#7c2d12", strokeWidth: 3, shadowBlur: 10, background: "transparent", letterSpacing: 0 },
  },
  {
    id: "typewriter",
    label: "Typewriter",
    style: { fontSize: 52, fontWeight: 400, color: "#ffffff", strokeWidth: 0, shadowBlur: 4, background: "transparent", letterSpacing: 1 },
  },
] as const;

/** Filter parameter ranges — a single source of truth for the FilterPanel + compositor. */
export const FILTER_DEFS = [
  { id: "brightness", label: "Brightness", min: 0, max: 2, step: 0.01, def: 1 },
  { id: "contrast", label: "Contrast", min: 0, max: 2, step: 0.01, def: 1 },
  { id: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, def: 1 },
  { id: "hue", label: "Hue", min: -180, max: 180, step: 1, def: 0 },
  { id: "temperature", label: "Temperature", min: -100, max: 100, step: 1, def: 0 },
  { id: "tint", label: "Tint", min: -100, max: 100, step: 1, def: 0 },
  { id: "exposure", label: "Exposure", min: -2, max: 2, step: 0.01, def: 0 },
  { id: "gamma", label: "Gamma", min: 0.2, max: 2.5, step: 0.01, def: 1 },
  { id: "vignette", label: "Vignette", min: 0, max: 1, step: 0.01, def: 0 },
  { id: "blur", label: "Blur", min: 0, max: 20, step: 0.5, def: 0 },
  { id: "sharpen", label: "Sharpen", min: 0, max: 1, step: 0.01, def: 0 },
  { id: "grayscale", label: "Grayscale", min: 0, max: 1, step: 0.01, def: 0 },
  { id: "sepia", label: "Sepia", min: 0, max: 1, step: 0.01, def: 0 },
  { id: "invert", label: "Invert", min: 0, max: 1, step: 0.01, def: 0 },
] as const;

/** LUT-style looks: named partial filter presets. */
export const FILTER_PRESETS = [
  { id: "none", label: "None", values: {} },
  { id: "cinematic", label: "Cinematic", values: { contrast: 1.15, saturation: 0.9, temperature: -12, vignette: 0.35 } },
  { id: "warm", label: "Golden Hour", values: { temperature: 35, brightness: 1.05, saturation: 1.15 } },
  { id: "cool", label: "Arctic", values: { temperature: -35, tint: -10, contrast: 1.05 } },
  { id: "noir", label: "Noir", values: { grayscale: 1, contrast: 1.3, vignette: 0.45 } },
  { id: "vintage", label: "Vintage", values: { sepia: 0.45, contrast: 0.92, vignette: 0.3, saturation: 0.85 } },
  { id: "vivid", label: "Vivid", values: { saturation: 1.4, contrast: 1.12 } },
  { id: "faded", label: "Faded", values: { contrast: 0.82, brightness: 1.08, saturation: 0.8 } },
] as const;

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
] as const;

/** Track palette — maps track kinds to their token classes. */
export const TRACK_KIND_META = {
  video: { label: "Video", clipClass: "bg-track-clip text-track-clip-foreground" },
  overlay: { label: "Overlay", clipClass: "bg-track-overlay text-track-overlay-foreground" },
  text: { label: "Text", clipClass: "bg-track-text text-track-text-foreground" },
  audio: { label: "Audio", clipClass: "bg-track-audio text-track-audio-foreground" },
} as const;

export const PROJECT_FILE_EXTENSION = ".wadheek";

export const APP_VERSION = "1.0.0";
export const APP_NAME = "Wadheek";
export const APP_TAGLINE = "Edit video entirely in your browser. Nothing ever leaves your device.";
