import * as React from "react";
import { toast } from "sonner";
import { COPY } from "@/config/copy";
import { useMediaStore } from "@/features/media/media-store";

/** File-picker + drag-and-drop media importing with toast feedback. */
export function useMediaImport() {
  const importFiles = useMediaStore((s) => s.importFiles);
  const importing = useMediaStore((s) => s.importing);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const { imported, failed } = await importFiles(files);
      if (imported.length > 0) toast.success(COPY.toasts.mediaImported(imported.length));
      for (const f of failed) {
        toast.error(
          f.reason === "too-large"
            ? COPY.toasts.fileTooLarge(f.name)
            : COPY.toasts.unsupportedFile(f.name)
        );
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
