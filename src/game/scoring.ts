import { GEM_TIERS } from './gems';
import { loadJSON, saveJSON } from './storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Base points awarded when a merge produces a gem of the given tier.
 * Indexed by the *result* tier id (e.g. merging two quartz → topaz = 3 pts).
 */
export const BASE_POINTS: readonly number[] = GEM_TIERS.map((g) => g.points);

/**
 * Combo multiplier thresholds — sorted descending so the first match wins.
 * Each entry: [minimumComboCount, multiplier].
 */
export const COMBO_THRESHOLDS: readonly [number, number][] = [
  [10, 5],
  [7,  4],
  [5,  3],
  [3,  2],
] as const;

/** Default multiplier when combo count is below the lowest threshold. */
export const BASE_MULTIPLIER = 1;

/** Seconds after a merge during which the next merge still counts as a combo. */
export const COMBO_WINDOW = 1.5;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ScoringState {
  /** Current score accumulated this run. */
  score: number;
  /** Number of consecutive merges in the active combo chain. */
  comboCount: number;
  /** Active multiplier derived from comboCount. */
  comboMultiplier: number;
  /** Highest combo count achieved this run. */
  bestCombo: number;
  /** Best score across all runs (persisted to localStorage). */
  highScore: number;
  /** Elapsed game time (seconds) of the last merge, used for combo window. */
  lastMergeTime: number;
}

/** Create a fresh scoring state (high score loaded separately). */
export function createScoringState(highScore = 0): ScoringState {
  return {
    score: 0,
    comboCount: 0,
    comboMultiplier: BASE_MULTIPLIER,
    bestCombo: 0,
    highScore,
    lastMergeTime: -Infinity,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the combo multiplier for a given combo count. */
export function comboMultiplierFor(comboCount: number): number {
  for (const [threshold, multiplier] of COMBO_THRESHOLDS) {
    if (comboCount >= threshold) return multiplier;
  }
  return BASE_MULTIPLIER;
}

/**
 * Register a merge event at the given elapsed game time.
 * Increments combo if within COMBO_WINDOW of the last merge, otherwise resets to 1.
 * Updates comboMultiplier accordingly.
 */
export function registerMerge(scoring: ScoringState, now: number): void {
  if (now - scoring.lastMergeTime <= COMBO_WINDOW) {
    scoring.comboCount += 1;
  } else {
    scoring.comboCount = 1;
  }
  scoring.lastMergeTime = now;
  scoring.comboMultiplier = comboMultiplierFor(scoring.comboCount);
  if (scoring.comboCount > scoring.bestCombo) {
    scoring.bestCombo = scoring.comboCount;
  }
}

/**
 * Call each update tick to reset combo when the window expires.
 */
export function updateCombo(scoring: ScoringState, now: number): void {
  if (scoring.comboCount > 0 && now - scoring.lastMergeTime > COMBO_WINDOW) {
    scoring.comboCount = 0;
    scoring.comboMultiplier = BASE_MULTIPLIER;
  }
}

// ---------------------------------------------------------------------------
// Score history (top 10 leaderboard)
// ---------------------------------------------------------------------------

const LS_SCORES_KEY = 'gemjam_scores';
const MAX_SCORE_ENTRIES = 10;

export interface ScoreEntry {
  score: number;
  bestCombo: number;
  date: string; // ISO 8601
}

/** Load the persisted score history (top 10, descending). */
export function loadScoreHistory(): ScoreEntry[] {
  const raw = loadJSON<ScoreEntry[]>(LS_SCORES_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e) =>
        e != null &&
        typeof e.score === 'number' &&
        typeof e.bestCombo === 'number' &&
        typeof e.date === 'string',
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORE_ENTRIES);
}

/**
 * Record a finished run into the score history.
 * Keeps only the top 10 entries. Returns the (possibly updated) list and the
 * rank (0-based index) of the new entry, or -1 if it didn't place.
 */
export function recordScore(scoring: ScoringState): { history: ScoreEntry[]; rank: number } {
  const entry: ScoreEntry = {
    score: scoring.score,
    bestCombo: scoring.bestCombo,
    date: new Date().toISOString(),
  };
  const history = loadScoreHistory();
  history.push(entry);
  history.sort((a, b) => b.score - a.score);
  if (history.length > MAX_SCORE_ENTRIES) history.length = MAX_SCORE_ENTRIES;
  saveJSON(LS_SCORES_KEY, history);

  const rank = history.indexOf(entry);
  return { history, rank };
}

// ---------------------------------------------------------------------------
// High score persistence (localStorage)
// ---------------------------------------------------------------------------

const LS_HIGH_SCORE_KEY = 'gemjam_high_score';

/** Load saved high score from localStorage. Returns 0 if absent or invalid. */
export function loadHighScore(): number {
  const val = loadJSON<number>(LS_HIGH_SCORE_KEY, 0);
  return Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
}

/**
 * Persist high score to localStorage if the current score beats it.
 * Updates `scoring.highScore` in-place. Returns true if a new record was set.
 */
export function saveHighScore(scoring: ScoringState): boolean {
  if (scoring.score <= scoring.highScore) return false;
  scoring.highScore = scoring.score;
  saveJSON(LS_HIGH_SCORE_KEY, scoring.highScore);
  return true;
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/**
 * Award points for a merge that produced the given result tier.
 * Applies the current combo multiplier and updates the score.
 * Returns the points actually awarded (after multiplier).
 */
export function awardMergePoints(scoring: ScoringState, resultTier: number): number {
  const base = BASE_POINTS[resultTier] ?? 0;
  const points = base * scoring.comboMultiplier;
  scoring.score += points;
  return points;
}
