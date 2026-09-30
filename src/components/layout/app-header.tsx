import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Command, Monitor, Moon, Search, Sun } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeyboardKey } from "@/components/common/keyboard-key";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { NAV_ITEMS } from "@/config/nav";
import { COPY } from "@/config/copy";
import { cn, isMac } from "@/lib/utils";

interface AppHeaderProps {
  onOpenCommandPalette: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: COPY.theme.light, icon: Sun },
  { value: "dark", label: COPY.theme.dark, icon: Moon },
  { value: "system", label: COPY.theme.system, icon: Monitor },
];

/** Compact theme switcher for phones: one icon button opening a menu. */
function MobileThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={COPY.theme.toggleLabel}>
          <CurrentIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(option.value === theme && "bg-accent text-accent-foreground")}
          >
            <option.icon /> {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Global chrome for non-editor routes; the editor uses its own TopBar.
 * Auto-hides while scrolling down and reappears on the first upward scroll.
 */
export function AppHeader({ onOpenCommandPalette }: AppHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hidden, scrolled } = useHideOnScroll();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b motion-safe:transition-[transform,box-shadow,background-color] motion-safe:duration-300 motion-safe:ease-out",
        scrolled
          ? "bg-background/85 shadow-elevation-2 backdrop-blur-[var(--blur-overlay)] supports-[backdrop-filter]:bg-background/70"
          : "bg-background/95 backdrop-blur-[var(--blur-overlay)]",
        hidden && "-translate-y-full shadow-none"
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 md:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${COPY.app.name} home`}
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="header-nav-pill"
                    className="absolute inset-0 rounded-lg bg-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
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
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label="Search"
            onClick={onOpenCommandPalette}
          >
            <Search className="h-5 w-5" />
          </Button>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="sm:hidden">
            <MobileThemeMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
