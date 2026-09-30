import * as React from "react";
import { useEditor } from "../hooks/useEditorStore";
import { usePlayback } from "../hooks/usePlayback";
import { COPY } from "@/config/copy";

/**
 * Program monitor: composites the timeline onto a canvas at project
 * resolution and letterboxes it responsively into any viewport.
 */
export function PreviewPlayer() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const settings = useEditor((s) => s.settings);
  usePlayback(canvasRef);

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-panel p-3 md:p-4"
      aria-label={COPY.editor.previewLabel}
      role="region"
    >
      <canvas
        ref={canvasRef}
        width={settings.width}
        height={settings.height}
        className="max-h-full max-w-full rounded-md shadow-elevation-2"
        style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
      />
    </div>
  );
}
