import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { COPY } from "@/config/copy";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: COPY.theme.light, icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: COPY.theme.dark, icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: COPY.theme.system, icon: <Monitor className="h-4 w-4" /> },
];

export function ThemeToggle({ size = "sm" }: { size?: "sm" | "default" }) {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      type="single"
      size={size}
      value={theme}
      variant="outline"
      className="gap-0 rounded-md shadow-elevation-1 [&>*]:rounded-none [&>:first-child]:rounded-l-md [&>:last-child]:rounded-r-md [&>*+*]:border-l-0"
      onValueChange={(value) => {
        if (value) setTheme(value as Theme);
      }}
      aria-label={COPY.theme.toggleLabel}
    >
      {OPTIONS.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem value={option.value} aria-label={option.label}>
              {option.icon}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{option.label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
