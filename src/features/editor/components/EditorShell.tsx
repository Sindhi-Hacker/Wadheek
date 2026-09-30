import * as React from "react";
import { Film, Import, SlidersHorizontal } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { COPY } from "@/config/copy";
import { ACCEPT_ATTRIBUTE } from "@/config/limits";
import { cn } from "@/lib/utils";
import { TopBar } from "./TopBar";
import { PreviewPlayer } from "./PreviewPlayer";
import { TransportControls } from "./TransportControls";
import { Timeline } from "./Timeline";
import { MediaLibraryPanel } from "./MediaLibraryPanel";
import { InspectorPanel } from "./InspectorPanel";
import { ExportDialog } from "./ExportDialog";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { GlobalCommandPalette, type PaletteCommand } from "./CommandPalette";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useAutoSave } from "../hooks/useAutoSave";
import { useMediaImport } from "../hooks/useMediaImport";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useEditorStore } from "../hooks/useEditorStore";
import { addFreezeFrame, exportCurrentFrame } from "../lib/clip-tools";
import { toast } from "sonner";

/**
 * Editor workspace layout:
 * - desktop: media | preview | inspector over a full-width timeline (resizable)
 * - tablet: preview | inspector over timeline; media in a bottom sheet
 * - phone: pinned preview, compact transport, full-width timeline strip,
 *   panels as bottom sheets from a tab bar
 */
export function EditorShell() {
  const { layout } = useResponsiveLayout();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mediaSheetOpen, setMediaSheetOpen] = React.useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const [dropActive, setDropActive] = React.useState(false);

  const { inputRef, openFilePicker, onInputChange, handleFiles } = useMediaImport();

  useAutoSave();

  const announce = React.useCallback((msg: string) => setAnnouncement(msg), []);

  useKeyboardShortcuts(
    {
      openCommandPalette: () => setPaletteOpen((v) => !v),
      openShortcuts: () => setShortcutsOpen(true),
      openExport: () => setExportOpen(true),
    },
    announce
  );

  const editorCommands = React.useMemo<PaletteCommand[]>(() => {
    const store = useEditorStore.getState;
    return [
      {
        id: "play-pause",
        label: "Play / Pause",
        group: "Editor",
        shortcut: ["Space"],
        run: () => store().togglePlay(),
      },
      {
        id: "split",
        label: COPY.editor.split,
        group: "Editor",
        shortcut: ["S"],
        run: () => {
          const n = store().splitAtTime(store().currentTime);
          if (n > 0) toast(COPY.toasts.clipSplit);
        },
      },
      {
        id: "add-text",
        label: "Add text overlay",
        group: "Editor",
        run: () => store().addTextClip(),
      },
      {
        id: "add-marker",
        label: COPY.editor.addMarker,
        group: "Editor",
        shortcut: ["M"],
        run: () => store().addMarker(store().currentTime),
      },
      {
        id: "freeze-frame",
        label: "Freeze frame at playhead",
        group: "Editor",
        shortcut: ["F"],
        run: () => {
          const target = store().selection[0];
          if (target) void addFreezeFrame(target);
          else toast("Select a video clip first");
        },
      },
      {
        id: "detach-audio",
        label: "Detach audio from video",
        group: "Editor",
        shortcut: ["Shift", "D"],
        run: () => {
          const target = store().selection[0];
          const ok = target ? store().detachAudio(target) : false;
          toast(ok ? "Audio detached" : "Select a single video clip first");
        },
      },
      {
        id: "toggle-draw",
        label: "Toggle draw-on-video tool",
        group: "Editor",
        run: () => {
          const s = store();
          s.setDrawMode(s.drawMode ? null : { color: "#ef4444", width: 8, mode: "pen" });
        },
      },
      {
        id: "toggle-motion-rec",
        label: "Toggle motion recorder (drag to animate)",
        group: "Editor",
        run: () => {
          const s = store();
          s.setMotionRecording(!s.motionRecording);
          toast(s.motionRecording ? "Motion recorder off" : "Armed — drag a clip in the preview");
        },
      },
      {
        id: "toggle-autokey",
        label: "Toggle auto keyframes",
        group: "Editor",
        run: () => {
          store().toggleAutoKeyframes();
          toast(store().autoKeyframes ? "Auto keyframes on" : "Auto keyframes off");
        },
      },
      {
        id: "export-frame",
        label: "Export current frame as PNG",
        group: "Editor",
        run: () => void exportCurrentFrame(),
      },
      {
        id: "import-media",
        label: COPY.mediaLibrary.importCta,
        group: "Editor",
        run: openFilePicker,
      },
      {
        id: "export",
        label: COPY.editor.export,
        group: "Editor",
        shortcut: ["mod", "E"],
        run: () => setExportOpen(true),
      },
      {
        id: "shortcuts",
        label: COPY.editor.shortcuts,
        group: "Editor",
        shortcut: ["?"],
        run: () => setShortcutsOpen(true),
      },
    ];
  }, [openFilePicker]);

  /* Drop-anywhere import */
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDropActive(true);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDropActive(false);
      void handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={onDrop}
    >
      <TopBar
        onOpenExport={() => setExportOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        compact={layout === "phone"}
      />

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

      {layout === "desktop" && (
        <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={58} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={20} minSize={14} maxSize={32}>
                <MediaLibraryPanel />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={56} minSize={30}>
                <div className="flex h-full min-h-0 flex-col">
                  <PreviewPlayer />
                  <TransportControls />
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={24} minSize={16} maxSize={36}>
                <InspectorPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={42} minSize={20}>
            <Timeline onImportRequest={openFilePicker} />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {layout === "tablet" && (
        <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={65} minSize={40}>
                <div className="flex h-full min-h-0 flex-col">
                  <PreviewPlayer />
                  <TransportControls />
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={35} minSize={24}>
                <InspectorPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={20}>
            <Timeline onImportRequest={() => setMediaSheetOpen(true)} />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      {layout === "phone" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex max-h-[42dvh] min-h-[30dvh] flex-col">
            <PreviewPlayer />
            <TransportControls compact />
          </div>
          <div className="min-h-0 flex-1">
            <Timeline compact onImportRequest={() => setMediaSheetOpen(true)} />
          </div>
          {/* Bottom tab bar */}
          <nav
            className="flex items-stretch border-t bg-sidebar text-sidebar-foreground"
            aria-label="Editor panels"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <PhoneTab
              icon={<Film className="h-5 w-5" />}
              label={COPY.editor.media}
              onClick={() => setMediaSheetOpen(true)}
            />
            <PhoneTab
              icon={<SlidersHorizontal className="h-5 w-5" />}
              label={COPY.editor.inspector}
              onClick={() => setInspectorSheetOpen(true)}
            />
            <PhoneTab
              icon={<Import className="h-5 w-5" />}
              label={COPY.mediaLibrary.importCta}
              onClick={openFilePicker}
            />
          </nav>
        </div>
      )}

      {/* Phone / tablet sheets */}
      <BottomSheet open={mediaSheetOpen} onOpenChange={setMediaSheetOpen} title={COPY.editor.media}>
        <div className="h-[55dvh]">
          <MediaLibraryPanel />
        </div>
      </BottomSheet>
      <BottomSheet
        open={inspectorSheetOpen}
        onOpenChange={setInspectorSheetOpen}
        title={COPY.editor.inspector}
      >
        <div className="h-[60dvh]">
          <InspectorPanel />
        </div>
      </BottomSheet>

      {/* Overlays */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <GlobalCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        extraCommands={editorCommands}
      />

      {/* Drop overlay */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 opacity-0 backdrop-blur-[2px] transition-opacity duration-fast",
          dropActive && "opacity-100"
        )}
        aria-hidden
      >
        <div className="rounded-xl border-2 border-dashed border-primary bg-card px-8 py-6 text-sm font-semibold text-primary shadow-elevation-3">
          {COPY.editor.dropHint}
        </div>
      </div>

      {/* Live region for edit announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-label={COPY.a11y.announcements}>
        {announcement}
      </div>
    </div>
  );
}

function PhoneTab({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
