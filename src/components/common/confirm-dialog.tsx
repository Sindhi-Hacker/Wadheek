import { CircleAlert, TriangleAlert } from "lucide-react";
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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * Professional confirmation modal built on Radix AlertDialog: focus-trapped,
 * ESC/overlay-dismissable as "cancel", destructive styling with icon.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const Icon = destructive ? CircleAlert : TriangleAlert;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <div className="flex flex-col gap-4 sm:flex-row">
          <span
            className={cn(
              "mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:mx-0",
              destructive ? "bg-destructive/10" : "bg-warning/10"
            )}
            aria-hidden
          >
            <Icon className={cn("h-5 w-5", destructive ? "text-destructive" : "text-warning")} />
          </span>
          <AlertDialogHeader className="min-w-0">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="break-words">
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {COPY.confirm.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel ?? (destructive ? COPY.confirm.delete : COPY.confirm.confirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
