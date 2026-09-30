import { useEffect } from 'react';
import type { EditorApi } from '@/features/editor/EditorContext';

export interface ShortcutOptions {
  onPalette: () => void;
  onShortcuts: () => void;
  onExport: () => void;
  viewportPx: number;
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Premiere-style keyboard map. */
export function useShortcuts(api: EditorApi, optsRef: { current: ShortcutOptions }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      const opts = optsRef.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;
      const fps = api.project.fps;
      const frame = 1 / Math.max(1, fps);

      // Cmd/Ctrl combos
      if (mod) {
        switch (key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) api.redo();
            else api.undo();
            return;
          case 'y':
            e.preventDefault();
            api.redo();
            return;
          case 'c':
            e.preventDefault();
            api.copySelected();
            return;
          case 'v':
            e.preventDefault();
            api.pasteClipboard();
            return;
          case 'd':
            e.preventDefault();
            api.duplicateSelected();
            return;
          case 'k':
            e.preventDefault();
            opts.onPalette();
            return;
          case 'e':
            e.preventDefault();
            opts.onExport();
            return;
          case 's':
            e.preventDefault(); // autosave already covers save; suppress browser dialog
            return;
          case 'a':
            e.preventDefault();
            return; // reserved for marquee select
        }
        return;
      }

      switch (key) {
        case ' ':
          e.preventDefault();
          api.togglePlay();
          return;
        case 'ArrowLeft':
          e.preventDefault();
          api.nudge(e.shiftKey ? -1 : -frame);
          return;
        case 'ArrowRight':
          e.preventDefault();
          api.nudge(e.shiftKey ? 1 : frame);
          return;
        case 'Home':
          e.preventDefault();
          api.seek(0);
          return;
        case 'End':
          e.preventDefault();
          api.seek(api.project.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0));
          return;
        case 'j':
        case 'J':
          api.shuttle(-1);
          return;
        case 'k':
        case 'K':
          api.pause();
          return;
        case 'l':
        case 'L':
          api.shuttle(1);
          return;
        case 'i':
          api.markIn();
          return;
        case 'o':
          api.markOut();
          return;
        case 's':
          api.splitAtPlayhead();
          return;
        case 'v':
          api.setTool('select');
          return;
        case 'c':
          api.setTool('razor');
          return;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          api.deleteSelected(e.shiftKey);
          return;
        case '+':
        case '=':
          api.zoomIn();
          return;
        case '-':
        case '_':
          api.zoomOut();
          return;
        case 'f':
        case 'F':
          api.zoomFit(opts.viewportPx);
          return;
        case 'Escape':
          api.select(null);
          return;
        case '?':
          opts.onShortcuts();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, optsRef]);
}
