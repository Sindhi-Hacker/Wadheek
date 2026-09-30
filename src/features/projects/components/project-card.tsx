import * as React from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clapperboard, Copy, Download, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/common/icon-button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COPY } from "@/config/copy";
import { formatDuration } from "@/features/editor/lib/time-format";
import type { ProjectSummary } from "@/features/editor/types/project";

interface ProjectCardProps {
  project: ProjectSummary;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectCard({ project, onRename, onDuplicate, onDelete, onExport }: ProjectCardProps) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [name, setName] = React.useState(project.name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <div className="group relative overflow-hidden rounded-xl border bg-card shadow-elevation-1 transition-shadow duration-normal hover:shadow-elevation-2">
        <Link
          to="/editor/$projectId"
          params={{ projectId: project.id }}
          className="block"
          aria-label={`${COPY.dashboard.open} ${project.name}`}
        >
          <div className="flex aspect-video items-center justify-center bg-muted">
            <Clapperboard className="h-8 w-8 text-muted-foreground/50 transition-transform duration-normal group-hover:scale-110" />
          </div>
        </Link>
        <div className="flex items-start justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link
              to="/editor/$projectId"
              params={{ projectId: project.id }}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {project.name}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>
                {COPY.dashboard.lastEdited} {formatDate(project.updatedAt)}
              </span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {project.aspectId}
              </Badge>
              {project.duration > 0 && <span>{formatDuration(project.duration)}</span>}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span>
                <IconButton label="Project actions" tooltip={false}>
                  <MoreVertical className="h-4 w-4" />
                </IconButton>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil /> {COPY.dashboard.rename}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(project.id)}>
                <Copy /> {COPY.dashboard.duplicate}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(project.id)}>
                <Download /> {COPY.dashboard.export}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 /> {COPY.dashboard.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={COPY.dashboard.deleteConfirmTitle}
        description={COPY.dashboard.deleteConfirmBody}
        destructive
        onConfirm={() => onDelete(project.id)}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{COPY.dashboard.rename}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                onRename(project.id, name.trim());
                setRenameOpen(false);
              }
            }}
            className="space-y-4"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="submit">{COPY.dashboard.rename}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
