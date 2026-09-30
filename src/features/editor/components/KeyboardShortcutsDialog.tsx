import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KeyboardKey } from "@/components/common/keyboard-key";
import { COPY } from "@/config/copy";
import { SHORTCUTS, displayKeys } from "@/config/shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{COPY.editor.shortcuts}</DialogTitle>
          <DialogDescription>{COPY.app.name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
                <ul className="space-y-1.5">
                  {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 text-sm">
                      <span>{s.label}</span>
                      <span className="flex items-center gap-1">
                        {displayKeys(s.keys).map((key, i) => (
                          <KeyboardKey key={i}>{key}</KeyboardKey>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
