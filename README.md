# Wadheek

**A fast, fully client-side video editor that runs entirely in your browser.**
No backend, no database, no uploads, no accounts — projects, imported media and rendered
exports never leave your device.

![Stack](https://img.shields.io/badge/stack-Vite%20%2B%20React%2018%20%2B%20TypeScript-blue)
![Privacy](https://img.shields.io/badge/privacy-100%25%20local-success)

---

## Highlights

- **Real editing, not a mockup** — multi-track timeline (video / overlay / text / audio),
  drag, trim, split, slice, duplicate, copy-paste, ripple delete, magnetic snapping with
  Alt-override, markers, in/out range, loop playback, J/K/L shuttle, frame stepping.
- **Full keyframe system** — animate *any* property (position, scale, rotation, opacity,
  volume, font size, and every color filter) with ◇ diamonds beside each control, an
  auto-key mode, 9 easing curves (incl. bounce, elastic, spring and hold), a draggable
  **curve editor** in the timeline, and 18 one-click motion presets (Ken Burns, fly-in,
  pop, spin, shake, heartbeat, float, …). Keyframes survive splits and are exported with
  the project.
- **Interactive canvas** — select, move, scale and rotate clips directly in the preview
  with magnetic center guides, double-click text to edit it *on the canvas*, composition
  guides (thirds + title-safe), and frame-accurate drag of keyframes in the curve editor.
- **Unique: motion recorder** — arm it, drag a clip around the preview, and the gesture is
  converted into cleaned-up keyframe tracks (smart curve thinning collapses straight moves
  to two keyframes while keeping curved paths within tolerance).
- **Unique: animated draw-on ink** — freehand pen/marker tool that inks on the video with
  the playhead following the pen, then replays as an animated stroke during playback and
  export. Undo per stroke.
- **Unique: local audio intelligence** — beat detection turns a music clip's waveform into
  timeline markers (snap cuts to beats), and auto-ducking writes volume keyframes that dip
  music under speech — both run entirely in the browser.
- **More pro tools** — green-screen chroma key (similarity/smoothness/spill, YCbCr keying),
  freeze frame at playhead (spliced between clip halves), detach audio to its own track,
  sticker layers (emoji + vector shapes), text presets (neon, meme, news bar, karaoke…),
  letter/line spacing, flip H/V, fit/fill with blurred background, solid-color clips,
  per-frame PNG export, and a built-in stock library of free sample footage.
- **Media library** — drag-and-drop or file-picker import of video, audio and images with
  automatic metadata probing (duration, resolution), filmstrip thumbnails and audio waveforms.
- **Compositor preview** — canvas compositing with transforms (position, scale, rotation,
  opacity), blend modes, crop, color correction (brightness, contrast, saturation, hue,
  temperature, tint, exposure, gamma, vignette, blur, sharpen, grayscale, sepia, invert),
  LUT-style preset looks, transitions (crossfade, dip to black/white, slide, wipe, zoom),
  animated text overlays and 0.25x–4x speed control with optional pitch preservation.
- **Live audio graph** — Web Audio API routing per clip: volume, pan, fade in/out, mute,
  track mute/solo, and a mixer panel.
- **Real export pipeline** — the timeline is rendered through the *same compositor* as the
  preview onto a capture canvas, audio is mixed through the Web Audio graph into a
  `MediaStreamAudioDestinationNode`, and `MediaRecorder` encodes WebM (VP9/VP8 + Opus) by
  default. An optional local `ffmpeg.wasm` pass converts to MP4/H.264 (see below).
  Determinate progress, frame counter, ETA and cancel are all supported.
- **Local-first persistence** — IndexedDB (via `idb-keyval`) for project documents and
  metadata; the Origin Private File System (with IndexedDB fallback) for large media blobs.
  Autosave with a visible *Saved* indicator, session recovery, `.wadheek` project
  export/import (zip manifest + media via `fflate`).
- **Modern app shell** — TanStack Router (file-based, type-safe, search-param editor state),
  TanStack Query for async local operations, Zustand + zundo command-grouped undo/redo,
  TanStack Form + Zod validation, shadcn/ui primitives, Tailwind design tokens,
  Framer Motion, light/dark/system theming, Ctrl/Cmd+K command palette, full keyboard
  navigation and ARIA live-region announcements.
- **Responsive by design** — three-column resizable desktop layout, two-column tablet,
  single-column phone with pinned preview, bottom-sheet panels, 44px touch targets and
  pinch-to-zoom on the timeline.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle in dist/
npm run preview  # serve the production build
```

> Requires Node 18+ and a modern browser (see the support matrix below).

### TanStack Router codegen

Routes live in `src/routes/`. The `@tanstack/router-plugin` Vite plugin regenerates
`src/routeTree.gen.ts` automatically on `npm run dev` and `npm run build` — you never edit
that file by hand. Adding a file such as `src/routes/editor.$projectId.tsx` immediately
yields a fully typed `/editor/$projectId` route.

### COOP/COEP & ffmpeg.wasm (optional MP4 path)

WebM export works out of the box. For MP4/H.264 output Wadheek can run a local
`ffmpeg.wasm` transcode pass, which needs:

1. **The wasm core served from your own origin** (no runtime network fetches):

   ```
   public/ffmpeg/ffmpeg-core.js
   public/ffmpeg/ffmpeg-core.wasm
   ```

   Copy them from the `@ffmpeg/core` (single-thread) npm package or the ffmpeg.wasm
   release archives.

2. **Cross-origin isolation headers**, already configured in `vite.config.ts` for dev and
   preview:

   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: credentialless
   ```

   Configure the same headers on whatever static host serves your production build.
   Without them `SharedArrayBuffer` is unavailable and the multi-threaded core cannot run
   (the single-threaded core still works).

If the core files are absent, the Export dialog transparently falls back to WebM and says
so — nothing breaks.

## Browser support

| Capability | Chrome / Edge 110+ | Firefox 115+ | Safari 16.4+ |
|---|---|---|---|
| Editing, preview, autosave | Yes | Yes | Yes |
| OPFS blob storage | Yes | Yes (fallback used where needed) | Yes |
| WebM export (MediaRecorder) | Yes | Yes | Partial (Safari records MP4/H.264 natively instead) |
| MP4 via ffmpeg.wasm | Yes | Yes | Yes (single-thread core) |
| Pinch-zoom timeline | Yes | Yes | Yes |

Chromium-based browsers give the best export performance.

## Keyboard shortcuts

| Action | Keys |
|---|---|
| Play / pause | `Space` |
| Shuttle | `J` / `K` / `L` |
| Step frame (10 frames) | `Left` / `Right` (`Shift` + arrows) |
| Go to start / end | `Home` / `End` |
| Mark in / out | `I` / `O` |
| Add marker | `M` |
| Split at playhead | `S` |
| Delete / ripple delete | `Delete` / `Shift+Delete` |
| Duplicate | `Ctrl/Cmd+D` |
| Copy / paste at playhead | `Ctrl/Cmd+C` / `Ctrl/Cmd+V` |
| Select all / deselect | `Ctrl/Cmd+A` / `Esc` |
| Undo / redo | `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` |
| Zoom in / out / fit | `+` / `-` / `\` |
| Toggle snapping / loop | `N` / `R` |
| Command palette | `Ctrl/Cmd+K` |
| Export | `Ctrl/Cmd+E` |
| Shortcut reference | `?` |

Hold `Alt` while dragging or trimming to temporarily disable snapping.
`Ctrl/Cmd + mouse wheel` zooms the timeline at the cursor; two-finger pinch works on touch.

## File structure

```
├─ index.html                      # inline SVG favicon, theme pre-paint script
├─ vite.config.ts                  # router codegen plugin, COOP/COEP headers
├─ tailwind.config.ts              # semantic token → utility mapping only
├─ src/
│  ├─ main.tsx / router.tsx / routeTree.gen.ts
│  ├─ styles/globals.css           # ALL design tokens (light + dark)
│  ├─ routes/                      # __root, index (dashboard), editor.$projectId,
│  │                               # settings, not-found
│  ├─ config/                      # copy.ts (all strings), defaults.ts, limits.ts,
│  │                               # shortcuts.ts, nav.ts, export-presets.ts
│  ├─ components/
│  │  ├─ ui/                       # shadcn/ui primitives (never edited ad hoc)
│  │  ├─ theme/                    # ThemeProvider + Light/Dark/System toggle
│  │  ├─ common/                   # Logo, EmptyState, ConfirmDialog, TimecodeInput,
│  │  │                            # ColorPicker, IconButton, KeyboardKey, …
│  │  └─ layout/                   # AppHeader, MobileNav, BottomSheet
│  ├─ features/
│  │  ├─ editor/
│  │  │  ├─ components/            # EditorShell, TopBar, PreviewPlayer, Timeline,
│  │  │  │                         # TimelineRuler, TrackList, Track, Clip, Playhead,
│  │  │  │                         # InspectorPanel, FilterPanel, TextOverlayEditor,
│  │  │  │                         # TransitionPanel, AudioMixer, SpeedControl,
│  │  │  │                         # CropPanel, ExportDialog, CommandPalette, …
│  │  │  ├─ hooks/                 # useEditorStore, usePlayback, useClipDrag, useTrim,
│  │  │  │                         # useSnapping, useUndoRedo, useKeyboardShortcuts,
│  │  │  │                         # useMediaImport, useThumbnails, useWaveform,
│  │  │  │                         # useExport, useAutoSave, useResponsiveLayout
│  │  │  ├─ lib/                   # timeline-math, snapping-engine, clip-operations,
│  │  │  │                         # split-clip, ripple-delete, canvas-compositor,
│  │  │  │                         # webgl-filters, audio-graph, playback-engine,
│  │  │  │                         # exporter-mediarecorder, exporter-ffmpeg,
│  │  │  │                         # wasm-loader, idb-storage, opfs-storage,
│  │  │  │                         # media-probe, thumbnail-generator,
│  │  │  │                         # waveform-extractor, project-schema/serializer
│  │  │  └─ types/                 # project, timeline, clip, track, media, export
│  │  ├─ media/                    # media store (import pipeline)
│  │  ├─ projects/                 # project CRUD + dashboard components
│  │  └─ settings/
│  ├─ hooks/                       # useMediaQuery, useLocalStorage, useEventListener,
│  │                               # useResizeObserver, useIsMobile
│  └─ lib/                         # cn(), ids, formatting, download helpers
└─ public/ffmpeg/                  # optional ffmpeg.wasm core (see above)
```

## Theming & configuration

Nothing visual or textual is hardcoded in components:

- **Colors / radii / shadows / motion** — CSS custom properties in
  `src/styles/globals.css` (`:root` = light, `.dark` = dark). Components only use semantic
  utilities (`bg-background`, `text-muted-foreground`, `bg-track-audio`, `bg-playhead`, …).
- **Copy** — every user-facing string lives in `src/config/copy.ts`.
- **Behavior** — track limits, snapping thresholds, zoom bounds, speed range, transition
  and filter definitions, export presets: `src/config/defaults.ts`, `limits.ts`,
  `export-presets.ts`, `shortcuts.ts`.

## License

MIT — see [LICENSE](LICENSE).
