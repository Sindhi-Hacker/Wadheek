import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <Loader2 className={cn("h-6 w-6 animate-spin text-muted-foreground", className)} />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}
