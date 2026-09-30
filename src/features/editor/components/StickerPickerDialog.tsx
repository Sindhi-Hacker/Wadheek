import * as React from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EMOJI_CATALOG, SHAPE_IDS, SHAPE_LABELS, drawSticker } from "../lib/stickers";
import { useEditorStore } from "../hooks/useEditorStore";
import type { Ctx2D } from "../lib/canvas-compositor";

/** Grid picker for emoji + vector-shape stickers. */
export function StickerPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");

  const addSticker = (type: "emoji" | "shape", content: string) => {
    useEditorStore.getState().addStickerClip({ type, content });
    onOpenChange(false);
  };

  const emojiGroups = React.useMemo(() => {
    if (!query.trim()) return EMOJI_CATALOG;
    return EMOJI_CATALOG.map((g) => ({
      ...g,
      emojis: g.emojis.filter(() => true),
    })).filter((g) => g.id.includes(query.toLowerCase()) || g.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add sticker</DialogTitle>
          <DialogDescription>Emoji and shapes render on the canvas — drag them anywhere.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="emoji">
          <TabsList className="w-full">
            <TabsTrigger value="emoji" className="flex-1 text-xs">
              Emoji
            </TabsTrigger>
            <TabsTrigger value="shape" className="flex-1 text-xs">
              Shapes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="emoji" className="mt-3">
            <div className="mb-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                className="h-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <ScrollArea className="h-[320px] pr-2">
              {emojiGroups.map((group) => (
                <div key={group.id} className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => addSticker("emoji", emoji)}
                        aria-label={`Add ${emoji} sticker`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {emojiGroups.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  <Search className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  No categories match “{query}”.
                </p>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="shape" className="mt-3">
            <ScrollArea className="h-[340px] pr-2">
              <div className="grid grid-cols-4 gap-2">
                {SHAPE_IDS.map((shape) => (
                  <button
                    key={shape}
                    className="flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => addSticker("shape", shape)}
                  >
                    <ShapePreview shape={shape} />
                    <span className="text-[10px] text-muted-foreground">{SHAPE_LABELS[shape]}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ShapePreview({ shape }: { shape: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 40 * dpr;
    canvas.height = 40 * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.translate(20, 20);
    drawSticker(ctx as Ctx2D, {
      type: "shape",
      content: shape,
      size: 30,
      fill: "currentColor",
      stroke: "currentColor",
      strokeWidth: 0,
      shadowBlur: 0,
      shadowColor: "transparent",
    }, 0);
  }, [shape]);
  return <canvas ref={ref} style={{ width: 40, height: 40 }} className="text-foreground" aria-hidden />;
}
