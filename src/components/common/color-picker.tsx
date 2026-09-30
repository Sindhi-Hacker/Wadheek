import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allowTransparent?: boolean;
  className?: string;
}

/** Native color input + hex text field wrapped in tokenized chrome. */
export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const isTransparent = value === "transparent";
  const hex = isTransparent ? "#000000" : value.slice(0, 7);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-elevation-1">
        <input
          type="color"
          value={hex}
          aria-label={label ?? "Color"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: isTransparent
              ? "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%) 50% / 8px 8px"
              : value,
          }}
        />
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-8 flex-1 font-mono text-xs"
        aria-label={label ? `${label} value` : "Color value"}
      />
    </div>
  );
}
