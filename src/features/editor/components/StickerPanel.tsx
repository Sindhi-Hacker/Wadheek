import { ColorPicker } from "@/components/common/color-picker";
import type { Clip } from "../types/clip";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

/** Style editing for sticker clips (emoji or vector shape). */
export function StickerPanel({ clip }: { clip: Clip }) {
  const sticker = clip.sticker;
  if (!sticker) return null;

  const update = (patch: Partial<typeof sticker>) =>
    useEditorStore.getState().updateClip(clip.id, (c) =>
      c.sticker ? { ...c, sticker: { ...c.sticker, ...patch } } : c
    );

  return (
    <Section title="Sticker">
      <PropertySlider
        label="Size"
        value={sticker.size}
        min={40}
        max={1200}
        step={4}
        defaultValue={220}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => update({ size: v })}
      />
      {sticker.type === "shape" && (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-normal text-muted-foreground">Fill</p>
            <ColorPicker value={sticker.fill} onChange={(v) => update({ fill: v })} label="Fill color" />
          </div>
          <PropertySlider
            label="Outline width"
            value={sticker.strokeWidth}
            min={0}
            max={40}
            step={1}
            defaultValue={0}
            format={(v) => `${v}px`}
            onChange={(v) => update({ strokeWidth: v })}
          />
        </>
      )}
      <PropertySlider
        label="Shadow"
        value={sticker.shadowBlur}
        min={0}
        max={80}
        step={1}
        defaultValue={12}
        format={(v) => `${v}px`}
        onChange={(v) => update({ shadowBlur: v })}
      />
    </Section>
  );
}

/** Style editing for drawing clips. */
export function DrawingPanel({ clip }: { clip: Clip }) {
  if (!clip.drawing) return null;
  const store = useEditorStore.getState;
  const strokes = clip.drawing.strokes;

  return (
    <Section
      title="Drawing"
      action={
        strokes.length > 0 ? (
          <button
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => store().undoLastStroke(clip.id)}
          >
            Undo stroke
          </button>
        ) : undefined
      }
    >
      <p className="text-[11px] text-muted-foreground">
        {strokes.length} stroke{strokes.length === 1 ? "" : "s"} ·{" "}
        {strokes.reduce((n, s) => n + s.points.length, 0)} points. Drawings replay with an
        animated draw-on during playback.
      </p>
      <p className="text-[11px] text-muted-foreground">
        Use the pencil tool in the preview to add more ink.
      </p>
    </Section>
  );
}
