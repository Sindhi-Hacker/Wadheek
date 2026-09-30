import * as React from "react";
import { AudioLines, Brush, Shapes, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { COPY } from "@/config/copy";
import { TRACK_KIND_META } from "@/config/defaults";
import type { Clip as ClipType } from "../types/clip";
import type { Track as TrackType } from "../types/track";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { useClipDrag } from "../hooks/useClipDrag";
import { useTrim } from "../hooks/useTrim";
import { useThumbnails } from "../hooks/useThumbnails";
import { useWaveform } from "../hooks/useWaveform";
import { getAsset } from "@/features/media/media-store";
import { addFreezeFrame } from "../lib/clip-tools";
import { KEYFRAME_PROPERTIES, PROP_COLORS } from "../lib/keyframes";
import type { KeyframeProperty } from "../types/clip";

function clipKindClass(kind: ClipType["kind"]): string {
  switch (kind) {
    case "audio":
      return TRACK_KIND_META.audio.clipClass;
    case "text":
      return TRACK_KIND_META.text.clipClass;
    case "image":
    case "drawing":
      return TRACK_KIND_META.overlay.clipClass;
    case "sticker":
      return TRACK_KIND_META.text.clipClass;
    default:
      return TRACK_KIND_META.video.clipClass;
  }
}

/** Small diamond marker row for the clip's keyframes (all properties). */
function KeyframeStrip({ clip, pps }: { clip: ClipType; pps: number }) {
  const times = React.useMemo(() => {
    const set = new Set<number>();
    for (const kfs of Object.values(clip.keyframes ?? {})) {
      for (const kf of kfs ?? []) set.add(kf.time);
    }
    return [...set].sort((a, b) => a - b);
  }, [clip.keyframes]);
  if (times.length === 0) return null;
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-2.5" aria-hidden>
      {times.map((t) => (
        <span
          key={t}
          className="absolute bottom-0.5 block h-1.5 w-1.5 -translate-x-1/2 rotate-45 border border-black/50 bg-white"
          style={{ left: (t - clip.start) * pps }}
        />
      ))}
    </div>
  );
}

/** Colored dot legend per keyframed property (shown when zoomed in). */
function KeyframeLegend({ clip }: { clip: ClipType }) {
  const props = (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).filter(
    (prop) => (clip.keyframes?.[prop] ?? []).length > 0
  );
  if (props.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-1 top-1 z-10 flex gap-0.5" aria-hidden>
      {props.slice(0, 6).map((prop) => (
        <span
          key={prop}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: PROP_COLORS[prop] ?? "#fff" }}
          title={KEYFRAME_PROPERTIES[prop]?.label ?? prop}
        />
      ))}
    </div>
  );
}

function WaveformStrip({ clip }: { clip: ClipType }) {
  const { peaks } = useWaveform(clip.mediaId);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const asset = getAsset(clip.mediaId);
    const sourceDur = asset?.duration || clip.duration;
    const startFrac = Math.min(1, clip.inOffset / sourceDur);
    const endFrac = Math.min(1, (clip.inOffset + clip.duration * clip.speed) / sourceDur);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const style = getComputedStyle(document.documentElement);
    ctx.fillStyle = `hsl(${style.getPropertyValue("--waveform")})`;
    ctx.globalAlpha = 0.85;

    const count = Math.floor(canvas.width / (2 * dpr));
    const mid = canvas.height / 2;
    for (let i = 0; i < count; i++) {
      const frac = startFrac + ((endFrac - startFrac) * i) / count;
      const idx = Math.min(peaks.length - 1, Math.floor(frac * peaks.length));
      const amp = Math.max(0.05, peaks[idx] ?? 0);
      const h = amp * (canvas.height * 0.85);
      ctx.fillRect(i * 2 * dpr, mid - h / 2, dpr * 1.4, h);
    }
  }, [peaks, clip.inOffset, clip.duration, clip.speed, clip.mediaId]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}

function Filmstrip({ clip }: { clip: ClipType }) {
  const { thumbnails } = useThumbnails(clip.mediaId);
  if (thumbnails.length === 0) return null;
  return (
    <div className="absolute inset-0 flex overflow-hidden opacity-70" aria-hidden>
      {thumbnails.map((url, i) => (
        <img key={i} src={url} alt="" className="h-full min-w-0 flex-1 object-cover" draggable={false} />
      ))}
    </div>
  );
}

interface ClipProps {
  clip: ClipType;
  track: TrackType;
}

export const Clip = React.memo(function Clip({ clip, track }: ClipProps) {
  const { pps, selected } = useEditor((s) => ({
    pps: s.pps,
    selected: s.selection.includes(clip.id),
  }));
  const drag = useClipDrag(clip.id);
  const { startHandleProps, endHandleProps } = useTrim(clip.id);

  const left = clip.start * pps;
  const width = Math.max(6, clip.duration * pps);
  const showFades = clip.kind === "audio" || (clip.mediaId && clip.audio.volume > 0);

  const doAction = (fn: (s: ReturnType<typeof useEditorStore.getState>) => void) => () =>
    fn(useEditorStore.getState());

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group absolute top-1 bottom-1 cursor-grab touch-none select-none overflow-hidden rounded-md border border-foreground/10 shadow-elevation-1 transition-shadow duration-fast active:cursor-grabbing",
            clipKindClass(clip.kind),
            selected && "ring-2 ring-ring ring-offset-1 ring-offset-timeline",
            track.locked && "cursor-not-allowed opacity-60"
          )}
          style={{ left, width }}
          data-clip-id={clip.id}
          role="button"
          tabIndex={0}
          aria-label={`${clip.label}, ${clip.duration.toFixed(1)} seconds`}
          onKeyDown={(e) => {
            if (e.key === "Enter") useEditorStore.getState().select([clip.id]);
          }}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
        >
          {clip.kind === "video" && width > 40 && <Filmstrip clip={clip} />}
          {clip.kind === "audio" && width > 24 && <WaveformStrip clip={clip} />}

          {/* Fade wedges */}
          {showFades && clip.audio.fadeIn > 0 && (
            <div
              className="absolute left-0 top-0 h-full bg-foreground/20"
              style={{
                width: clip.audio.fadeIn * pps,
                clipPath: "polygon(0 100%, 100% 0, 0 0)",
              }}
              aria-hidden
            />
          )}
          {showFades && clip.audio.fadeOut > 0 && (
            <div
              className="absolute right-0 top-0 h-full bg-foreground/20"
              style={{
                width: clip.audio.fadeOut * pps,
                clipPath: "polygon(100% 100%, 100% 0, 0 0)",
              }}
              aria-hidden
            />
          )}

          <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between px-1.5 py-1">
            <span className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight drop-shadow-sm">
              {clip.kind === "text" && <TypeIcon className="h-3 w-3 shrink-0" />}
              {clip.kind === "audio" && <AudioLines className="h-3 w-3 shrink-0" />}
              {clip.kind === "sticker" && <Shapes className="h-3 w-3 shrink-0" />}
              {clip.kind === "drawing" && <Brush className="h-3 w-3 shrink-0" />}
              <span className="truncate">
                {clip.kind === "text" ? clip.text?.content || clip.label : clip.label}
              </span>
            </span>
            {clip.speed !== 1 && width > 48 && (
              <span className="self-start rounded-sm bg-foreground/25 px-1 font-mono text-[9px] leading-tight">
                {clip.speed}x
              </span>
            )}
          </div>

          {/* Trim handles */}
          {!track.locked && (
            <>
              <div
                {...startHandleProps}
                className={cn(
                  "absolute inset-y-0 left-0 z-20 w-2.5 cursor-ew-resize touch-none md:w-2",
                  "opacity-0 transition-opacity duration-fast group-hover:opacity-100",
                  selected && "opacity-100"
                )}
                aria-hidden
              >
                <div className="mx-auto mt-[25%] h-1/2 w-1 rounded-full bg-foreground/60" />
              </div>
              <div
                {...endHandleProps}
                className={cn(
                  "absolute inset-y-0 right-0 z-20 w-2.5 cursor-ew-resize touch-none md:w-2",
                  "opacity-0 transition-opacity duration-fast group-hover:opacity-100",
                  selected && "opacity-100"
                )}
                aria-hidden
              >
                <div className="mx-auto mt-[25%] h-1/2 w-1 rounded-full bg-foreground/60" />
              </div>
            </>
          )}

          {/* Keyframe markers */}
          <KeyframeStrip clip={clip} pps={pps} />
          <KeyframeLegend clip={clip} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={doAction((s) => {
            s.select([clip.id]);
            const n = s.splitAtTime(s.currentTime);
            if (n > 0) toast(COPY.toasts.clipSplit);
          })}
        >
          {COPY.editor.split}
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={doAction((s) => {
            s.select([clip.id]);
            s.duplicateSelection();
          })}
        >
          {COPY.editor.duplicate}
          <ContextMenuShortcut>Ctrl D</ContextMenuShortcut>
        </ContextMenuItem>
        {clip.kind === "text" && (
          <ContextMenuItem
            onClick={doAction((s) => {
              s.select([clip.id]);
              s.requestTextEdit();
            })}
          >
            Edit on canvas
          </ContextMenuItem>
        )}
        {clip.kind === "video" && (
          <>
            <ContextMenuItem
              onClick={() => {
                useEditorStore.getState().select([clip.id]);
                void addFreezeFrame(clip.id);
              }}
            >
              Freeze frame at playhead
            </ContextMenuItem>
            <ContextMenuItem
              onClick={doAction((s) => {
                s.select([clip.id]);
                const ok = s.detachAudio(clip.id);
                toast(ok ? "Audio detached to its own track" : "Could not detach audio");
              })}
            >
              Detach audio
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem
          onClick={doAction((s) => {
            s.select([clip.id]);
            const n = s.copySelection();
            if (n > 0) toast(COPY.toasts.clipsCopied(n));
          })}
        >
          {COPY.editor.copy}
          <ContextMenuShortcut>Ctrl C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={doAction((s) => {
            const n = s.deleteClips([clip.id]);
            if (n > 0) toast(COPY.toasts.clipsDeleted(n));
          })}
        >
          {COPY.editor.delete}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={doAction((s) => {
            const n = s.rippleDeleteClips([clip.id]);
            if (n > 0) toast(COPY.toasts.clipsDeleted(n));
          })}
        >
          {COPY.editor.rippleDelete}
          <ContextMenuShortcut>Shift Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
