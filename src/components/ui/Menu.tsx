import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
}

interface MenuProps {
  items: MenuItem[];
  onClose: () => void;
  x: number;
  y: number;
}

/** Floating context menu anchored at viewport coordinates. */
export function ContextMenu({ items, onClose, x, y }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width + 8 > window.innerWidth) nx = Math.max(8, window.innerWidth - rect.width - 8);
    if (y + rect.height + 8 > window.innerHeight) ny = Math.max(8, window.innerHeight - rect.height - 8);
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="ctx-menu" ref={ref} style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          {item.separatorBefore && <div className="ctx-sep" />}
          <button
            className={`ctx-item${item.danger ? ' danger' : ''}${item.disabled ? ' disabled' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect?.();
              onClose();
            }}
          >
            {item.icon && <span className="ctx-icon">{item.icon}</span>}
            <span className="ctx-label">{item.label}</span>
            {item.shortcut && <span className="ctx-shortcut">{item.shortcut}</span>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Hook to open a context menu at pointer position. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, items });
  };
  const close = () => setState(null);
  const menu = state ? <ContextMenu items={state.items} x={state.x} y={state.y} onClose={close} /> : null;
  return { open, close, menu };
}
