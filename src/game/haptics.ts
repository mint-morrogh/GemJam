// ---------------------------------------------------------------------------
// Haptics — vibration feedback for merges, explosions, etc.
// ---------------------------------------------------------------------------
// Uses the Web Vibration API (`navigator.vibrate`). No permission required.
// IMPORTANT: iOS Safari does NOT implement this API — calls silently no-op.
// Android Chrome/Firefox + most other mobile browsers support it natively.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gemjam_haptics';

let hapticsEnabled = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1'; // default ON
  } catch { return true; }
})();

export function getHapticsEnabled(): boolean { return hapticsEnabled; }

export function setHapticsEnabled(v: boolean): void {
  hapticsEnabled = v;
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch { /* */ }
}

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibe(pattern: number | number[]): void {
  if (!hapticsEnabled) return;
  if (!isHapticsSupported()) return;
  try { navigator.vibrate(pattern); } catch { /* */ }
}

/**
 * Per-merge vibration. Scales gently with tier so big merges feel weightier
 * but never become annoying.
 */
export function hapticMerge(tier: number): void {
  let ms: number;
  if (tier <= 2) ms = 8;        // pebble/moonstone/turquoise — barely-there tap
  else if (tier <= 5) ms = 14;  // mid-tier — light tick
  else if (tier <= 8) ms = 24;  // ruby/citrine/topaz — solid pulse
  else ms = 38;                  // emerald/diamond — heavy thump
  vibe(ms);
}

/** Two-stage rumble for explosion merges. */
export function hapticExplosion(): void {
  vibe([55, 25, 80]);
}

/** Quick double-tap for tier-skip procs — distinct from a normal merge. */
export function hapticTierSkip(): void {
  vibe([10, 25, 14]);
}

/** Long pull-in feel for black hole consumption. */
export function hapticBlackhole(): void {
  vibe([18, 18, 32]);
}

/** Big celebratory pattern for prestige cycle (tier 11 → rainbow). */
export function hapticPrestige(): void {
  vibe([90, 40, 90, 40, 140]);
}

/**
 * Init — currently a no-op. The Vibration API needs no permission and no
 * gesture, so there's nothing to set up. Kept as a hook for future warmup
 * tricks (e.g. AudioContext-based haptic substitute on iOS).
 */
export function initHaptics(): void {
  // intentionally empty
}
