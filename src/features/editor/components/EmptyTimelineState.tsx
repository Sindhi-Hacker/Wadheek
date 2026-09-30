import { Film, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/config/copy";

interface EmptyTimelineStateProps {
  onImport: () => void;
}

export function EmptyTimelineState({ onImport }: EmptyTimelineStateProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/85 px-8 py-6 text-center shadow-elevation-2 backdrop-blur-[var(--blur-overlay)]">
        <Film className="h-7 w-7 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">{COPY.editor.emptyTimelineTitle}</p>
          <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
            {COPY.editor.emptyTimelineBody}
          </p>
        </div>
        <Button size="sm" onClick={onImport}>
          <Import className="h-3.5 w-3.5" /> {COPY.editor.emptyTimelineCta}
        </Button>
      </div>
    </div>
  );
}
