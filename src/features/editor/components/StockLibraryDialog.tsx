import * as React from "react";
import { Download, Film, Image as ImageIcon, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColorPicker } from "@/components/common/color-picker";
import { Button } from "@/components/ui/button";
import { STOCK_LIBRARY, importStockItem, importSolidColor, type StockItem } from "../lib/media-extras";

const QUICK_COLORS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/** Sample media browser + solid-color clip maker. */
export function StockLibraryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [color, setColor] = React.useState("#3b82f6");

  const download = async (item: StockItem) => {
    setBusyId(item.id);
    try {
      await importStockItem(item);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock library</DialogTitle>
          <DialogDescription>
            Free sample footage and photos (CC / public CDNs) — downloaded and processed locally.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[380px] pr-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STOCK_LIBRARY.map((item) => (
              <button
                key={item.id}
                disabled={busyId !== null}
                onClick={() => void download(item)}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow duration-fast hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <div className="relative flex aspect-video items-center justify-center bg-muted">
                  {item.kind === "video" ? (
                    <Film className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="absolute inset-0 hidden items-center justify-center bg-foreground/40 group-hover:flex">
                    <Download className="h-5 w-5 text-white" />
                  </span>
                </div>
                <div className="p-1.5">
                  <p className="truncate text-[11px] font-medium">{item.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{item.credit}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <Palette className="h-3.5 w-3.5" /> Solid color clip
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_COLORS.map((c) => (
              <button
                key={c}
                className="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: color === c ? "hsl(var(--primary))" : "transparent" }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
            <ColorPicker value={color} onChange={setColor} label="Custom color" />
            <Button size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={() => void importSolidColor(color)}>
              <ImageIcon className="h-3.5 w-3.5" /> Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
