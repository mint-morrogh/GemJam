// ---------------------------------------------------------------------------
// Generic localStorage persistence helpers
// ---------------------------------------------------------------------------

/**
 * Load a JSON value from localStorage.
 * Returns `fallback` if the key is missing, the value is not valid JSON, or
 * localStorage is unavailable.
 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Save a JSON-serialisable value to localStorage.
 * Silently swallows quota errors and other write failures.
 */
export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota / security errors are non-fatal */ }
}

/**
 * Remove a key from localStorage.
 * Silently swallows errors.
 */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* non-fatal */ }
}

/** Prefix used for all game storage keys. */
const KEY_PREFIX = 'gemjam_';

/**
 * Remove all `gemjam_*` keys from localStorage.
 * Silently swallows errors.
 */
export function clearAllData(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch { /* non-fatal */ }
}
