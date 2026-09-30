import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { showAlert } from "@/components/common/dialog-service";
import { FolderInput, Plus, SearchX, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { NewProjectDialog } from "@/features/projects/components/new-project-dialog";
import { ProjectCard } from "@/features/projects/components/project-card";
import {
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  renameProject,
  saveImportedProject,
} from "@/features/projects/projects-api";
import {
  exportProjectFile,
  importProjectFile,
  projectFileName,
} from "@/features/editor/lib/project-serializer";
import { useMediaStore } from "@/features/media/media-store";
import { loadMediaIndex, saveMediaIndex } from "@/features/editor/lib/idb-storage";
import { download } from "@/lib/utils";
import { COPY } from "@/config/copy";
import { PROJECT_FILE_EXTENSION } from "@/config/defaults";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects"] });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameProject(id, name),
    onSuccess: () => {
      void invalidate();
      toast.success(COPY.toasts.projectRenamed);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateProject(id),
    onSuccess: () => {
      void invalidate();
      toast.success(COPY.toasts.projectDuplicated);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      void invalidate();
      toast.success(COPY.toasts.projectDeleted);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (id: string) => {
      const project = await getProject(id);
      if (!project) throw new Error("Project not found");
      const media = useMediaStore.getState().assets;
      const blob = await exportProjectFile(project, media);
      download(blob, projectFileName(project));
    },
    onSuccess: () => toast.success(COPY.toasts.projectExported),
    onError: (err) =>
      void showAlert({
        variant: "error",
        title: COPY.dialogs.projectExportFailedTitle,
        description: err instanceof Error ? err.message : COPY.dialogs.genericErrorBody,
      }),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const { project, media } = await importProjectFile(file);
      await saveImportedProject(project);
      if (media.length > 0) {
        const index = await loadMediaIndex();
        const known = new Set(index.map((m) => m.id));
        const merged = [...index, ...media.filter((m) => !known.has(m.id))];
        await saveMediaIndex(merged);
        useMediaStore.setState({ assets: merged, loaded: true });
      }
    },
    onSuccess: () => {
      void invalidate();
      toast.success(COPY.toasts.projectImported);
    },
    onError: (err) =>
      void showAlert({
        variant: "error",
        title: COPY.dialogs.projectImportFailedTitle,
        description: err instanceof Error ? err.message : COPY.dialogs.genericErrorBody,
      }),
  });

  const projects = projectsQuery.data ?? [];
  const filtered = search.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : projects;

  return (
    <div className="container py-8 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {COPY.dashboard.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{COPY.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <FolderInput /> {COPY.dashboard.importProject}
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus /> {COPY.dashboard.newProject}
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept={PROJECT_FILE_EXTENSION + ",application/zip"}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importMutation.mutate(file);
            }}
          />
        </div>
      </div>

      {projects.length > 0 && (
        <div className="mt-6 max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={COPY.dashboard.searchPlaceholder}
            aria-label={COPY.dashboard.searchPlaceholder}
          />
        </div>
      )}

      <div className="mt-6">
        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border">
                <Skeleton className="aspect-video rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Video}
            title={COPY.dashboard.emptyTitle}
            description={COPY.dashboard.emptyBody}
            className="mt-4 py-20"
            action={
              <Button onClick={() => setNewOpen(true)}>
                <Plus /> {COPY.dashboard.emptyCta}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`No results for "${search.trim()}"`}
            className="mt-4"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRename={(id, name) => renameMutation.mutate({ id, name })}
                  onDuplicate={(id) => duplicateMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onExport={(id) => exportMutation.mutate(id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
