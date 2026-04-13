// ---------------------------------------------------------------------------
// Top-nav dropdown menu — slides down from nav bar, pauses game
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, IS_PORTRAIT } from '../canvas';
import { getAutoShakeMobile, setAutoShakeMobile, ensureMotionPermission, getMotionDebug } from './levelShake';
import { getActiveUpgrades } from './shop';
import { getFireMode, setFireMode } from './input';

const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NAV_H = 40;
const UPGRADE_ROW_H = 16;
const ANIM_DUR = 0.25;

const BTN_W = IS_PORTRAIT ? 200 : 180;
const BTN_H = IS_PORTRAIT ? 44 : 38;
const BTN_X = (VIRTUAL_WIDTH - BTN_W) / 2;

/** Compute total panel height based on content. */
function getPanelH(): number {
  const ups = getActiveUpgrades();
  // Stats rows: 4 rows × 28px + top padding
  let h = 22 + 4 * 28;
  // Upgrade card if any
  if (ups.length > 0) {
    h += 14; // gap before card
    h += 24 + ups.length * UPGRADE_ROW_H + 10; // card content
    h += 20; // gap after card
  }
  // Toggle buttons (mobile): auto-shake + fire mode (plus motion status line when auto-shake is off)
  if (IS_MOBILE) {
    h += (BTN_H + 10) * 2 + 6;
    if (!getAutoShakeMobile()) h += 18; // inline motion status line
  }
  // Restart button
  h += BTN_H + 20;
  return h;
}

/** These are computed during draw since they depend on content flow. */
let _toggleY = 0;
let _fireModeY = 0;
let _restartBtnY = 0;
function getRestartBtnY(): number { return _restartBtnY; }
function getToggleY(): number { return _toggleY; }


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
    vy >= getRestartBtnY() && vy <= getRestartBtnY() + BTN_H;
}

/** Check if a click hits the auto-shake toggle (mobile only). */
export function isClickOnAutoShake(vx: number, vy: number): boolean {
  if (!IS_MOBILE || ds.progress < 0.9) return false;
  return vx >= BTN_X && vx <= BTN_X + BTN_W &&
    vy >= getToggleY() && vy <= getToggleY() + BTN_H;
}

/** Handle auto-shake toggle click. Returns true if handled. */
export function handleAutoShakeToggle(vx: number, vy: number): boolean {
  if (!isClickOnAutoShake(vx, vy)) return false;
  // Any tap on the shake toggle = user engagement with motion settings.
  // Request permission eagerly — this runs in user-gesture context (touchend),
  // which iOS requires. No-op if already granted or unsupported.
  ensureMotionPermission();
  setAutoShakeMobile(!getAutoShakeMobile());
  return true;
}

/** Check if click hits the fire mode toggle. */
export function isClickOnFireMode(vx: number, vy: number): boolean {
  if (!IS_MOBILE || ds.progress < 0.9) return false;
  return vx >= BTN_X && vx <= BTN_X + BTN_W &&
    vy >= _fireModeY && vy <= _fireModeY + BTN_H;
}

/** Handle fire mode toggle click. Returns true if handled. */
export function handleFireModeToggle(vx: number, vy: number): boolean {
  if (!isClickOnFireMode(vx, vy)) return false;
  setFireMode(getFireMode() === 'multitap' ? 'holdrelease' : 'multitap');
  return true;
}

/** Check if a click is in the backdrop area (below panel, used to dismiss). */
export function isClickOnBackdrop(vy: number): boolean {
  if (ds.progress < 0.5) return false;
  return vy > NAV_H + getPanelH() * ds.progress;
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
  ctx.rect(0, NAV_H, w, getPanelH() * ds.progress);
  ctx.clip();

  // Background
  ctx.fillStyle = '#0c1018';
  ctx.fillRect(0, NAV_H, w, getPanelH());

  // Bottom edge line
  ctx.strokeStyle = 'rgba(232, 196, 74, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, NAV_H + getPanelH());
  ctx.lineTo(w, NAV_H + getPanelH());
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

  // -- Active upgrades section (card-style panel) --
  const upgrades = getActiveUpgrades();
  if (upgrades.length > 0) {
    rowY += 14;

    const cardX = labelX - 10;
    const cardW = valueX - labelX + 20;
    const cardPadTop = 24;
    const cardPadBot = 10;
    const cardH = cardPadTop + upgrades.length * UPGRADE_ROW_H + cardPadBot;
    const cardR = 10;

    // Card background
    ctx.beginPath();
    ctx.roundRect(cardX, rowY, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(20, 28, 42, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 140, 200, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Header
    ctx.font = `bold 9px monospace`;
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('UPGRADES', labelX, rowY + 14);

    // Upgrade rows inside the card
    let upY = rowY + cardPadTop + 4;
    for (const up of upgrades) {
      ctx.font = `10px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(up.name, labelX, upY);

      ctx.font = `bold 10px monospace`;
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'right';
      ctx.fillText(up.value, valueX, upY);

      upY += UPGRADE_ROW_H;
    }

    rowY += cardH + 10;
  }

  // -- Shake settings group (mobile only) — auto-shake toggle + motion status --
  if (IS_MOBILE) {
    rowY += 6;
    _toggleY = rowY;
    const btnR = 8;
    const isAuto = getAutoShakeMobile();
    ctx.beginPath();
    ctx.roundRect(BTN_X, rowY, BTN_W, BTN_H, btnR);
    ctx.fillStyle = isAuto ? 'rgba(80, 200, 120, 0.15)' : 'rgba(100, 120, 150, 0.1)';
    ctx.fill();
    ctx.strokeStyle = isAuto ? 'rgba(80, 200, 120, 0.4)' : 'rgba(100, 120, 150, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold ${IS_PORTRAIT ? 13 : 11}px monospace`;
    ctx.fillStyle = isAuto ? '#4ade80' : '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`AUTO-SHAKE: ${isAuto ? 'ON' : 'OFF'}`, VIRTUAL_WIDTH / 2, rowY + BTN_H / 2);
    rowY += BTN_H + 4;

    // Motion status line (only when auto-shake is OFF and motion matters)
    if (!isAuto) {
      const d = getMotionDebug();
      let label: string;
      let color: string;
      if (d.status === 'unsupported') { label = 'motion sensor unavailable'; color = '#888'; }
      else if (d.status === 'awaiting-permission' || d.status === 'gesture-required') {
        label = 'tap AUTO-SHAKE to prompt for motion'; color = '#e8c44a';
      }
      else if (d.status === 'permission-denied') { label = 'motion denied — clear Safari website data'; color = '#f87171'; }
      else if (d.status === 'insecure-context' && d.events === 0) { label = 'motion needs HTTPS (try GitHub Pages build)'; color = '#f87171'; }
      else if (d.events === 0) { label = 'motion listener attached but no events'; color = '#f87171'; }
      else { label = `motion ✓  peak ${d.peak.toFixed(1)}  ${d.events} events`; color = '#4ade80'; }

      ctx.font = `${IS_PORTRAIT ? 10 : 9}px monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, VIRTUAL_WIDTH / 2, rowY + 8);
      rowY += 18;
    }

    rowY += 10;

    // -- Fire mode toggle (mobile only) — unrelated to shake, separate row --
    _fireModeY = rowY;
    const isHold = getFireMode() === 'holdrelease';
    ctx.beginPath();
    ctx.roundRect(BTN_X, rowY, BTN_W, BTN_H, btnR);
    ctx.fillStyle = isHold ? 'rgba(100, 140, 220, 0.15)' : 'rgba(100, 120, 150, 0.1)';
    ctx.fill();
    ctx.strokeStyle = isHold ? 'rgba(100, 140, 220, 0.4)' : 'rgba(100, 120, 150, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold ${IS_PORTRAIT ? 12 : 10}px monospace`;
    ctx.fillStyle = isHold ? '#7dd3fc' : '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`FIRE: ${isHold ? 'HOLD & RELEASE' : 'MULTI-TAP'}`, VIRTUAL_WIDTH / 2, rowY + BTN_H / 2);
    rowY += BTN_H + 10;
  }

  // -- Restart button — always last --
  {
    rowY += 4;
    _restartBtnY = rowY;
    const btnR = 8;
    ctx.beginPath();
    ctx.roundRect(BTN_X, rowY, BTN_W, BTN_H, btnR);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold ${IS_PORTRAIT ? 15 : 13}px monospace`;
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RESTART GAME', VIRTUAL_WIDTH / 2, rowY + BTN_H / 2);
  }

  ctx.restore(); // remove clip
}
