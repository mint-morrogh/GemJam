// ---------------------------------------------------------------------------
// Game persistence — save/restore full game state to localStorage
// ---------------------------------------------------------------------------

import { loadJSON, saveJSON, removeKey } from './storage';

const SAVE_KEY = 'gemjam_save';

// ---------------------------------------------------------------------------
// Save data shape
// ---------------------------------------------------------------------------

export interface GemSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: number;
  /** Prestige rainbow flag (defaults to false for old saves). */
  rainbow?: boolean;
}

export interface SaveData {
  version: 1;
  /** All physics gem bodies: position, velocity, tier. */
  gems: GemSnapshot[];
  /** Upcoming gem queue as tier indices. */
  queue: number[];
  /** Parallel flag array — true marks a queue slot as an essence (wildcard merge). */
  queueEssence?: boolean[];
  /** Scoring state. */
  score: number;
  highScore: number;
  comboCount: number;
  comboMultiplier: number;
  bestCombo: number;
  lastMergeTime: number;
  /** Elapsed game time (for combo window restoration). */
  elapsedTime: number;
  /** Run stats. */
  mergeCount: number;
  peakTier: number;
  maxCombo: number;
  gameOver: boolean;
  /** Current level (so we don't re-trigger level-up on restore). */
  level?: number;
  /** Shake-phase snapshot — so refreshing in the shop doesn't rewind to level-complete. */
  shakePhase?: string;
  shakePhaseTimer?: number;
  shakeCountdownNum?: number;
  shakeScore?: number;
  /** Banked shake pill charges earned from leveling up. */
  shakeCharges?: number;
  /** True if the currently-running shake was player-triggered. */
  shakeManual?: boolean;
  /** Order in which action-rail abilities were first unlocked. */
  abilityRail?: ('skip_throw' | 'shake' | 'essence')[];
  /** Game mode the save belongs to — used for cross-mode collision checks. */
  mode?: 'classic' | 'suika';
}

// ---------------------------------------------------------------------------
// Read / write / clear
// ---------------------------------------------------------------------------

/** Write a save snapshot to localStorage. */
export function writeSave(data: SaveData): void {
  saveJSON(SAVE_KEY, data);
}

/** Read the save from localStorage. Returns null if missing or invalid. */
export function readSave(): SaveData | null {
  const data = loadJSON<SaveData | null>(SAVE_KEY, null);
  if (!data || data.version !== 1 || !Array.isArray(data.gems)) return null;
  return data;
}

/** Remove the save from localStorage. */
export function clearSave(): void {
  removeKey(SAVE_KEY);
}
