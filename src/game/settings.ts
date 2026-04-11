import { loadJSON, saveJSON } from './storage';

// ---------------------------------------------------------------------------
// Game settings — data model & defaults
// ---------------------------------------------------------------------------

export interface Settings {
  /** Master music volume (0–1). */
  musicVolume: number;
  /** Sound-effects volume (0–1). */
  sfxVolume: number;
  /** Whether to render particle effects (merges, combos, etc.). */
  showParticles: boolean;
  /** Whether to show the danger-zone warning overlay near the top. */
  showDangerWarning: boolean;
  /** Whether to show the ghost/preview of where a gem will land. */
  showDropPreview: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  showParticles: true,
  showDangerWarning: true,
  showDropPreview: true,
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const LS_SETTINGS_KEY = 'gemjam_settings';

/** In-memory copy of the active settings. */
let current: Settings = { ...DEFAULT_SETTINGS };

/** Load settings from localStorage (merges with defaults for missing keys). */
export function loadSettings(): Settings {
  const stored = loadJSON<Partial<Settings>>(LS_SETTINGS_KEY, {});
  current = { ...DEFAULT_SETTINGS, ...stored };
  return current;
}

/** Return the current in-memory settings (read-only view). */
export function getSettings(): Readonly<Settings> {
  return current;
}

/** Update a single setting, persist immediately. */
export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current[key] = value;
  saveJSON(LS_SETTINGS_KEY, current);
}

/** Reset in-memory settings to defaults (does NOT clear localStorage — use clearAllData for that). */
export function resetSettingsToDefaults(): void {
  current = { ...DEFAULT_SETTINGS };
}
