import { Maximize2, Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/common/icon-button";
import { COPY } from "@/config/copy";
import { useTimeline } from "../hooks/useTimeline";

interface ZoomControlsProps {
  getViewportWidth: () => number;
}

export function ZoomControls({ getViewportWidth }: ZoomControlsProps) {
  const { zoomIn, zoomOut, zoomToFit } = useTimeline();
  return (
    <div className="flex items-center gap-0.5">
      <IconButton label={COPY.editor.zoomOut} onClick={zoomOut}>
        <Minus className="h-4 w-4" />
      </IconButton>
      <IconButton label={COPY.editor.zoomFit} onClick={() => zoomToFit(getViewportWidth())}>
        <Maximize2 className="h-4 w-4" />
      </IconButton>
      <IconButton label={COPY.editor.zoomIn} onClick={zoomIn}>
        <Plus className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
