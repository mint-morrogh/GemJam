// ---------------------------------------------------------------------------
// Game mode — Classic (default) vs Suika (continuous, no shop)
// ---------------------------------------------------------------------------
// Persists to localStorage. High scores + score history are scoped per-mode
// (see scoring.ts which calls getGameMode() when building storage keys).
// ---------------------------------------------------------------------------

export type GameMode = 'classic' | 'suika' | 'tutorial';

const STORAGE_KEY = 'gemjam_mode';

let currentMode: GameMode = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'classic' || v === 'suika') return v;
  } catch { /* */ }
  return 'classic';
})();

export function getGameMode(): GameMode { return currentMode; }

/** The persisted (non-tutorial) mode — what the player will return to after
 *  exiting the tutorial. Unlike currentMode this never holds 'tutorial'. */
export function getPersistedMode(): GameMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'classic' || v === 'suika') return v;
  } catch { /* */ }
  return 'classic';
}

/**
 * Set the game mode. Tutorial is session-only and never persisted — refreshing
 * mid-tutorial should bounce back to the homepage in the last non-tutorial mode.
 */
export function setGameMode(m: GameMode): void {
  currentMode = m;
  if (m === 'tutorial') return; // session-only, never write
  try { localStorage.setItem(STORAGE_KEY, m); } catch { /* */ }
}

/** Display name for UI.
 *  NOTE: storage keys still use 'classic' / 'suika' — only labels change. */
export function gameModeLabel(m: GameMode): string {
  if (m === 'suika') return 'Endless';
  if (m === 'tutorial') return 'Tutorial';
  return 'GEMJAM';
}

/** Short blurb shown on the mode-select screen. */
export function gameModeBlurb(m: GameMode): string {
  if (m === 'suika') return 'One continuous level. No shop. Pure merging.';
  if (m === 'tutorial') return 'Learn the ropes: aiming, combos, shake, shop, and game over.';
  return 'Level thresholds, shake interludes, and an upgrade shop.';
}
