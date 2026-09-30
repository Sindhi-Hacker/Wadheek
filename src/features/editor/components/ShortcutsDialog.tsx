import React from 'react';
import { Modal } from '@/components/ui/Modal';

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: 'Playback',
    items: [
      ['Space', 'Play / pause'],
      ['J / K / L', 'Shuttle reverse / stop / forward'],
      ['← / →', 'Step one frame'],
      ['Shift + ← / →', 'Step one second'],
      ['Home / End', 'Go to start / end'],
      ['I / O', 'Mark in / out'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['S', 'Split clips at playhead'],
      ['V / C', 'Selection / razor tool'],
      ['Del', 'Delete selected clip'],
      ['Shift + Del', 'Ripple delete'],
      ['⌘/Ctrl + C / V', 'Copy / paste clip'],
      ['⌘/Ctrl + D', 'Duplicate clip'],
    ],
  },
  {
    title: 'Timeline & app',
    items: [
      ['+ / −', 'Zoom in / out'],
      ['F', 'Fit timeline to view'],
      ['Ctrl + wheel', 'Zoom around cursor'],
      ['⌘/Ctrl + Z', 'Undo'],
      ['Shift + ⌘/Ctrl + Z', 'Redo'],
      ['⌘/Ctrl + K', 'Command palette'],
      ['⌘/Ctrl + E', 'Export video'],
      ['Alt (while dragging)', 'Bypass snapping'],
      ['?', 'This shortcut sheet'],
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" subtitle="Work at speed, Premiere-style." width={560}>
      <div className="shortcuts">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <table>
              <tbody>
                {g.items.map(([k, d]) => (
                  <tr key={k}>
                    <td>
                      <kbd>{k}</kbd>
                    </td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Modal>
  );
}
