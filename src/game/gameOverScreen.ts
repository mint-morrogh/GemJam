import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT, screenToVirtual } from '../canvas';
import { drawGameOverSummary } from './renderer';
import type { ScoringState, ScoreEntry } from './scoring';
import type { RunStats } from './state';

// ---------------------------------------------------------------------------
// Play Again button geometry (virtual coordinates, touch-target safe)
// ---------------------------------------------------------------------------

const BTN_W = IS_PORTRAIT ? 260 : 220;
const BTN_H = IS_PORTRAIT ? 76 : 56;

const PLAY_AGAIN_BTN = {
  x: VIRTUAL_WIDTH / 2 - BTN_W / 2,
  y: VIRTUAL_HEIGHT / 2 + 210,
  w: BTN_W,
  h: BTN_H,
};

// ---------------------------------------------------------------------------
// Animation state
// ---------------------------------------------------------------------------

/** Duration (seconds) for the backdrop to fade from 0 → target opacity. */
const FADE_DURATION = 0.5;
/** Delay (seconds) between each staggered element appearing. */
const STAGGER_DELAY = 0.15;

/** Number of distinct elements that fade in sequentially:
 *  0 = title, 1 = score, 2 = stats, 3 = high-score, 4 = leaderboard, 5 = button */
export const ELEMENT_COUNT = 6;

/** Minimum seconds after game-over before the Play Again button accepts clicks. */
const RESTART_COOLDOWN = 0.6;

/** Animation progress state. Managed externally via start/update/reset. */
interface GameOverAnim {
  /** Seconds elapsed since game-over triggered. -1 = inactive. */
  elapsed: number;
}

const anim: GameOverAnim = { elapsed: -1 };

/** Call once when game-over triggers to begin the animation. */
export function startGameOverAnim(): void {
  anim.elapsed = 0;
}

/** Advance the animation clock. Call once per update tick with dt in seconds. */
export function updateGameOverAnim(dt: number): void {
  if (anim.elapsed < 0) return;
  anim.elapsed += dt;
}

/** Reset animation (e.g. on restart). */
export function resetGameOverAnim(): void {
  anim.elapsed = -1;
}

/** Backdrop opacity (0–1), fading in over FADE_DURATION. */
function backdropAlpha(): number {
  if (anim.elapsed < 0) return 0;
  return Math.min(anim.elapsed / FADE_DURATION, 1);
}

/**
 * Per-element alpha (0–1). Elements appear sequentially, each starting
 * STAGGER_DELAY after the previous, fading in over STAGGER_DELAY.
 */
export function elementAlpha(index: number): number {
  if (anim.elapsed < 0) return 0;
  const start = index * STAGGER_DELAY;
  const t = (anim.elapsed - start) / STAGGER_DELAY;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** Draw the full game-over overlay with fade-in animation. */
export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  scoring: Readonly<ScoringState>,
  isNewHighScore: boolean,
  stats: RunStats,
  history: ScoreEntry[],
  rank: number,
): void {
  drawGameOverSummary(ctx, scoring, isNewHighScore, stats, backdropAlpha(), elementAlpha, history, rank);
}

// ---------------------------------------------------------------------------
// Click handler
// ---------------------------------------------------------------------------

/**
 * Install the "Play Again" click listener on the given canvas.
 * `isGameOver` returns current game-over state; `onRestart` fires when the
 * button is clicked.
 */
export function installGameOverClickHandler(
  canvas: HTMLCanvasElement,
  isGameOver: () => boolean,
  onRestart: () => void,
): void {
  function tryRestart(clientX: number, clientY: number): void {
    if (!isGameOver()) return;
    if (anim.elapsed < RESTART_COOLDOWN) return;
    if (elementAlpha(ELEMENT_COUNT - 1) < 1) return;
    const vp = screenToVirtual(canvas, clientX, clientY);
    const { x, y, w, h } = PLAY_AGAIN_BTN;
    if (vp.x >= x && vp.x <= x + w && vp.y >= y && vp.y <= y + h) {
      onRestart();
    }
  }

  // Desktop: click works normally
  canvas.addEventListener('click', (e) => tryRestart(e.clientX, e.clientY));

  // Mobile: touchstart preventDefault suppresses click, so listen directly
  canvas.addEventListener('touchend', (e) => {
    if (!isGameOver()) return;
    const touch = e.changedTouches[0];
    if (touch) tryRestart(touch.clientX, touch.clientY);
  });
}
