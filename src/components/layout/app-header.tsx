import { Link, useRouterState } from "@tanstack/react-router";
import { Command } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { KeyboardKey } from "@/components/common/keyboard-key";
import { NAV_ITEMS } from "@/config/nav";
import { cn, isMac } from "@/lib/utils";

interface AppHeaderProps {
  onOpenCommandPalette: () => void;
}

/** Global chrome for non-editor routes; the editor uses its own TopBar. */
export function AppHeader({ onOpenCommandPalette }: AppHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-[var(--blur-overlay)]">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link to="/" className="rounded-md" aria-label="Wadheek home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-fast",
                pathname === item.to
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 text-muted-foreground sm:inline-flex"
            onClick={onOpenCommandPalette}
          >
            <Command className="h-3.5 w-3.5" />
            <span className="text-xs">Search</span>
            <span className="flex items-center gap-0.5">
              <KeyboardKey>{isMac() ? "Cmd" : "Ctrl"}</KeyboardKey>
              <KeyboardKey>K</KeyboardKey>
            </span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
