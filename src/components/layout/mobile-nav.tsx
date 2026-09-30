import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

/** Bottom tab bar on phones for non-editor routes. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-[var(--blur-overlay)] md:hidden"
      aria-label="Mobile"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "touch-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
              pathname === item.to ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
