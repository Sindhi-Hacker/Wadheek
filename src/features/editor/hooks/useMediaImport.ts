import * as React from "react";
import { toast } from "sonner";
import { COPY } from "@/config/copy";
import { showAlert } from "@/components/common/dialog-service";
import { useMediaStore, type ImportFailure } from "@/features/media/media-store";

function describeFailure(f: ImportFailure): string {
  if (f.reason === "too-large") return COPY.dialogs.importTooLarge(f.name);
  if (f.reason === "unsupported") return COPY.dialogs.importUnsupported(f.name);
  return COPY.dialogs.importReadError(f.name);
}

/**
 * File-picker + drag-and-drop media importing.
 * Successes get lightweight toast feedback; failures are consolidated into a
 * single professional alert dialog listing every skipped file.
 */
export function useMediaImport() {
  const importFiles = useMediaStore((s) => s.importFiles);
  const importing = useMediaStore((s) => s.importing);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const { imported, failed } = await importFiles(files);
      if (imported.length > 0) toast.success(COPY.toasts.mediaImported(imported.length));
      if (failed.length > 0) {
        void showAlert({
          variant: "error",
          title: COPY.dialogs.importIssuesTitle,
          description: [COPY.dialogs.importIssuesIntro, ...failed.map(describeFailure)].join("\n"),
        });
      }
    },
    [importFiles]
  );

  const openFilePicker = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      void handleFiles(files);
    },
    [handleFiles]
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files ?? []);
      void handleFiles(files);
    },
    [handleFiles]
  );

  return { inputRef, openFilePicker, onInputChange, onDrop, handleFiles, importing };
}
