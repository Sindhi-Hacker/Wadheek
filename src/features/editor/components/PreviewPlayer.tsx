import * as React from "react";
import {
  ChevronFirst,
  ChevronLast,
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { IconButton } from "@/components/common/icon-button";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { COPY } from "@/config/copy";
import { cn } from "@/lib/utils";
import { formatTimecode } from "../lib/time-format";
import { timelineDuration } from "../lib/timeline-math";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { usePlayback } from "../hooks/usePlayback";

const CONTROLS_HIDE_DELAY_MS = 2600;

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenTarget(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Program monitor: composites the timeline onto a canvas at project
 * resolution and letterboxes it into the viewport with an explicit,
 * measured contain-fit (no CSS-only sizing, so no cropping at any ratio).
 * Doubles as a fullscreen player with transport controls.
 */
export function PreviewPlayer() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [wrapRef, wrapSize] = useResizeObserver<HTMLDivElement>();

  const settings = useEditor((s) => s.settings);
  usePlayback(canvasRef);

  const [nativeFullscreen, setNativeFullscreen] = React.useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = React.useState(false);
  const isFullscreen = nativeFullscreen || pseudoFullscreen;

  /* ---------------- explicit letterbox fit ---------------- */
  const fit = React.useMemo(() => {
    const { width: bw, height: bh } = wrapSize;
    if (bw <= 0 || bh <= 0 || settings.width <= 0 || settings.height <= 0) return null;
    const scale = Math.min(bw / settings.width, bh / settings.height);
    return {
      width: Math.max(1, Math.floor(settings.width * scale)),
      height: Math.max(1, Math.floor(settings.height * scale)),
    };
  }, [wrapSize, settings.width, settings.height]);

  /* ---------------- fullscreen plumbing ---------------- */
  React.useEffect(() => {
    const onChange = () => {
      setNativeFullscreen(fullscreenTarget() === stageRef.current && stageRef.current !== null);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const enterFullscreen = React.useCallback(async () => {
    const el = stageRef.current as FullscreenElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        return;
      }
    } catch {
      /* fall through to the overlay fallback */
    }
    // iOS Safari (and any blocked context): fixed-position overlay fallback.
    setPseudoFullscreen(true);
  }, []);

  const exitFullscreen = React.useCallback(() => {
    const doc = document as FullscreenDocument;
    if (fullscreenTarget()) {
      if (doc.exitFullscreen) void doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
    }
    setPseudoFullscreen(false);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else void enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // ESC exits the overlay fallback (native fullscreen handles ESC itself).
  React.useEffect(() => {
    if (!pseudoFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPseudoFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pseudoFullscreen]);

  /* ---------------- auto-hiding controls ---------------- */
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const hideTimer = React.useRef<number | null>(null);
  const playing = useEditor((s) => s.playing);

  const pokeControls = React.useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Keep controls up while paused, like a real player.
      if (useEditorStore.getState().playing) setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY_MS);
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) return;
    pokeControls();
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [isFullscreen, pokeControls]);

  React.useEffect(() => {
    if (isFullscreen && !playing) setControlsVisible(true);
  }, [isFullscreen, playing]);

  return (
    <div
      ref={stageRef}
      className={cn(
        "group relative flex min-h-0 flex-1 flex-col overflow-hidden bg-panel",
        pseudoFullscreen && "fixed inset-0 z-50"
      )}
      aria-label={COPY.editor.previewLabel}
      role="region"
      onPointerMove={isFullscreen ? pokeControls : undefined}
      onPointerDown={isFullscreen ? pokeControls : undefined}
    >
      <div
        ref={wrapRef}
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
          isFullscreen ? "p-0" : "p-3 md:p-4",
          isFullscreen && !controlsVisible && "cursor-none"
        )}
      >
        <canvas
          ref={canvasRef}
          width={settings.width}
          height={settings.height}
          className={cn(!isFullscreen && "rounded-md shadow-elevation-2")}
          style={fit ? { width: fit.width, height: fit.height } : { width: "100%", height: "auto" }}
          onDoubleClick={toggleFullscreen}
          onClick={isFullscreen ? () => useEditorStore.getState().togglePlay() : undefined}
        />

        {/* Corner fullscreen affordance (normal mode) */}
        {!isFullscreen && (
          <div className="absolute right-2 top-2 opacity-100 transition-opacity duration-fast md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <IconButton
              label={COPY.editor.fullscreen}
              className="bg-background/70 shadow-elevation-1 backdrop-blur-[var(--blur-overlay)] hover:bg-background/90"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>

      {isFullscreen && (
        <FullscreenControls
          visible={controlsVisible}
          onInteract={pokeControls}
          onExit={exitFullscreen}
        />
      )}
    </div>
  );
}

/** Player chrome shown along the bottom edge while in fullscreen. */
function FullscreenControls({
  visible,
  onInteract,
  onExit,
}: {
  visible: boolean;
  onInteract: () => void;
  onExit: () => void;
}) {
  const { playing, currentTime, fps, loop, tracks } = useEditor((s) => ({
    playing: s.playing,
    currentTime: s.currentTime,
    fps: s.settings.fps,
    loop: s.loop,
    tracks: s.tracks,
  }));
  const store = useEditorStore.getState;
  const duration = Math.max(timelineDuration(tracks), 0.001);
  const frame = 1 / fps;

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 bg-gradient-to-t from-panel via-panel/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-normal",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      onPointerMove={onInteract}
      onPointerDown={onInteract}
    >
      <Slider
        value={[Math.min(currentTime, duration)]}
        min={0}
        max={duration}
        step={frame}
        onValueChange={([v]) => {
          if (v !== undefined) store().setCurrentTime(v);
        }}
        aria-label={COPY.a11y.playhead}
        className="w-full"
      />
      <div className="flex items-center gap-0.5 text-panel-foreground">
        <IconButton label={COPY.editor.goToStart} onClick={() => store().setCurrentTime(0)}>
          <ChevronFirst className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={COPY.editor.prevFrame}
          onClick={() => {
            store().setPlaying(false);
            store().setCurrentTime(store().currentTime - frame);
          }}
        >
          <SkipBack className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={playing ? COPY.editor.pause : COPY.editor.play}
          variant="secondary"
          size="icon"
          className="mx-1 rounded-full"
          onClick={() => store().togglePlay()}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </IconButton>
        <IconButton
          label={COPY.editor.nextFrame}
          onClick={() => {
            store().setPlaying(false);
            store().setCurrentTime(store().currentTime + frame);
          }}
        >
          <SkipForward className="h-4 w-4" />
        </IconButton>
        <IconButton label={COPY.editor.goToEnd} onClick={() => store().setCurrentTime(duration)}>
          <ChevronLast className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={COPY.editor.loop}
          className={cn(loop && "bg-accent text-primary")}
          onClick={() => store().toggleLoop()}
          aria-pressed={loop}
        >
          <Repeat className="h-4 w-4" />
        </IconButton>

        <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
          {formatTimecode(currentTime, fps)} / {formatTimecode(duration, fps)}
        </span>

        <div className="ml-auto">
          <IconButton label={COPY.editor.exitFullscreen} onClick={onExit}>
            <Minimize className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
