import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { NotFound } from "@/routes/not-found";
import { EditorShell } from "@/features/editor/components/EditorShell";
import { useEditorStore } from "@/features/editor/hooks/useEditorStore";
import { getProject } from "@/features/projects/projects-api";
import { useMediaStore } from "@/features/media/media-store";

/**
 * Search params drive shareable editor state (playhead time + zoom) so a
 * reload restores the working context.
 */
const editorSearchSchema = z.object({
  t: z.coerce.number().min(0).optional(),
  zoom: z.coerce.number().positive().optional(),
});

export const Route = createFileRoute("/editor/$projectId")({
  validateSearch: editorSearchSchema,
  component: EditorPage,
});

function EditorPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [ready, setReady] = React.useState(false);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await getProject(projectId)) ?? null,
    staleTime: Infinity,
    gcTime: 0,
  });

  const hydrateMedia = useMediaStore((s) => s.hydrate);

  React.useEffect(() => {
    const project = projectQuery.data;
    if (!project) return;
    let cancelled = false;
    void (async () => {
      await hydrateMedia();
      if (cancelled) return;
      const store = useEditorStore.getState();
      store.loadProject(project);
      if (search.t !== undefined) store.setCurrentTime(search.t);
      if (search.zoom !== undefined) store.setPps(search.zoom);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQuery.data, hydrateMedia]);

  // Persist playhead + zoom into search params (debounced via replace).
  React.useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const s = useEditorStore.getState();
      const t = Math.round(s.currentTime * 100) / 100;
      const zoom = Math.round(s.pps * 100) / 100;
      void navigate({
        search: (prev) => ({ ...prev, t, zoom }),
        replace: true,
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [ready, navigate]);

  React.useEffect(() => {
    return () => {
      useEditorStore.getState().resetEditor();
    };
  }, []);

  if (projectQuery.isLoading) {
    return <LoadingSpinner label="Opening project" className="mt-24" />;
  }
  if (projectQuery.data === null) {
    return <NotFound />;
  }
  if (!ready) {
    return <LoadingSpinner label="Preparing editor" className="mt-24" />;
  }
  return <EditorShell />;
}
