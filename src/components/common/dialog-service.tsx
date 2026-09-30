import * as React from "react";
import { create } from "zustand";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { COPY } from "@/config/copy";

/* ------------------------------------------------------------------
   Global dialog service.
   Any code (components, hooks, async pipelines) can raise a professional
   modal via `showAlert(...)` / `showConfirm(...)`. Requests queue so
   simultaneous alerts never clobber each other.
------------------------------------------------------------------- */

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertRequest {
  kind: "alert";
  variant: AlertVariant;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  resolve: () => void;
}

export interface ConfirmRequest {
  kind: "confirm";
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (confirmed: boolean) => void;
}

type DialogRequest = AlertRequest | ConfirmRequest;

interface DialogState {
  current: DialogRequest | null;
  queue: DialogRequest[];
  push: (request: DialogRequest) => void;
  next: () => void;
}

const useDialogStore = create<DialogState>((set) => ({
  current: null,
  queue: [],
  push: (request) =>
    set((s) => (s.current ? { queue: [...s.queue, request] } : { current: request })),
  next: () =>
    set((s) => {
      const [head, ...rest] = s.queue;
      return { current: head ?? null, queue: rest };
    }),
}));

/** Show a professional alert dialog. Resolves when the user dismisses it. */
export function showAlert(options: {
  title: string;
  description?: React.ReactNode;
  variant?: AlertVariant;
  confirmLabel?: string;
}): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      kind: "alert",
      variant: options.variant ?? "info",
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      resolve,
    });
  });
}

/** Show a confirmation dialog. Resolves `true` when confirmed. */
export function showConfirm(options: {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      kind: "confirm",
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      destructive: options.destructive,
      resolve,
    });
  });
}

const VARIANT_META: Record<
  AlertVariant,
  { icon: LucideIcon; iconClass: string; chipClass: string }
> = {
  info: { icon: Info, iconClass: "text-primary", chipClass: "bg-primary/10" },
  success: { icon: CircleCheck, iconClass: "text-success", chipClass: "bg-success/10" },
  warning: { icon: TriangleAlert, iconClass: "text-warning", chipClass: "bg-warning/10" },
  error: { icon: CircleAlert, iconClass: "text-destructive", chipClass: "bg-destructive/10" },
};

function DialogIcon({ variant }: { variant: AlertVariant }) {
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:mx-0",
        meta.chipClass
      )}
      aria-hidden
    >
      <Icon className={cn("h-5 w-5", meta.iconClass)} />
    </span>
  );
}

/** Mounted once in the root layout; renders whatever dialog is currently queued. */
export function DialogServiceHost() {
  const current = useDialogStore((s) => s.current);
  const next = useDialogStore((s) => s.next);

  const close = React.useCallback(
    (result: boolean) => {
      if (!current) return;
      if (current.kind === "alert") current.resolve();
      else current.resolve(result);
      // Let the exit animation play before mounting the next request.
      setTimeout(next, 150);
    },
    [current, next]
  );

  if (!current) return null;

  if (current.kind === "alert") {
    return (
      <AlertDialog open onOpenChange={(open) => !open && close(true)}>
        <AlertDialogContent className="max-w-md">
          <div className="flex flex-col gap-4 sm:flex-row">
            <DialogIcon variant={current.variant} />
            <AlertDialogHeader className="min-w-0">
              <AlertDialogTitle>{current.title}</AlertDialogTitle>
              {current.description ? (
                <AlertDialogDescription className="whitespace-pre-line break-words">
                  {current.description}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => close(true)} autoFocus>
              {current.confirmLabel ?? COPY.dialogs.ok}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent className="max-w-md">
        <div className="flex flex-col gap-4 sm:flex-row">
          <DialogIcon variant={current.destructive ? "error" : "warning"} />
          <AlertDialogHeader className="min-w-0">
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            {current.description ? (
              <AlertDialogDescription className="whitespace-pre-line break-words">
                {current.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {current.cancelLabel ?? COPY.confirm.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={current.destructive ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {current.confirmLabel ??
              (current.destructive ? COPY.confirm.delete : COPY.confirm.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
