// ---------------------------------------------------------------------------
// Game mode — Classic (default) vs Suika (continuous, no shop)
// ---------------------------------------------------------------------------
// Persists to localStorage. High scores + score history are scoped per-mode
// (see scoring.ts which calls getGameMode() when building storage keys).
// ---------------------------------------------------------------------------

export type GameMode = 'classic' | 'suika';

const STORAGE_KEY = 'gemjam_mode';

let currentMode: GameMode = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'classic' || v === 'suika') return v;
  } catch { /* */ }
  return 'classic';
})();

export function getGameMode(): GameMode { return currentMode; }

export function setGameMode(m: GameMode): void {
  currentMode = m;
  try { localStorage.setItem(STORAGE_KEY, m); } catch { /* */ }
}

/** Display name for UI.
 *  NOTE: storage keys still use 'classic' / 'suika' — only labels change. */
export function gameModeLabel(m: GameMode): string {
  return m === 'classic' ? 'GEMJAM' : 'Endless';
}

/** Short blurb shown on the mode-select screen. */
export function gameModeBlurb(m: GameMode): string {
  if (m === 'suika') return 'One continuous level. No shop. Pure merging.';
  return 'Level thresholds, shake interludes, and an upgrade shop.';
}
