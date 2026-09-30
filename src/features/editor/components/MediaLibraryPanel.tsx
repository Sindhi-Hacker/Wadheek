import * as React from "react";
import { AudioLines, FileVideo, Image as ImageIcon, Import, Plus, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { showAlert } from "@/components/common/dialog-service";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { COPY } from "@/config/copy";
import { ACCEPT_ATTRIBUTE } from "@/config/limits";
import { formatBytes } from "@/lib/utils";
import { useMediaStore } from "@/features/media/media-store";
import type { MediaAsset } from "../types/media";
import { formatDuration } from "../lib/time-format";
import { useMediaImport } from "../hooks/useMediaImport";
import { useThumbnails } from "../hooks/useThumbnails";
import { useEditorStore } from "../hooks/useEditorStore";

function MediaTypeIcon({ type }: { type: MediaAsset["type"] }) {
  if (type === "video") return <FileVideo className="h-4 w-4" />;
  if (type === "audio") return <AudioLines className="h-4 w-4" />;
  return <ImageIcon className="h-4 w-4" />;
}

function MediaItem({ asset }: { asset: MediaAsset }) {
  const { thumbnails } = useThumbnails(asset.id);
  const removeAsset = useMediaStore((s) => s.removeAsset);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const addToTimeline = () => {
    const store = useEditorStore.getState();
    const id = store.addClipFromMedia(asset, { time: store.currentTime });
    if (!id) {
      void showAlert({
        variant: "error",
        title: COPY.dialogs.addToTimelineFailedTitle,
        description: COPY.dialogs.addToTimelineFailedBody,
      });
    }
  };

  const remove = async () => {
    useEditorStore.getState().removeMediaClips(asset.id);
    await removeAsset(asset.id);
    toast(COPY.toasts.mediaRemoved);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            className="group w-full rounded-lg border bg-card p-2 text-left shadow-elevation-1 transition-shadow duration-fast hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onDoubleClick={addToTimeline}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-wadheek-media", asset.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            aria-label={`${asset.name}. Double-click or use the context menu to add to timeline.`}
          >
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted">
              {thumbnails.length > 0 ? (
                <img src={thumbnails[0]} alt="" className="h-full w-full object-cover" />
              ) : asset.type === "audio" ? (
                <AudioLines className="h-6 w-6 text-track-audio" />
              ) : (
                <MediaTypeIcon type={asset.type} />
              )}
              {asset.duration > 0 && (
                <span className="absolute bottom-1 right-1 rounded-sm bg-foreground/70 px-1 font-mono text-[10px] text-background">
                  {formatDuration(asset.duration)}
                </span>
              )}
              <span
                className="absolute inset-0 hidden items-center justify-center bg-foreground/40 group-hover:flex"
                aria-hidden
              >
                <Plus className="h-5 w-5 text-background" />
              </span>
            </div>
            <p className="mt-1.5 truncate text-xs font-medium">{asset.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatBytes(asset.size)}
              {asset.width ? ` · ${asset.width}x${asset.height}` : ""}
            </p>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={addToTimeline}>
            <Plus /> {COPY.mediaLibrary.addToTimeline}
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 /> {COPY.mediaLibrary.remove}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={COPY.mediaLibrary.removeConfirmTitle}
        description={COPY.mediaLibrary.removeConfirmBody}
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}

export function MediaLibraryPanel() {
  const assets = useMediaStore((s) => s.assets);
  const { inputRef, openFilePicker, onInputChange, importing } = useMediaImport();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{COPY.mediaLibrary.title}</h2>
        <Button size="sm" variant="secondary" onClick={openFilePicker} disabled={importing}>
          <Import className="h-3.5 w-3.5" /> {COPY.mediaLibrary.importCta}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={onInputChange}
        aria-hidden
        tabIndex={-1}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {importing && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Skeleton className="aspect-video" />
              <Skeleton className="aspect-video" />
            </div>
          )}
          {assets.length === 0 && !importing ? (
            <EmptyState
              icon={Type}
              title={COPY.mediaLibrary.empty}
              description={COPY.mediaLibrary.emptyBody}
              className="border-0 bg-transparent py-10"
              action={
                <Button size="sm" onClick={openFilePicker}>
                  <Import className="h-3.5 w-3.5" /> {COPY.mediaLibrary.importCta}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-2">
              {assets.map((asset) => (
                <MediaItem key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
