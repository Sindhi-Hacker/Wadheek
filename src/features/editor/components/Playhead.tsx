import * as React from "react";
import { COPY } from "@/config/copy";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";

/** Frame-accurate playhead with a draggable grab handle. */
export function Playhead() {
  const { currentTime, pps } = useEditor((s) => ({ currentTime: s.currentTime, pps: s.pps }));

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    // The wrapper is absolutely positioned inside the timeline content div;
    // measure against that content origin, not the playhead itself.
    const wrapper = target.parentElement as HTMLElement;
    const content = (wrapper.offsetParent as HTMLElement | null) ?? wrapper;
    const store = useEditorStore.getState();
    store.setPlaying(false);

    const move = (ev: PointerEvent) => {
      const rect = content.getBoundingClientRect();
      const time = Math.max(0, (ev.clientX - rect.left) / useEditorStore.getState().pps);
      useEditorStore.getState().setCurrentTime(time);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-30"
      style={{ left: currentTime * pps }}
      aria-hidden
    >
      <div className="absolute bottom-0 top-0 w-px bg-playhead" />
      <button
        className="pointer-events-auto absolute -left-2 top-0 h-5 w-4 cursor-ew-resize touch-none focus-visible:outline-none"
        onPointerDown={onPointerDown}
        aria-label={COPY.a11y.playhead}
        tabIndex={-1}
      >
        <svg viewBox="0 0 16 20" className="h-5 w-4">
          <path d="M1 1h14v10l-7 8-7-8V1z" className="fill-playhead" />
        </svg>
      </button>
    </div>
  );
}
