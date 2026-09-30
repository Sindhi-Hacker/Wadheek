import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatTimecode, parseTimecode } from "@/features/editor/lib/time-format";

interface TimecodeInputProps {
  value: number;
  fps: number;
  onChange: (seconds: number) => void;
  className?: string;
  "aria-label"?: string;
}

/** Frame-accurate timecode field (HH:MM:SS:FF) with parse-on-commit. */
export function TimecodeInput({ value, fps, onChange, className, ...rest }: TimecodeInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      const parsed = parseTimecode(draft, fps);
      if (parsed !== null) onChange(Math.max(0, parsed));
    }
    setDraft(null);
  };

  return (
    <Input
      value={draft ?? formatTimecode(value, fps)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") setDraft(null);
        e.stopPropagation();
      }}
      inputMode="numeric"
      className={cn("h-8 w-[7.5rem] text-center font-mono text-xs", className)}
      {...rest}
    />
  );
}
