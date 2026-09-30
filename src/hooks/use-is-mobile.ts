import { useMediaQuery } from "@/hooks/use-media-query";

/** Phone-sized viewport. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** Tablet or smaller. */
export function useIsTablet(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
