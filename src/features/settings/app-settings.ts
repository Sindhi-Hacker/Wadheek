import { STORAGE_KEYS } from "@/config/defaults";

/** App-level preferences persisted in localStorage (per-browser, not per-project). */
export interface AppSettings {
  snapByDefault: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  snapByDefault: true,
};

export const APP_SETTINGS_KEY = STORAGE_KEYS.settings;

export function readAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_SETTINGS;
}

export function writeAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readAppSettings(), ...patch };
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable (private mode); settings stay in-memory */
  }
  return next;
}
