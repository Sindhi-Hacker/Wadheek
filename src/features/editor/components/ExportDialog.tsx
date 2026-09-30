import * as React from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COPY } from "@/config/copy";
import {
  EXPORT_DEFAULTS,
  EXPORT_FORMATS,
  EXPORT_FPS_OPTIONS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
} from "@/config/export-presets";
import { exportSettingsSchema } from "../lib/project-schema";
import { formatDuration } from "../lib/time-format";
import { timelineDuration } from "../lib/timeline-math";
import type { ExportSettings } from "../types/export";
import { useEditor, useEditorStore } from "../hooks/useEditorStore";
import { useExport } from "../hooks/useExport";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const projectName = useEditor((s) => s.projectName);
  const { inPoint, outPoint, settings: projectSettings } = useEditor((s) => ({
    inPoint: s.inPoint,
    outPoint: s.outPoint,
    settings: s.settings,
  }));
  const { progress, start, cancel, reset, busy, mp4Native, ffmpegReady } = useExport();

  const [form, setForm] = React.useState<ExportSettings>({
    ...EXPORT_DEFAULTS,
    fileName: EXPORT_DEFAULTS.fileName,
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase();
      setForm((f) => ({ ...f, fileName: safe || EXPORT_DEFAULTS.fileName }));
      setError(null);
      reset();
    }
  }, [open, projectName, reset]);

  const hasInOut = inPoint !== null && outPoint !== null && outPoint > inPoint;
  const resolution = EXPORT_RESOLUTIONS.find((r) => r.id === form.resolutionId);
  const outWidth = Math.round((projectSettings.width * (resolution?.scale ?? 1)) / 2) * 2;
  const outHeight = Math.round((projectSettings.height * (resolution?.scale ?? 1)) / 2) * 2;

  const submit = async () => {
    const parsed = exportSettingsSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid settings");
      return;
    }
    const state = useEditorStore.getState();
    if (timelineDuration(state.tracks) <= 0) {
      toast.error(COPY.export.emptyTimeline);
      return;
    }
    setError(null);
    await start(parsed.data);
  };

  const mp4Hint = form.formatId === "mp4" && !mp4Native && !ffmpegReady;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy && !v) return; // require explicit cancel while rendering
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{COPY.export.title}</DialogTitle>
          <DialogDescription>{COPY.export.description}</DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{COPY.export.rendering}</p>
                <p className="text-xs text-muted-foreground">
                  {COPY.export.frame} {progress.currentFrame} / {progress.totalFrames}
                  {progress.etaSeconds !== null &&
                    ` · ${COPY.export.eta} ${formatDuration(progress.etaSeconds)}`}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums">
                {Math.round(progress.progress * 100)}%
              </span>
            </div>
            <Progress value={progress.progress * 100} />
            <DialogFooter>
              <Button variant="outline" onClick={cancel}>
                <X className="h-4 w-4" /> {COPY.export.cancel}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="export-name">{COPY.export.fileName}</Label>
              <Input
                id="export-name"
                value={form.fileName}
                onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{COPY.export.format}</Label>
                <Select
                  value={form.formatId}
                  onValueChange={(v) => setForm((f) => ({ ...f, formatId: v }))}
                >
                  <SelectTrigger aria-label={COPY.export.format}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{COPY.export.frameRate}</Label>
                <Select
                  value={String(form.fps)}
                  onValueChange={(v) => setForm((f) => ({ ...f, fps: Number(v) }))}
                >
                  <SelectTrigger aria-label={COPY.export.frameRate}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FPS_OPTIONS.map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{COPY.export.resolution}</Label>
                <Select
                  value={form.resolutionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, resolutionId: v }))}
                >
                  <SelectTrigger aria-label={COPY.export.resolution}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_RESOLUTIONS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {outWidth}x{outHeight}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{COPY.export.quality}</Label>
                <Select
                  value={form.qualityId}
                  onValueChange={(v) => setForm((f) => ({ ...f, qualityId: v }))}
                >
                  <SelectTrigger aria-label={COPY.export.quality}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_QUALITIES.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{COPY.export.range}</Label>
              <Select
                value={form.range}
                onValueChange={(v) => setForm((f) => ({ ...f, range: v as "all" | "inout" }))}
              >
                <SelectTrigger aria-label={COPY.export.range}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{COPY.export.rangeAll}</SelectItem>
                  <SelectItem value="inout" disabled={!hasInOut}>
                    {COPY.export.rangeInOut}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mp4Hint && (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                {COPY.export.ffmpegUnavailable}
              </p>
            )}

            <DialogFooter>
              <Button onClick={() => void submit()} className="w-full sm:w-auto">
                <Download className="h-4 w-4" /> {COPY.export.start}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
