import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  CircleDashed,
  Download,
  Keyboard,
  Loader2,
  Redo2,
  Undo2,
} from "lucide-react";
import { LogoMark } from "@/components/common/logo";
import { IconButton } from "@/components/common/icon-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { COPY } from "@/config/copy";
import { LIMITS } from "@/config/limits";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { useUndoRedo } from "../hooks/useUndoRedo";

interface TopBarProps {
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  compact?: boolean;
}

function SaveIndicator() {
  const saveState = useEditor((s) => s.saveState);
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
      role="status"
      aria-live="polite"
    >
      {saveState === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-success" /> {COPY.editor.saved}
        </>
      )}
      {saveState === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {COPY.editor.saving}
        </>
      )}
      {saveState === "dirty" && (
        <>
          <CircleDashed className="h-3.5 w-3.5" /> {COPY.editor.unsaved}
        </>
      )}
    </span>
  );
}

export function TopBar({ onOpenExport, onOpenShortcuts, compact = false }: TopBarProps) {
  const projectName = useEditor((s) => s.projectName);
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(projectName);

  const commitName = () => {
    setEditing(false);
    const trimmed = draft.trim().slice(0, LIMITS.maxProjectNameLength);
    if (trimmed && trimmed !== projectName) {
      useEditorStore.getState().setProjectName(trimmed);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b bg-sidebar px-2 text-sidebar-foreground md:px-3">
      <IconButton label={COPY.nav.back} asChild tooltip={!compact}>
        <Link to="/">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </IconButton>
      <LogoMark className="hidden h-6 w-6 sm:block" />

      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-56"
          aria-label="Project name"
        />
      ) : (
        <button
          className="max-w-[9rem] truncate rounded-md px-2 py-1 text-sm font-semibold hover:bg-sidebar-accent md:max-w-[16rem]"
          onClick={() => {
            setDraft(projectName);
            setEditing(true);
          }}
          title={projectName}
        >
          {projectName}
        </button>
      )}

      <SaveIndicator />

      <div className="ml-auto flex items-center gap-1">
        <IconButton label={COPY.editor.undo} disabled={!canUndo} onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
        <IconButton label={COPY.editor.redo} disabled={!canRedo} onClick={redo}>
          <Redo2 className="h-4 w-4" />
        </IconButton>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <IconButton label={COPY.editor.shortcuts} onClick={onOpenShortcuts} className="hidden md:inline-flex">
          <Keyboard className="h-4 w-4" />
        </IconButton>
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <Button size="sm" className="ml-1" onClick={onOpenExport}>
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{COPY.editor.export}</span>
        </Button>
      </div>
    </header>
  );
}
