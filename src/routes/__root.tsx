import * as React from "react";
import { Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { GlobalCommandPalette } from "@/features/editor/components/CommandPalette";
import { useMediaStore } from "@/features/media/media-store";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isEditor = pathname.startsWith("/editor");
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const hydrateMedia = useMediaStore((s) => s.hydrate);

  React.useEffect(() => {
    void hydrateMedia();
  }, [hydrateMedia]);

  // Global palette shortcut outside the editor (the editor binds its own).
  React.useEffect(() => {
    if (isEditor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditor]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-full flex-col bg-background text-foreground">
        {!isEditor && <AppHeader onOpenCommandPalette={() => setPaletteOpen(true)} />}
        <main className={isEditor ? "flex-1" : "flex-1 pb-20 md:pb-0"}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        {!isEditor && <MobileNav />}
      </div>
      <GlobalCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
