import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { IconButton } from "@/components/common/icon-button";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { beginHistoryTransaction, endHistoryTransaction, type HistorySlice } from "../hooks/useUndoRedo";
import type { Clip, KeyframeProperty } from "../types/clip";
import { useKeyframedProperty } from "../hooks/useKeyframedProperty";

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
  /** When provided, renders the keyframe diamond and routes writes through the keyframe system. */
  clip?: Clip;
  keyframeProp?: KeyframeProperty;
}

/** Small diamond toggle used to add/remove a keyframe at the playhead. */
export function KeyframeDiamond({
  active,
  atPlayhead,
  onToggle,
  label,
}: {
  active: boolean;
  atPlayhead: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={atPlayhead}
      title={atPlayhead ? `Remove ${label} keyframe at playhead` : `Add ${label} keyframe at playhead`}
      aria-label={`${label} keyframe`}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-colors",
        atPlayhead ? "text-primary" : active ? "text-primary/70" : "text-muted-foreground/60 hover:text-foreground"
      )}
    >
      <span
        className={cn("block rotate-45 border", atPlayhead ? "border-primary bg-primary" : "border-current bg-transparent")}
        style={{ width: 7, height: 7 }}
      />
    </button>
  );
}

/**
 * Slider bound to the store with history-transaction grouping: the whole
 * scrub becomes one undo entry, committed on release. When `clip` +
 * `keyframeProp` are given, the value shown is the animated one and a
 * keyframe diamond appears next to the label.
 */
export function PropertySlider(props: PropertySliderProps) {
  // Branching between two component types (not conditional hooks) keeps the
  // rules-of-hooks valid even when the selection changes kind.
  if (props.clip && props.keyframeProp) {
    return <AnimatedPropertySlider {...props} clip={props.clip} keyframeProp={props.keyframeProp} />;
  }
  return <StaticPropertySlider {...props} />;
}

function StaticPropertySlider({
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

function AnimatedPropertySlider({
  label,
  min,
  max,
  step,
  defaultValue,
  format,
  className,
  clip,
  keyframeProp,
}: Omit<PropertySliderProps, "value" | "onChange"> &
  Required<Pick<PropertySliderProps, "clip" | "keyframeProp">>) {
  const txRef = React.useRef<HistorySlice | null>(null);
  const kf = useKeyframedProperty(clip, keyframeProp);
  const shown = kf.value;
  const handleChange = kf.onChange;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <KeyframeDiamond
            active={kf.hasTrack}
            atPlayhead={kf.hasKeyAtPlayhead}
            onToggle={kf.toggleKeyframe}
            label={label}
          />
          <Label className="truncate text-xs font-normal text-muted-foreground">{label}</Label>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {format ? format(shown) : shown.toFixed(2)}
          </span>
          {defaultValue !== undefined && shown !== defaultValue && (
            <IconButton
              label={`Reset ${label}`}
              tooltip={false}
              size="icon-sm"
              className="h-5 w-5"
              onClick={() => handleChange(defaultValue)}
            >
              <RotateCcw className="!h-3 !w-3" />
            </IconButton>
          )}
        </div>
      </div>
      <Slider
        value={[shown]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={([v]) => {
          if (!txRef.current) txRef.current = beginHistoryTransaction();
          handleChange(v!);
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
