import { useIsMobile, useIsTablet } from "@/hooks/use-is-mobile";

export type EditorLayout = "desktop" | "tablet" | "phone";

/**
 * Three-column desktop, two-column tablet, single-column phone with
 * bottom-sheet panels.
 */
export function useResponsiveLayout(): {
  layout: EditorLayout;
  isMobile: boolean;
  isTablet: boolean;
} {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const layout: EditorLayout = isMobile ? "phone" : isTablet ? "tablet" : "desktop";
  return { layout, isMobile, isTablet };
}
