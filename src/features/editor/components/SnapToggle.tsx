import { Magnet } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COPY } from "@/config/copy";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";

export function SnapToggle() {
  const snapping = useEditor((s) => s.snapping);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={snapping}
          onPressedChange={() => useEditorStore.getState().toggleSnapping()}
          aria-label={COPY.editor.snap}
        >
          <Magnet className="h-4 w-4" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{COPY.editor.snap} (N)</TooltipContent>
    </Tooltip>
  );
}
