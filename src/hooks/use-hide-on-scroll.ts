import * as React from "react";

interface HideOnScrollOptions {
  /** Minimum scroll delta (px) before a direction change takes effect. */
  threshold?: number;
  /** The bar never hides while within this distance from the top. */
  topOffset?: number;
}

interface HideOnScrollState {
  /** True while the user is scrolling down past the top offset. */
  hidden: boolean;
  /** True once the page is scrolled at all (used for elevation/shadow). */
  scrolled: boolean;
}

/**
 * Auto-hiding app-bar behavior: hides when scrolling down, reveals on the
 * first upward scroll or near the top. rAF-throttled passive listener.
 */
export function useHideOnScroll({
  threshold = 6,
  topOffset = 72,
}: HideOnScrollOptions = {}): HideOnScrollState {
  const [hidden, setHidden] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(y > 2);
      if (y <= topOffset) {
        setHidden(false);
        lastY = y;
        return;
      }
      const delta = y - lastY;
      if (Math.abs(delta) < threshold) return;
      setHidden(delta > 0);
      lastY = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold, topOffset]);

  return { hidden, scrolled };
}
