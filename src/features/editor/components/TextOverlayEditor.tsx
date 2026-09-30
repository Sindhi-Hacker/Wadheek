import { AlignCenter, AlignLeft, AlignRight, PencilLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorPicker } from "@/components/common/color-picker";
import { COPY } from "@/config/copy";
import { TEXT_DEFAULTS, TEXT_PRESETS } from "@/config/defaults";
import { LIMITS } from "@/config/limits";
import { cn } from "@/lib/utils";
import type { Clip, TextAlign, TextStyle } from "../types/clip";
import { useEditorStore } from "../hooks/useEditorStore";
import { PropertySlider, Section } from "./inspector-controls";

/** Full text-overlay styling: content, font, color, stroke, shadow, background, animation. */
export function TextOverlayEditor({ clip }: { clip: Clip }) {
  const text = clip.text;
  if (!text) return null;

  const update = (patch: Partial<TextStyle>) =>
    useEditorStore.getState().updateClip(clip.id, (c) => ({
      ...c,
      text: c.text ? { ...c.text, ...patch } : c.text,
      label: patch.content !== undefined ? patch.content.split("\n")[0] || c.label : c.label,
    }));

  const applyPreset = (presetId: string) => {
    const preset = TEXT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    useEditorStore.getState().updateClip(clip.id, (c) =>
      c.text
        ? {
            ...c,
            text: {
              ...c.text,
              ...preset.style,
              shadowColor:
                "shadowColor" in preset.style
                  ? (preset.style as { shadowColor: string }).shadowColor
                  : c.text.shadowColor,
            },
          }
        : c
    );
  };

  return (
    <>
      <Section
        title={COPY.inspector.text}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => {
              useEditorStore.getState().select([clip.id]);
              useEditorStore.getState().requestTextEdit();
            }}
          >
            <PencilLine className="h-3 w-3" /> Edit on canvas
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">
            {COPY.inspector.content}
          </Label>
          <Textarea
            value={text.content}
            maxLength={LIMITS.maxTextLength}
            rows={2}
            onChange={(e) => update({ content: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Style presets</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">{COPY.inspector.font}</Label>
          <Select value={text.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
            <SelectTrigger className="h-8 text-xs" aria-label={COPY.inspector.font}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_DEFAULTS.fontFamilies.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.id }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PropertySlider
          label={COPY.inspector.size}
          value={text.fontSize}
          min={12}
          max={300}
          step={1}
          defaultValue={TEXT_DEFAULTS.fontSize}
          format={(v) => `${Math.round(v)}px`}
          onChange={(v) => update({ fontSize: v })}
          clip={clip}
          keyframeProp="fontSize"
        />
        <PropertySlider
          label={COPY.inspector.weight}
          value={text.fontWeight}
          min={100}
          max={900}
          step={100}
          defaultValue={TEXT_DEFAULTS.fontWeight}
          format={(v) => `${v}`}
          onChange={(v) => update({ fontWeight: v })}
        />
        <PropertySlider
          label="Letter spacing"
          value={text.letterSpacing ?? 0}
          min={-5}
          max={30}
          step={0.5}
          defaultValue={0}
          format={(v) => `${v.toFixed(1)}px`}
          onChange={(v) => update({ letterSpacing: v })}
        />
        <PropertySlider
          label="Line height"
          value={text.lineHeight ?? 1.2}
          min={0.8}
          max={2.5}
          step={0.05}
          defaultValue={1.2}
          format={(v) => v.toFixed(2)}
          onChange={(v) => update({ lineHeight: v })}
        />
        <div className="flex items-center justify-between">
          <Label className="text-xs font-normal text-muted-foreground">
            {COPY.inspector.alignment}
          </Label>
          <ToggleGroup
            type="single"
            size="sm"
            value={text.align}
            onValueChange={(v) => v && update({ align: v as TextAlign })}
          >
            <ToggleGroupItem value="left" aria-label="Align left">
              <AlignLeft className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center">
              <AlignCenter className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right">
              <AlignRight className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">{COPY.inspector.color}</Label>
          <ColorPicker value={text.color} onChange={(v) => update({ color: v })} label={COPY.inspector.color} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">{COPY.inspector.stroke}</Label>
          <ColorPicker
            value={text.strokeColor}
            onChange={(v) => update({ strokeColor: v })}
            label={COPY.inspector.stroke}
          />
          <PropertySlider
            label="Stroke width"
            value={text.strokeWidth}
            min={0}
            max={24}
            step={0.5}
            defaultValue={0}
            format={(v) => `${v}px`}
            onChange={(v) => update({ strokeWidth: v })}
          />
        </div>
        <PropertySlider
          label={COPY.inspector.shadow}
          value={text.shadowBlur}
          min={0}
          max={60}
          step={1}
          defaultValue={TEXT_DEFAULTS.shadowBlur}
          format={(v) => `${v}px`}
          onChange={(v) => update({ shadowBlur: v })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">
            {COPY.inspector.background}
          </Label>
          <ColorPicker
            value={text.background}
            onChange={(v) => update({ background: v })}
            label={COPY.inspector.background}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => update({ background: "transparent" })}
          >
            Transparent
          </Button>
        </div>
      </Section>
      <Section title={`${COPY.inspector.animationIn} / ${COPY.inspector.animationOut}`}>
        {(["animationIn", "animationOut"] as const).map((key) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              {key === "animationIn" ? COPY.inspector.animationIn : COPY.inspector.animationOut}
            </Label>
            <Select value={text[key]} onValueChange={(v) => update({ [key]: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_DEFAULTS.animations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <p className={cn("text-[11px] leading-tight text-muted-foreground")}>
          Tip: for full control (any property, any curve) use the ◇ keyframes above.
        </p>
      </Section>
    </>
  );
}
