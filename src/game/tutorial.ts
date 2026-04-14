// ---------------------------------------------------------------------------
// Tutorial mode — step-driven walkthrough of core mechanics
// ---------------------------------------------------------------------------
// Runs as its own game mode. Never persists (refresh bounces back to home).
// Each beat either shows a dismissable message ("pseudo-pause"), asks the
// player to perform a UI action (open nav, flip a toggle), or lets them
// free-fire a few shots before the next pause. The tap that dismisses a
// message also passes through to normal input so e.g. tapping the nav both
// closes the message AND opens the nav.
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import { getFireMode } from './input';
import { getAutoShakeMobile } from './levelShake';
import {
  isDropdownOpen,
  closeDropdown,
  getNavHeight,
  getAutoShakeBtnRect,
  getFireModeBtnRect,
} from './dropdown';
import { getNextGemsStripRect, getDangerLineRect, getNextLevelHudRect } from './renderer';

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

export type HighlightTarget =
  | 'nav'
  | 'fire-mode-toggle'
  | 'auto-shake-toggle'
  | 'next-gems'
  | 'danger-line'
  | 'next-level-hud'
  | null;

interface MessageBeat {
  kind: 'message';
  text: string;
  highlight?: HighlightTarget;
}

interface ActionBeat {
  kind: 'action';
  text: string;
  highlight: HighlightTarget;
  /** What user action completes this beat. */
  await: 'nav-open' | 'fire-mode-change' | 'autoshake-change';
}

interface FreeplayBeat {
  kind: 'freeplay';
  shots: number;
  /** Optional highlight that persists while the player takes their shots. */
  highlight?: HighlightTarget;
}

interface EndBeat { kind: 'end' }

type Beat = MessageBeat | ActionBeat | FreeplayBeat | EndBeat;

// Is this a mobile layout? Drives wording ("tap" vs "click").
const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const TAP = IS_MOBILE ? 'Tap' : 'Click';

const BEATS: Beat[] = [
  { kind: 'message', text: `${TAP} and drag anywhere to aim. ${TAP} again with another finger to fire.` },
  { kind: 'freeplay', shots: 2 },
  {
    kind: 'action',
    text: `You can change your fire mode in the top nav. ${TAP} the nav bar to open it.`,
    highlight: 'nav',
    await: 'nav-open',
  },
  {
    kind: 'action',
    text: `${TAP} FIRE to switch between multi-tap and hold-and-release.`,
    highlight: 'fire-mode-toggle',
    await: 'fire-mode-change',
  },
  { kind: 'freeplay', shots: 2 },
  { kind: 'message', text: `The top nav also shows your upgrades as you unlock them.` },
  { kind: 'message', text: `Check the next-gems strip to plan combos ahead of time.`, highlight: 'next-gems' },
  // Keep the next-gems glow up while the player takes a few shots and sees it.
  { kind: 'freeplay', shots: 2, highlight: 'next-gems' },
  { kind: 'message', text: `Combos earn you more gold and points.` },
  { kind: 'freeplay', shots: 2 },
  { kind: 'message', text: `At the end of each level, you get to shake the gem well.` },
  {
    kind: 'action',
    text: `You can shake with your phone's accelerometer or let the game shake for you. ${TAP} the nav.`,
    highlight: 'nav',
    await: 'nav-open',
  },
  {
    kind: 'action',
    text: `Toggle AUTO-SHAKE to flip between the two.`,
    highlight: 'auto-shake-toggle',
    await: 'autoshake-change',
  },
  { kind: 'freeplay', shots: 2 },
  { kind: 'message', text: `Bigger merges score more points. Each level has a point threshold before the shop.` },
  // Highlight the NEXT LVL readout in the top HUD for a few shots so the
  // player sees exactly where the threshold is tracked.
  { kind: 'freeplay', shots: 2, highlight: 'next-level-hud' },
  { kind: 'message', text: `If your gems pass this red line, it's game over.`, highlight: 'danger-line' },
  { kind: 'freeplay', shots: 1, highlight: 'danger-line' },
  { kind: 'message', text: `Good luck!` },
  { kind: 'end' },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface TutorialState {
  active: boolean;
  /** Current beat index. */
  step: number;
  /** Is the pseudo-pause message overlay showing? Only message/action beats start with this true. */
  messageShowing: boolean;
  /** Shots fired since beat started (for freeplay beats). */
  shotsThisBeat: number;
  /** Snapshot values at the start of an action beat (for change detection). */
  startFireMode: string;
  startAutoShake: boolean;
  /** Prev dropdown state so we can detect transitions. */
  prevDropdownOpen: boolean;
  /** Latched: set when finish() is called so main.ts can return to home. */
  completed: boolean;
}

const ts: TutorialState = {
  active: false,
  step: 0,
  messageShowing: false,
  shotsThisBeat: 0,
  startFireMode: 'multitap',
  startAutoShake: false,
  prevDropdownOpen: false,
  completed: false,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isTutorialActive(): boolean { return ts.active; }
export function isTutorialMessageShowing(): boolean { return ts.active && ts.messageShowing; }
export function tutorialCompletedThisTick(): boolean {
  if (ts.completed) { ts.completed = false; return true; }
  return false;
}

/** Current beat (or null if tutorial isn't active / finished). */
function currentBeat(): Beat | null {
  if (!ts.active) return null;
  return BEATS[ts.step] ?? null;
}

/** Highlight target for the current beat (or null). */
export function getTutorialHighlight(): HighlightTarget {
  const b = currentBeat();
  if (!b) return null;
  if (b.kind === 'message') return b.highlight ?? null;
  if (b.kind === 'action') return b.highlight;
  if (b.kind === 'freeplay') return b.highlight ?? null;
  return null;
}

export function getTutorialMessage(): string | null {
  if (!ts.messageShowing) return null;
  const b = currentBeat();
  if (!b) return null;
  if (b.kind === 'message' || b.kind === 'action') return b.text;
  return null;
}

/**
 * Firing is blocked while a tutorial message is showing OR during action beats
 * (the player is being asked to do something specific, not fire).
 */
export function canFireInTutorial(): boolean {
  if (!ts.active) return true;
  if (ts.messageShowing) return false;
  const b = currentBeat();
  if (!b) return true;
  return b.kind === 'freeplay';
}

/** Begin the tutorial from step 0. Caller should also set the game mode. */
export function startTutorial(): void {
  ts.active = true;
  ts.step = 0;
  ts.shotsThisBeat = 0;
  ts.startFireMode = getFireMode();
  ts.startAutoShake = getAutoShakeMobile();
  ts.prevDropdownOpen = false;
  ts.completed = false;
  enterBeat();
}

/** Force-end the tutorial (e.g., when user returns to home). */
export function endTutorial(): void {
  ts.active = false;
  ts.messageShowing = false;
}

// ---------------------------------------------------------------------------
// Internal: enter a beat
// ---------------------------------------------------------------------------

function enterBeat(): void {
  const b = currentBeat();
  if (!b) return;
  ts.shotsThisBeat = 0;

  if (b.kind === 'message' || b.kind === 'action') {
    ts.messageShowing = true;
  } else {
    ts.messageShowing = false;
  }

  if (b.kind === 'action') {
    ts.startFireMode = getFireMode();
    ts.startAutoShake = getAutoShakeMobile();
  }

  if (b.kind === 'end') {
    ts.active = false;
    ts.messageShowing = false;
    ts.completed = true;
  }
}

function advance(): void {
  ts.step++;
  enterBeat();
}

// ---------------------------------------------------------------------------
// Event hooks — called from main.ts / other modules
// ---------------------------------------------------------------------------

/**
 * Any tap dismisses the current message. Returns true if a message was
 * actively showing (caller can use this to gate downstream click handling
 * if desired — but typically we want the tap to pass through to nav/etc).
 */
export function notifyTap(): boolean {
  if (!ts.active || !ts.messageShowing) return false;
  ts.messageShowing = false;

  const b = currentBeat();
  if (!b) return true;

  // Pure message beats auto-advance on dismiss. Action beats keep the highlight
  // up and wait for the user to perform the required action.
  if (b.kind === 'message') {
    advance();
  }
  return true;
}

/** Hook called whenever a gem fires successfully. */
export function notifyFired(): void {
  if (!ts.active) return;
  const b = currentBeat();
  if (!b || b.kind !== 'freeplay') return;
  ts.shotsThisBeat++;
  if (ts.shotsThisBeat >= b.shots) {
    advance();
  }
}

/**
 * Call every tick to poll for nav/toggle state changes that satisfy action beats.
 * We poll rather than hook every module because it keeps the surface area small.
 */
export function updateTutorial(_dt: number): void {
  if (!ts.active) return;
  const b = currentBeat();
  if (!b || b.kind !== 'action' || ts.messageShowing) {
    ts.prevDropdownOpen = isDropdownOpen();
    return;
  }

  const open = isDropdownOpen();

  if (b.await === 'nav-open') {
    // Transition from closed→open satisfies the beat
    if (open && !ts.prevDropdownOpen) {
      advance();
    }
  } else if (b.await === 'fire-mode-change') {
    if (getFireMode() !== ts.startFireMode) {
      // Auto-close nav so the player can keep playing without a manual close
      closeDropdown();
      advance();
    }
  } else if (b.await === 'autoshake-change') {
    if (getAutoShakeMobile() !== ts.startAutoShake) {
      closeDropdown();
      advance();
    }
  }

  ts.prevDropdownOpen = open;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Pulsing alpha driven by wall-clock time — used for glow animations. */
function pulse(): number {
  const t = performance.now() / 1000;
  return 0.55 + 0.35 * Math.sin(t * 3.2);
}

/**
 * Highlights render BELOW the message overlay so they remain visible around
 * the darkened backdrop. A few targets (nav, danger-line, next-gems) draw
 * over whatever UI is already there. Toggle-button highlights only appear
 * while the dropdown is actually open.
 */
export function drawTutorialHighlights(ctx: CanvasRenderingContext2D): void {
  const target = getTutorialHighlight();
  if (!target) return;

  const a = pulse();
  ctx.save();

  if (target === 'nav') {
    const h = getNavHeight();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(251, 191, 36, ${a})`;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
    ctx.shadowBlur = 18;
    ctx.strokeRect(1, 1, VIRTUAL_WIDTH - 2, h - 2);
  } else if (target === 'fire-mode-toggle' && isDropdownOpen()) {
    const r = getFireModeBtnRect();
    strokeGlow(ctx, r.x, r.y, r.w, r.h, a, 10);
  } else if (target === 'auto-shake-toggle' && isDropdownOpen()) {
    const r = getAutoShakeBtnRect();
    strokeGlow(ctx, r.x, r.y, r.w, r.h, a, 10);
  } else if (target === 'next-gems') {
    const r = getNextGemsStripRect();
    strokeGlow(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, a, 12);
  } else if (target === 'next-level-hud') {
    const r = getNextLevelHudRect();
    strokeGlow(ctx, r.x, r.y, r.w, r.h, a, 10);
  } else if (target === 'danger-line') {
    // The game-over line is already drawn red — highlight with a red glow so
    // the association is obvious, not a gold accent that reads as a different
    // element.
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(248, 113, 113, ${a})`;
    ctx.shadowColor = 'rgba(248, 113, 113, 0.95)';
    ctx.shadowBlur = 22;
    const d = getDangerLineRect();
    ctx.beginPath();
    ctx.moveTo(d.x - 8, d.y);
    ctx.lineTo(d.x + d.w + 8, d.y);
    ctx.stroke();
  }

  ctx.restore();
}

function strokeGlow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  alpha: number, blur: number,
): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
  ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.stroke();
}

/**
 * Draw the pseudo-pause message overlay: dim backdrop + centered card with the
 * current beat's text + "tap to continue" hint. No-op if no message is active.
 */
export function drawTutorialMessage(ctx: CanvasRenderingContext2D): void {
  if (!ts.messageShowing) return;
  const text = getTutorialMessage();
  if (!text) return;

  ctx.save();

  // Dim backdrop — a touch lighter than the shop so the game peeks through,
  // and highlights drawn before this stay punchy.
  ctx.fillStyle = 'rgba(4, 6, 10, 0.72)';
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // Centered card
  const cardW = Math.min(VIRTUAL_WIDTH - 40, IS_PORTRAIT ? 420 : 560);
  const cardH = IS_PORTRAIT ? 190 : 160;
  const cx = VIRTUAL_WIDTH / 2;
  const cy = VIRTUAL_HEIGHT / 2;
  const x = cx - cardW / 2;
  const y = cy - cardH / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, 14);
  ctx.fillStyle = 'rgba(12, 16, 24, 0.96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.font = `bold ${IS_PORTRAIT ? 14 : 12}px monospace`;
  ctx.fillStyle = '#e8c44a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TUTORIAL', cx, y + 24);

  // Message — word-wrapped
  ctx.font = `${IS_PORTRAIT ? 16 : 15}px monospace`;
  ctx.fillStyle = '#ffffff';
  wrapCentered(ctx, text, cx, y + 62, cardW - 40, IS_PORTRAIT ? 22 : 20);

  // Tap-to-continue hint at the bottom of the card
  const hint = IS_MOBILE ? 'Tap anywhere to continue' : 'Click anywhere to continue';
  ctx.font = `${IS_PORTRAIT ? 12 : 11}px monospace`;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.2 * Math.sin(performance.now() / 250)})`;
  ctx.fillText(hint, cx, y + cardH - 22);

  ctx.restore();
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string, cx: number, y: number, maxWidth: number, lineHeight: number,
): void {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // Draw vertically centered around y
  const totalH = (lines.length - 1) * lineHeight;
  let drawY = y - totalH / 2 + lineHeight / 2;
  for (const l of lines) {
    ctx.fillText(l, cx, drawY);
    drawY += lineHeight;
  }
}

