// ---------------------------------------------------------------------------
// Top-nav dropdown menu — slides down from nav bar, pauses game
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, IS_PORTRAIT } from '../canvas';
import { getAutoShakeMobile, setAutoShakeMobile } from './levelShake';

const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NAV_H = 40;
const PANEL_H = IS_PORTRAIT ? 240 : 190;
const ANIM_DUR = 0.25;

const BTN_W = IS_PORTRAIT ? 200 : 180;
const BTN_H = IS_PORTRAIT ? 44 : 38;
const BTN_X = (VIRTUAL_WIDTH - BTN_W) / 2;
const RESTART_BTN_Y = NAV_H + PANEL_H - BTN_H - 20;
const TOGGLE_Y = RESTART_BTN_Y - BTN_H - 12; // auto-shake toggle above restart

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface DropdownState {
  open: boolean;
  /** 0 = fully closed, 1 = fully open */
  progress: number;
}

const ds: DropdownState = { open: false, progress: 0 };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isDropdownOpen(): boolean { return ds.open; }

/** Toggle open/closed. Returns true if the dropdown is now open. */
export function toggleDropdown(): boolean {
  ds.open = !ds.open;
  return ds.open;
}

export function closeDropdown(): void {
  ds.open = false;
}

/** Animate the slide. Call each update tick. */
export function updateDropdown(dt: number): void {
  const target = ds.open ? 1 : 0;
  if (ds.progress === target) return;

  const speed = 1 / ANIM_DUR;
  if (ds.open) {
    ds.progress = Math.min(1, ds.progress + speed * dt);
  } else {
    ds.progress = Math.max(0, ds.progress - speed * dt);
  }
}

/** Check if a virtual-coordinate click is inside the top nav bar. */
export function isClickInNav(vy: number): boolean {
  return vy <= NAV_H;
}

/** Check if a virtual-coordinate click hits the restart button. */
export function isClickOnRestart(vx: number, vy: number): boolean {
  if (ds.progress < 0.9) return false;
  return vx >= BTN_X && vx <= BTN_X + BTN_W &&
    vy >= RESTART_BTN_Y && vy <= RESTART_BTN_Y + BTN_H;
}

/** Check if a click hits the auto-shake toggle (mobile only). */
export function isClickOnAutoShake(vx: number, vy: number): boolean {
  if (!IS_MOBILE || ds.progress < 0.9) return false;
  return vx >= BTN_X && vx <= BTN_X + BTN_W &&
    vy >= TOGGLE_Y && vy <= TOGGLE_Y + BTN_H;
}

/** Handle auto-shake toggle click. Returns true if handled. */
export function handleAutoShakeToggle(vx: number, vy: number): boolean {
  if (!isClickOnAutoShake(vx, vy)) return false;
  setAutoShakeMobile(!getAutoShakeMobile());
  return true;
}

/** Check if a click is in the backdrop area (below panel, used to dismiss). */
export function isClickOnBackdrop(vy: number): boolean {
  if (ds.progress < 0.5) return false;
  return vy > NAV_H + PANEL_H * ds.progress;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function drawDropdown(
  ctx: CanvasRenderingContext2D,
  score: number,
  highScore: number,
  level: number,
  pointsLeft: number,
): void {
  if (ds.progress <= 0) return;

  const w = VIRTUAL_WIDTH;
  // Backdrop (dims game behind)
  ctx.save();
  ctx.fillStyle = `rgba(6, 8, 12, ${0.5 * ds.progress})`;
  ctx.fillRect(0, NAV_H, w, 2000);
  ctx.restore();

  // Panel background (slides down from nav)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, NAV_H, w, PANEL_H * ds.progress);
  ctx.clip();

  // Background
  ctx.fillStyle = '#0c1018';
  ctx.fillRect(0, NAV_H, w, PANEL_H);

  // Bottom edge line
  ctx.strokeStyle = 'rgba(232, 196, 74, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, NAV_H + PANEL_H);
  ctx.lineTo(w, NAV_H + PANEL_H);
  ctx.stroke();

  // -- Stats rows --
  ctx.textBaseline = 'middle';
  const rowH = 28;
  const labelX = 30;
  const valueX = w - 30;
  let rowY = NAV_H + 22;

  const rows = [
    { label: 'SCORE', value: score.toLocaleString(), color: '#e8c44a' },
    { label: 'HIGH SCORE', value: highScore.toLocaleString(), color: '#FBBF24' },
    { label: 'LEVEL', value: String(level), color: '#7dd3fc' },
    { label: 'NEXT LEVEL', value: pointsLeft > 0 ? `${pointsLeft.toLocaleString()} pts` : 'MAX', color: '#7dd3fc' },
  ];

  for (const row of rows) {
    // Label
    ctx.font = `bold 11px monospace`;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, labelX, rowY);

    // Value
    ctx.font = `bold 14px monospace`;
    ctx.fillStyle = row.color;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, valueX, rowY);

    rowY += rowH;
  }

  // -- Auto-shake toggle (mobile only) --
  if (IS_MOBILE) {
    const btnR = 8;
    const isAuto = getAutoShakeMobile();
    ctx.beginPath();
    ctx.roundRect(BTN_X, TOGGLE_Y, BTN_W, BTN_H, btnR);
    ctx.fillStyle = isAuto ? 'rgba(80, 200, 120, 0.15)' : 'rgba(100, 120, 150, 0.1)';
    ctx.fill();
    ctx.strokeStyle = isAuto ? 'rgba(80, 200, 120, 0.4)' : 'rgba(100, 120, 150, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold ${IS_PORTRAIT ? 13 : 11}px monospace`;
    ctx.fillStyle = isAuto ? '#4ade80' : '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`AUTO-SHAKE: ${isAuto ? 'ON' : 'OFF'}`, VIRTUAL_WIDTH / 2, TOGGLE_Y + BTN_H / 2);
  }

  // -- Restart button --
  {
    const btnR = 8;
    ctx.beginPath();
    ctx.roundRect(BTN_X, RESTART_BTN_Y, BTN_W, BTN_H, btnR);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold ${IS_PORTRAIT ? 15 : 13}px monospace`;
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RESTART GAME', VIRTUAL_WIDTH / 2, RESTART_BTN_Y + BTN_H / 2);
  }

  ctx.restore(); // remove clip
}
