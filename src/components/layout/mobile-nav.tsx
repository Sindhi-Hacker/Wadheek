import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/config/nav";
import { cn } from "@/lib/utils";

/**
 * App-style bottom tab bar on phones for non-editor routes.
 * Animated active pill, safe-area aware, 44px+ touch targets.
 */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 shadow-elevation-2 backdrop-blur-[var(--blur-overlay)] supports-[backdrop-filter]:bg-background/75 md:hidden"
      aria-label="Mobile"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "touch-target relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors duration-fast active:scale-95 motion-safe:transition-transform",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative flex h-7 w-14 items-center justify-center">
                {active && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    className="absolute inset-0 rounded-full bg-primary/10"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className="relative z-10 h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
