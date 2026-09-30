import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/common/icon-button";
import { cn } from "@/lib/utils";
import { COPY } from "@/config/copy";
import { TRACK_KIND_META } from "@/config/defaults";
import type { Track as TrackType } from "../types/track";
import { useEditorStore } from "../hooks/useEditorStore";
import { trackHeight } from "./Track";

interface TrackHeaderProps {
  track: TrackType;
  compact: boolean;
}

/** Track header cell: name, mute/solo/lock/hide toggles, reorder + delete. */
export function TrackHeader({ track, compact }: TrackHeaderProps) {
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(track.name);
  const store = useEditorStore.getState;

  const commit = () => {
    setRenaming(false);
    if (draft.trim()) store().renameTrack(track.id, draft.trim());
  };

  const kindMeta = TRACK_KIND_META[track.kind];

  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-sidebar-border bg-sidebar px-1.5",
        track.hidden && "opacity-60"
      )}
      style={{ height: trackHeight(track, compact) }}
    >
      <span
        className={cn("h-2/3 w-1 shrink-0 rounded-full", kindMeta.clipClass.split(" ")[0])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-6 w-full rounded-sm border border-input bg-background px-1 text-xs"
            aria-label={COPY.editor.renameTrack}
          />
        ) : (
          <button
            className="block w-full truncate rounded-sm px-1 text-left text-xs font-medium hover:bg-sidebar-accent"
            onDoubleClick={() => {
              setDraft(track.name);
              setRenaming(true);
            }}
            title={track.name}
          >
            {track.name}
          </button>
        )}
        {!compact && (
          <div className="mt-0.5 flex items-center gap-0.5">
            {track.kind === "audio" || track.kind === "video" ? (
              <IconButton
                label={COPY.editor.mute}
                tooltip={false}
                size="icon-sm"
                className={cn("h-5 w-5", track.muted && "text-destructive")}
                onClick={() => store().setTrackFlag(track.id, "muted", !track.muted)}
                aria-pressed={track.muted}
              >
                {track.muted ? <VolumeX className="!h-3 !w-3" /> : <Volume2 className="!h-3 !w-3" />}
              </IconButton>
            ) : null}
            <IconButton
              label={COPY.editor.solo}
              tooltip={false}
              size="icon-sm"
              className={cn("h-5 w-5", track.solo && "text-warning")}
              onClick={() => store().setTrackFlag(track.id, "solo", !track.solo)}
              aria-pressed={track.solo}
            >
              <Headphones className="!h-3 !w-3" />
            </IconButton>
            {track.kind !== "audio" && (
              <IconButton
                label={COPY.editor.hide}
                tooltip={false}
                size="icon-sm"
                className="h-5 w-5"
                onClick={() => store().setTrackFlag(track.id, "hidden", !track.hidden)}
                aria-pressed={track.hidden}
              >
                {track.hidden ? <EyeOff className="!h-3 !w-3" /> : <Eye className="!h-3 !w-3" />}
              </IconButton>
            )}
            <IconButton
              label={COPY.editor.lock}
              tooltip={false}
              size="icon-sm"
              className={cn("h-5 w-5", track.locked && "text-warning")}
              onClick={() => store().setTrackFlag(track.id, "locked", !track.locked)}
              aria-pressed={track.locked}
            >
              {track.locked ? <Lock className="!h-3 !w-3" /> : <LockOpen className="!h-3 !w-3" />}
            </IconButton>
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span>
            <IconButton label="Track options" tooltip={false} size="icon-sm" className="h-6 w-6">
              <MoreVertical className="!h-3.5 !w-3.5" />
            </IconButton>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              setDraft(track.name);
              setRenaming(true);
            }}
          >
            <Pencil /> {COPY.editor.renameTrack}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => store().moveTrack(track.id, -1)}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => store().moveTrack(track.id, 1)}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              store().deleteTrack(track.id);
              toast(COPY.toasts.trackDeleted);
            }}
          >
            <Trash2 /> {COPY.editor.deleteTrack}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
