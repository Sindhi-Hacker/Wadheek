import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { IconButton } from "@/components/common/icon-button";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { beginHistoryTransaction, endHistoryTransaction, type HistorySlice } from "../hooks/useUndoRedo";

/** Collapsible-free section wrapper for inspector groups. */
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-b px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface PropertySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  className?: string;
}

/**
 * Slider bound to the store with history-transaction grouping: the whole
 * scrub becomes one undo entry, committed on release.
 */
export function PropertySlider({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  format,
  onChange,
  className,
}: PropertySliderProps) {
  const txRef = React.useRef<HistorySlice | null>(null);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {format ? format(value) : value.toFixed(2)}
          </span>
          {defaultValue !== undefined && value !== defaultValue && (
            <IconButton
              label={`Reset ${label}`}
              tooltip={false}
              size="icon-sm"
              className="h-5 w-5"
              onClick={() => onChange(defaultValue)}
            >
              <RotateCcw className="!h-3 !w-3" />
            </IconButton>
          )}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={([v]) => {
          if (!txRef.current) txRef.current = beginHistoryTransaction();
          onChange(v!);
        }}
        onValueCommit={() => {
          if (txRef.current) {
            endHistoryTransaction(txRef.current);
            txRef.current = null;
          }
        }}
      />
    </div>
  );
}
