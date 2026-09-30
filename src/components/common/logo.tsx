import { cn } from "@/lib/utils";

/** Inline SVG "Wadheek" mark + wordmark. No image assets required. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-6 w-6", className)}
      role="img"
      aria-label="Wadheek logo"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M7 10l3.5 12L14 12l3.5 10L21 10"
        className="stroke-primary-foreground"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="24.5" cy="11" r="2.2" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-base font-semibold tracking-tight text-foreground">Wadheek</span>
      )}
    </span>
  );
}
