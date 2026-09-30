import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COPY } from "@/config/copy";
import { ASPECT_PRESETS, FPS_OPTIONS } from "@/config/defaults";
import { projectNameSchema } from "@/features/editor/lib/project-schema";
import { createProject } from "../projects-api";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (values: { name: string; aspectId: string; fps: number }) => {
      const preset = ASPECT_PRESETS.find((p) => p.id === values.aspectId) ?? ASPECT_PRESETS[0]!;
      return createProject(values.name, {
        aspectId: preset.id,
        width: preset.width,
        height: preset.height,
        fps: values.fps,
      });
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(COPY.toasts.projectCreated);
      onOpenChange(false);
      void navigate({ to: "/editor/$projectId", params: { projectId: project.id } });
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      aspectId: ASPECT_PRESETS[0]!.id,
      fps: 30,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        name: value.name.trim() || COPY.newProject.namePlaceholder,
        aspectId: value.aspectId,
        fps: value.fps,
      });
    },
  });

  React.useEffect(() => {
    if (open) form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{COPY.newProject.title}</DialogTitle>
          <DialogDescription>{COPY.newProject.description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (value.trim().length === 0) return undefined;
                const result = projectNameSchema.safeParse(value);
                return result.success ? undefined : result.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="project-name">{COPY.newProject.nameLabel}</Label>
                <Input
                  id="project-name"
                  placeholder={COPY.newProject.namePlaceholder}
                  value={field.state.value}
                  autoFocus
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="aspectId">
            {(field) => (
              <div className="space-y-2">
                <Label>{COPY.newProject.aspectLabel}</Label>
                <Select value={field.state.value} onValueChange={field.handleChange}>
                  <SelectTrigger aria-label={COPY.newProject.aspectLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <span className="font-medium">{preset.label}</span>
                        <span className="ml-2 text-muted-foreground">
                          {preset.width}x{preset.height}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="fps">
            {(field) => (
              <div className="space-y-2">
                <Label>{COPY.newProject.fpsLabel}</Label>
                <Select
                  value={String(field.state.value)}
                  onValueChange={(v) => field.handleChange(Number(v))}
                >
                  <SelectTrigger aria-label={COPY.newProject.fpsLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FPS_OPTIONS.map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
              {COPY.newProject.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
