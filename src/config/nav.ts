import type { LucideIcon } from "lucide-react";
import { Clapperboard, Settings } from "lucide-react";
import { COPY } from "@/config/copy";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: COPY.nav.projects, icon: Clapperboard },
  { to: "/settings", label: COPY.nav.settings, icon: Settings },
];
