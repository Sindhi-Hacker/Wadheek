import React from 'react';
import { Clapperboard, Keyboard, LayoutDashboard, SettingsIcon } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export type Route = { page: 'home' | 'editor' | 'settings'; projectId?: string };

export function navigate(route: Route): void {
  const path = route.page === 'home' ? '/' : route.page === 'settings' ? '/settings' : `/editor/${route.projectId ?? ''}`;
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function TopBar({ active, onShortcuts }: { active: 'home' | 'editor' | 'settings'; onShortcuts?: () => void }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate({ page: 'home' })} aria-label="Wadheek home">
        <span className="logo-mark">
          <Clapperboard size={16} strokeWidth={2.4} />
        </span>
        <span className="brand-text">
          Wadheek
          <small>Video Studio</small>
        </span>
      </button>

      <nav className="topnav" aria-label="Primary">
        <button className={active === 'home' ? 'navitem active' : 'navitem'} onClick={() => navigate({ page: 'home' })}>
          <LayoutDashboard size={14} />
          Projects
        </button>
        <button className={active === 'settings' ? 'navitem active' : 'navitem'} onClick={() => navigate({ page: 'settings' })}>
          <SettingsIcon size={14} />
          Settings
        </button>
      </nav>

      <div className="top-actions">
        {onShortcuts && (
          <button className="icon-btn subtle" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={onShortcuts}>
            <Keyboard size={15} />
          </button>
        )}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
