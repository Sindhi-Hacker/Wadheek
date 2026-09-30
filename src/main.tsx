import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { WorkspaceProvider } from '@/features/projects/WorkspaceContext';
import { DashboardPage } from '@/pages/DashboardPage';
import { EditorPage } from '@/pages/EditorPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ShortcutsDialog } from '@/features/editor/components/ShortcutsDialog';
import './styles/globals.css';

type Route =
  | { page: 'home' }
  | { page: 'settings' }
  | { page: 'editor'; projectId: string };

function parseRoute(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/settings') return { page: 'settings' };
  const m = path.match(/^\/editor\/([^/]+)$/);
  if (m) return { page: 'editor', projectId: decodeURIComponent(m[1]) };
  return { page: 'home' };
}

function Shell() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    // Keep the title in sync with the route.
    document.title =
      route.page === 'editor' ? 'Editor — Wadheek' : route.page === 'settings' ? 'Settings — Wadheek' : 'Wadheek — Video Studio';
  }, [route]);

  const onShortcuts = () => setShortcutsOpen(true);

  return (
    <>
      {route.page === 'home' && <DashboardPage onShortcuts={onShortcuts} />}
      {route.page === 'settings' && <SettingsPage onShortcuts={onShortcuts} />}
      {route.page === 'editor' && <EditorPage projectId={route.projectId} onShortcuts={onShortcuts} />}
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <Shell />
        </WorkspaceProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
