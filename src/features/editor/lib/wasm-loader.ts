/**
 * Lazy loader for the optional ffmpeg.wasm bundle.
 *
 * Wadheek never loads code from the network at runtime. To enable the MP4
 * (H.264) export path, place the ffmpeg.wasm single-thread build into
 * `public/ffmpeg/` (see README — "COOP/COEP & ffmpeg.wasm"):
 *
 *   public/ffmpeg/ffmpeg-core.js
 *   public/ffmpeg/ffmpeg-core.wasm
 *
 * The loader probes for the files locally and reports availability so the UI
 * can offer the option only when it will actually work.
 */

export interface FfmpegHandle {
  exec: (args: string[], input: { name: string; data: Uint8Array }[]) => Promise<Uint8Array | null>;
}

let cachedAvailability: boolean | null = null;

export async function isFfmpegAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;
  try {
    const res = await fetch("/ffmpeg/ffmpeg-core.js", { method: "HEAD" });
    cachedAvailability = res.ok;
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
}

export function hasSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && crossOriginIsolated === true;
}

export async function loadFfmpeg(): Promise<FfmpegHandle | null> {
  if (!(await isFfmpegAvailable())) return null;
  try {
    // The core is loaded as a classic script exposing `createFFmpegCore`.
    await injectScript("/ffmpeg/ffmpeg-core.js");
    const factory = (window as unknown as { createFFmpegCore?: (opts: object) => Promise<FfmpegCore> })
      .createFFmpegCore;
    if (!factory) return null;
    const core = await factory({
      locateFile: (path: string) => `/ffmpeg/${path}`,
    });
    return {
      async exec(args, inputs) {
        for (const file of inputs) core.FS.writeFile(file.name, file.data);
        core.exec(...args);
        try {
          const outName = args[args.length - 1]!;
          return core.FS.readFile(outName);
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

interface FfmpegCore {
  FS: {
    writeFile: (name: string, data: Uint8Array) => void;
    readFile: (name: string) => Uint8Array;
  };
  exec: (...args: string[]) => number;
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
