import * as React from "react";

export function useEventListener<K extends keyof WindowEventMap>(
  event: K,
  handler: (ev: WindowEventMap[K]) => void,
  target: Window | Document | HTMLElement | null = typeof window !== "undefined" ? window : null,
  options?: AddEventListenerOptions
) {
  const savedHandler = React.useRef(handler);
  React.useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (!target) return;
    const listener = (ev: Event) => savedHandler.current(ev as WindowEventMap[K]);
    target.addEventListener(event, listener, options);
    return () => target.removeEventListener(event, listener, options);
  }, [event, target, options]);
}
