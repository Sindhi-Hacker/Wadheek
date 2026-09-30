import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CloudOff,
  Database,
  HardDrive,
  Magnet,
  Monitor,
  Moon,
  Paintbrush,
  Save,
  Sun,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { LogoMark } from "@/components/common/logo";
import { showConfirm } from "@/components/common/dialog-service";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { readAppSettings, writeAppSettings } from "@/features/settings/app-settings";
import { clearAllIdb } from "@/features/editor/lib/idb-storage";
import { clearAllBlobs, estimateUsage } from "@/features/editor/lib/opfs-storage";
import { formatBytes, cn } from "@/lib/utils";
import { COPY } from "@/config/copy";
import { APP_VERSION } from "@/config/defaults";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

/* ---------------------------------- layout helpers ---------------------------------- */

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Sun;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-elevation-1">
      <header className="flex items-start gap-3 px-4 pb-3 pt-4 md:px-5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
          aria-hidden
        >
          <Icon className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight md:text-base">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{description}</p>
          )}
        </div>
      </header>
      <Separator />
      <div className="px-4 py-4 md:px-5">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/* ---------------------------------- appearance ---------------------------------- */

const THEME_TILES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: COPY.theme.light, icon: Sun },
  { value: "dark", label: COPY.theme.dark, icon: Moon },
  { value: "system", label: COPY.theme.system, icon: Monitor },
];

function AppearanceTiles() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-2 sm:max-w-md" role="radiogroup" aria-label={COPY.theme.toggleLabel}>
      {THEME_TILES.map((tile) => {
        const active = theme === tile.value;
        return (
          <button
            key={tile.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(tile.value)}
            className={cn(
              "touch-target flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3.5 text-xs font-medium transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
              active
                ? "border-primary bg-primary/10 text-primary shadow-elevation-1"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <tile.icon className="h-5 w-5" />
            {tile.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

function SettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = React.useState(() => readAppSettings());
  const [clearing, setClearing] = React.useState(false);

  const usageQuery = useQuery({
    queryKey: ["storage-usage"],
    queryFn: estimateUsage,
    staleTime: 30_000,
  });

  const setSnapDefault = (snapByDefault: boolean) => {
    setSettings(writeAppSettings({ snapByDefault }));
  };

  const clearEverything = async () => {
    const confirmed = await showConfirm({
      title: COPY.settings.clearConfirmTitle,
      description: COPY.settings.clearConfirmBody,
      confirmLabel: COPY.confirm.delete,
      destructive: true,
    });
    if (!confirmed) return;
    setClearing(true);
    try {
      await Promise.allSettled([clearAllIdb(), clearAllBlobs()]);
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("wadheek.")) localStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
      toast.success(COPY.settings.cleared);
      await queryClient.invalidateQueries();
      // Full reload so every in-memory store starts from a clean slate.
      window.location.assign("/");
    } finally {
      setClearing(false);
    }
  };

  const usage = usageQuery.data;
  const usagePct =
    usage && usage.quota > 0 ? Math.min(100, Math.round((usage.usage / usage.quota) * 100)) : 0;

  return (
    <div className="container max-w-3xl py-6 md:py-10">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {COPY.settings.title}
        </h1>
      </header>

      <div className="flex flex-col gap-4 md:gap-5">
        <SettingsSection
          icon={Paintbrush}
          title={COPY.settings.appearance}
          description={COPY.settings.appearanceBody}
        >
          <AppearanceTiles />
        </SettingsSection>

        <SettingsSection icon={Magnet} title={COPY.settings.playback}>
          <div className="flex flex-col gap-4">
            <SettingRow
              label={COPY.settings.snapDefault}
              description={COPY.settings.snapDefaultBody}
              control={
                <Switch
                  checked={settings.snapByDefault}
                  onCheckedChange={setSnapDefault}
                  aria-label={COPY.settings.snapDefault}
                />
              }
            />
            <Separator />
            <SettingRow
              label={COPY.settings.autosave}
              description={COPY.settings.autosaveBody}
              control={
                <Badge variant="secondary" className="gap-1">
                  <Save className="h-3 w-3" /> {COPY.settings.alwaysOn}
                </Badge>
              }
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Database}
          title={COPY.settings.storage}
          description={COPY.settings.storageBody}
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  {COPY.settings.usage}
                </p>
                {usageQuery.isLoading ? (
                  <Skeleton className="h-4 w-36" />
                ) : usage ? (
                  <p className="text-xs text-muted-foreground">
                    {COPY.settings.usageOf(formatBytes(usage.usage), formatBytes(usage.quota))}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{COPY.settings.usageUnknown}</p>
                )}
              </div>
              <Progress value={usagePct} aria-label={COPY.settings.usage} />
            </div>
            <Separator />
            <SettingRow
              label={COPY.settings.clear}
              description={COPY.settings.clearConfirmBody}
              control={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void clearEverything()}
                  disabled={clearing}
                >
                  <Trash2 /> {COPY.settings.clear}
                </Button>
              }
            />
          </div>
        </SettingsSection>

        <SettingsSection icon={CloudOff} title={COPY.settings.about}>
          <div className="flex items-start gap-3">
            <LogoMark className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {COPY.app.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {COPY.settings.version} {APP_VERSION}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{COPY.app.tagline}</p>
              <p className="mt-1 text-xs text-muted-foreground">{COPY.app.privacyNote}</p>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
