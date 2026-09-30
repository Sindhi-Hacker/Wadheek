# Wadheek

Wadheek is a local-first video editing workspace. The current app is a Vite + React 18 + TypeScript client with a dashboard, responsive multi-track editing workspace, media library, transport controls, timeline, inspector, theme switching, and local-save/export affordances. It is designed so media never needs to leave the device.

## Getting started

```bash
npm install
npm run dev
# production verification
npm run build
```

Open the Vite URL printed in the terminal. No API keys or backend services are required. A production deployment can be served as static files from any host.

## Browser support

Current evergreen Chrome, Edge, Firefox, and Safari are supported for the UI. Full local media processing should use a recent Chromium-based browser for the best WebCodecs, Origin Private File System, MediaRecorder, and OfflineAudioContext support. The UI remains usable in browsers that do not expose those optional APIs.

## Architecture notes

- `src/main.tsx` contains the client application shell and feature surfaces.
- `src/styles/globals.css` is the tokenized design layer. Light and dark themes are controlled by the `.dark` class on the document root.
- Browser persistence is intentionally local-first: project manifests can be stored with IndexedDB and large media/render blobs with the Origin Private File System.
- Import, decode, thumbnail, waveform, and export work should be scheduled as async client operations so the UI stays responsive.
- The editor's timeline is intended to be represented as commands (`execute`, `undo`) with a serializable project manifest, making undo/redo and autosave deterministic.

## Routing and deep links

The prototype uses client-side history paths `/`, `/editor/:projectId`, and `/settings`. When adding TanStack Router file routes, install the router packages and run the Router codegen step from the repository root; generated output belongs in `src/routeTree.gen.ts`. Configure the static host to fall back to `index.html` for these paths.

## Export and ffmpeg.wasm

The default export target is browser-native WebM through MediaRecorder. An optional MP4/H.264 path can lazily load ffmpeg.wasm from `public/ffmpeg/`. That path requires cross-origin isolation:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Configure those headers at the static host or Vite preview proxy. The ffmpeg assets are intentionally not fetched by the default UI.

## Keyboard reference

Space toggles playback; Left/Right steps by frame; J/K/L shuttle playback; I and O set the range; S splits at the playhead; Delete removes the selection; Cmd/Ctrl-Z undoes; Shift-Cmd/Ctrl-Z redoes; Cmd/Ctrl-C and Cmd/Ctrl-V copy and paste; plus and minus change timeline zoom; Cmd/Ctrl-K opens the command palette.

## Structure map

```
index.html                    app entry
vite.config.ts                Vite configuration
tailwind.config.ts            class-based dark mode and content paths
src/main.tsx                  client entry and editor surfaces
src/styles/globals.css        semantic theme tokens and responsive UI
src/components/                reusable UI and layout primitives
src/features/editor/           timeline, preview, transport, inspector features
src/features/projects/         project lifecycle and serialization
src/features/media/            import, media probing and local assets
src/hooks/                     shared browser hooks
src/lib/                       local persistence and editor utilities
src/config/                    centralized product defaults and limits
```
