import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';

/** Light / dark / system picker — no hardcoded theme anywhere in the app. */
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const options: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: 'Light', icon: <Sun size={14} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
    { value: 'system', label: 'System', icon: <Monitor size={14} /> },
  ];

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        className="icon-btn subtle"
        aria-label={`Theme: ${mode} (currently ${resolved})`}
        title={`Theme — ${mode}`}
        onClick={() => setOpen((o) => !o)}
      >
        {resolved === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
      </button>
      {open && (
        <div className="theme-popover">
          <p className="popover-title">Appearance</p>
          {options.map((o) => (
            <button
              key={o.value}
              className={`popover-item${mode === o.value ? ' active' : ''}`}
              onClick={() => {
                setMode(o.value);
                setOpen(false);
              }}
            >
              {o.icon}
              <span>{o.label}</span>
              {mode === o.value && <em>current</em>}
            </button>
          ))}
        </div>
      )}
      {!compact && <span className="sr-only">Current theme: {mode}</span>}
    </div>
  );
}
