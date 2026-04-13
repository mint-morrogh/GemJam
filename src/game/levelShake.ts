// ---------------------------------------------------------------------------
// Level system + shake interlude
// ---------------------------------------------------------------------------
// Score thresholds trigger "Level Complete!" → shake countdown → shake phase.
// Mobile: player shakes their phone to jostle gems for bonus merges.
// PC: automatic random shaking applied to the physics world.

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import { initShake, requestShakePermission, getShakeInfo, resetShakePeak } from './shakeDetector';

// ---------------------------------------------------------------------------
// Level thresholds — each level costs 1.4x more than the last
// ---------------------------------------------------------------------------

const BASE_POINTS = 6000;
const SCALE_FACTOR = 1.3;

/** Get cumulative score needed to reach the given level (1-indexed). */
function thresholdForLevel(level: number): number {
  // Level 1→2 costs BASE_POINTS, level 2→3 costs BASE_POINTS*1.4, etc.
  let total = 0;
  let cost = BASE_POINTS;
  for (let i = 1; i < level; i++) {
    total += Math.round(cost);
    cost *= SCALE_FACTOR;
  }
  return total;
}

/** Points remaining to reach the next level from the current score. */
export function pointsToNextLevel(score: number, level: number): number {
  return Math.max(0, thresholdForLevel(level + 1) - score);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ShakePhase =
  | 'playing'       // normal gameplay
  | 'level_banner'  // "Level Complete!" banner (1.2s)
  | 'countdown'     // "3... 2... 1..." (3s)
  | 'shaking'       // shake phase (1s)
  | 'settling'      // physics runs, gems settle after shake (2s)
  | 'shop'          // shop modal (blocks until user closes)
  | 'resume';       // brief "Level X" flash (0.5s)

interface LevelState {
  level: number;
  phase: ShakePhase;
  phaseTimer: number;
  countdownNum: number; // 3, 2, 1
  /** Accumulated device motion magnitude during shake (mobile). */
  shakeScore: number;
}

const ls: LevelState = {
  level: 1,
  phase: 'playing',
  phaseTimer: 0,
  countdownNum: 3,
  shakeScore: 0,
};

const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------------------
// Device motion listener (mobile shake detection)
// ---------------------------------------------------------------------------

/** User preference: use auto-shake on mobile instead of device motion. */
let autoShakeMobile = (() => {
  try { return localStorage.getItem('gemjam_autoshake') === '1'; } catch { return false; }
})();

export function getAutoShakeMobile(): boolean { return autoShakeMobile; }
export function setAutoShakeMobile(v: boolean): void {
  autoShakeMobile = v;
  try { localStorage.setItem('gemjam_autoshake', v ? '1' : '0'); } catch { /* */ }
  // When user turns auto-shake OFF, they want device motion — make sure permission
  // is granted. This runs from a tap handler (user gesture), which iOS requires.
  if (!v) requestShakePermission();
}

/** Debug readout for HUD. Re-exports shake detector info. */
export function getMotionDebug(): { attached: boolean; events: number; peak: number; current: number; status: string; raw: number } {
  const s = getShakeInfo();
  return {
    attached: s.status === 'listening',
    events: s.eventCount,
    peak: s.peakDelta,
    current: s.currentDelta,
    status: s.status,
    raw: s.rawMagnitude,
  };
}

/** Start listening for device motion (call once at init). */
export function initShakeDetection(): void {
  initShake();
}

/** Request iOS motion permission (must be called from a user gesture). */
export const ensureMotionPermission = requestShakePermission;
export const requestMotionPermission = requestShakePermission;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCurrentLevel(): number { return ls.level; }
export function getShakePhase(): ShakePhase { return ls.phase; }

/** Returns 0→1 for how closed the lid is (0=open, 1=sealed). */
export function getLidProgress(): number {
  switch (ls.phase) {
    case 'countdown': return Math.min(1, ls.phaseTimer / 1.0); // seals during first second of countdown
    case 'shaking': return 1;
    case 'settling': return 1;
    case 'resume': return Math.max(0, 1 - ls.phaseTimer / 0.3); // opens during resume
    default: return 0;
  }
}

/** Check if a level-up should trigger based on the current score. */
export function checkLevelUp(score: number): boolean {
  if (ls.phase !== 'playing') return false;
  const threshold = thresholdForLevel(ls.level + 1);
  if (score >= threshold) {
    ls.phase = 'level_banner';
    ls.phaseTimer = 0;
    return true;
  }
  return false;
}

/**
 * Get gravity override during shake phase.
 * Returns {gx, gy} in m/s² to set on the world, or null for default gravity.
 * Shaking works by rapidly oscillating gravity direction — the "container shakes"
 * rather than pushing individual bodies.
 */
// Random shake direction that changes every few frames for chaotic jolts
let shakeDir = { x: 0, y: 0 };
let shakeDirTimer = 0;

export function getShakeGravity(): { gx: number; gy: number } | null {
  if (ls.phase !== 'shaking') return null;

  const useAutoShake = !IS_MOBILE || autoShakeMobile;

  if (useAutoShake) {
    // Auto-shake: random gravity oscillation every 50-120ms for chaotic jolts
    shakeDirTimer -= 1 / 60;
    if (shakeDirTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const strength = 60 + Math.random() * 50; // 60-110 m/s²
      shakeDir = { x: Math.cos(angle) * strength, y: Math.sin(angle) * strength };
      shakeDirTimer = 0.05 + Math.random() * 0.07;
    }
    return {
      gx: shakeDir.x + (Math.random() - 0.5) * 20,
      gy: shakeDir.y + (Math.random() - 0.5) * 20,
    };
  }

  // Mobile with auto-shake OFF: only device motion drives gravity
  const info = getShakeInfo();
  if (info.shakeLevel > 0.05) {
    ls.shakeScore += info.shakeLevel;
    const strength = info.shakeLevel * 120; // 0..120 m/s²
    const angle = Math.random() * Math.PI * 2;
    return {
      gx: Math.cos(angle) * strength + (Math.random() - 0.5) * 15,
      gy: Math.sin(angle) * strength + (Math.random() - 0.5) * 15,
    };
  }

  // No device motion — normal downward gravity (gems just sit there)
  return { gx: 0, gy: 25 };
}

/** Update the level interlude state machine. Returns true if gameplay is blocked. */
export function updateLevelShake(dt: number): boolean {
  if (ls.phase === 'playing') return false;

  ls.phaseTimer += dt;

  switch (ls.phase) {
    case 'level_banner':
      if (ls.phaseTimer >= 2.5) {
        ls.phase = 'countdown';
        ls.phaseTimer = 0;
        ls.countdownNum = 3;
        ls.shakeScore = 0;
      }
      return false; // physics keeps running so gems settle

    case 'countdown':
      ls.countdownNum = 3 - Math.floor(ls.phaseTimer);
      if (ls.phaseTimer >= 3) {
        ls.phase = 'shaking';
        ls.phaseTimer = 0;
        resetShakePeak(); // fresh peak readout per shake phase
      }
      return true;

    case 'shaking':
      if (ls.phaseTimer >= 1.0) {
        ls.phase = 'settling';
        ls.phaseTimer = 0;
      }
      return false; // physics runs during shake!

    case 'settling':
      // Let gems settle after shaking — physics runs, no level check
      if (ls.phaseTimer >= 5.0) {
        ls.phase = 'shop';
        ls.phaseTimer = 0;
      }
      return false; // physics runs during settle!

    case 'shop':
      // Blocked until shop is closed externally via closeShopPhase()
      return true;

    case 'resume':
      if (ls.phaseTimer >= 0.5) {
        ls.level++;
        ls.phase = 'playing';
        ls.phaseTimer = 0;
      }
      return true;
  }

  return false;
}

/** Reset for new game. */
export function resetLevelShake(): void {
  ls.level = 1;
  ls.phase = 'playing';
  ls.phaseTimer = 0;
  ls.countdownNum = 3;
  ls.shakeScore = 0;
}

/** Set the current level (used when restoring from save). */
export function setLevel(level: number): void {
  ls.level = level;
}

/** Transition from shop → resume (called when user closes the shop). */
export function closeShopPhase(): void {
  if (ls.phase === 'shop') {
    ls.phase = 'resume';
    ls.phaseTimer = 0;
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function drawLevelOverlay(ctx: CanvasRenderingContext2D, _time?: number): void {
  if (ls.phase === 'playing' || ls.phase === 'settling' || ls.phase === 'shop') return;

  const cx = VIRTUAL_WIDTH / 2;
  const cy = VIRTUAL_HEIGHT / 2;

  // Semi-transparent backdrop (lighter than game-over)
  if (ls.phase !== 'shaking') {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 12, 0.6)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (ls.phase) {
    case 'level_banner': {
      const t = ls.phaseTimer;
      // Phase 1 (0-0.4s): pop in big
      // Phase 2 (0.4-1.8s): hold at normal size
      // Phase 3 (1.8-2.5s): shrink and fade out
      let scale: number;
      let alpha: number;
      if (t < 0.4) {
        // Pop in: overshoot then settle
        const p = t / 0.4;
        scale = 0.3 + 1.2 * p - 0.5 * p * p; // peaks at ~1.15 then settles to 1.0
        alpha = Math.min(1, p * 2);
      } else if (t < 1.8) {
        scale = 1;
        alpha = 1;
      } else {
        // Shrink out
        const p = (t - 1.8) / 0.7;
        scale = 1 - p * 0.6;
        alpha = 1 - p;
      }

      ctx.globalAlpha = Math.max(0, alpha);

      // "LEVEL COMPLETE!" — scales with the animation
      const titleSize = Math.round((IS_PORTRAIT ? 24 : 20) * scale);
      ctx.font = `bold ${titleSize}px monospace`;
      ctx.fillStyle = '#e8c44a';
      ctx.save();
      ctx.shadowColor = '#e8c44a';
      ctx.shadowBlur = 15 * scale;
      ctx.fillText('LEVEL COMPLETE!', cx, cy - 25 * scale);
      ctx.restore();
      ctx.globalAlpha = Math.max(0, alpha);

      // Level number — bigger
      const numSize = Math.round((IS_PORTRAIT ? 52 : 44) * scale);
      ctx.font = `bold ${numSize}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Level ${ls.level}`, cx, cy + 20 * scale);

      break;
    }

    case 'countdown': {
      // Instruction + countdown number
      ctx.font = `bold ${IS_PORTRAIT ? 16 : 14}px monospace`;
      ctx.fillStyle = '#e8c44a';
      ctx.fillText(
        IS_MOBILE ? 'Get ready to SHAKE!' : 'Get ready for the shakedown!',
        cx, cy - 50,
      );

      // Big countdown number
      const num = Math.max(1, ls.countdownNum);
      const numScale = 1 + 0.3 * Math.sin(ls.phaseTimer * 8);
      ctx.font = `bold ${Math.round((IS_PORTRAIT ? 72 : 60) * numScale)}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(num), cx, cy + 20);

      break;
    }

    case 'shaking': {
      const t = ls.phaseTimer;
      const progress = 1 - t / 1.0;

      // --- Light beams radiating from center (anime speed lines) ---
      const beamCount = 16;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 3); // slow rotation
      for (let b = 0; b < beamCount; b++) {
        const angle = (Math.PI * 2 * b) / beamCount;
        const beamAlpha = 0.12 + 0.08 * Math.sin(t * 20 + b * 2);
        const beamLen = Math.max(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        const beamW = 15 + 10 * Math.sin(t * 12 + b);

        ctx.save();
        ctx.rotate(angle);
        ctx.globalAlpha = beamAlpha;
        const grad = ctx.createLinearGradient(0, 0, beamLen, 0);
        grad.addColorStop(0, '#e8c44a');
        grad.addColorStop(0.3, '#FF6B2D');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, -beamW / 2, beamLen, beamW);
        ctx.restore();
      }
      ctx.restore();

      // --- Vignette flash (pulsing bright edges) ---
      const flashAlpha = 0.15 + 0.1 * Math.sin(t * 25);
      const vGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, VIRTUAL_HEIGHT * 0.7);
      vGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
      vGrad.addColorStop(1, '#e8c44a');
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.restore();

      // --- "SHAKE!" text with heavy jitter ---
      const pulse = 0.8 + 0.2 * Math.sin(t * 20);
      ctx.globalAlpha = pulse;
      const fontSize = IS_PORTRAIT ? 56 : 46;
      ctx.font = `bold ${fontSize}px monospace`;

      // Text shadow / glow
      const jx = (Math.random() - 0.5) * 12;
      const jy = (Math.random() - 0.5) * 12;
      ctx.save();
      ctx.shadowColor = '#FF6B2D';
      ctx.shadowBlur = 20 + Math.random() * 15;
      ctx.fillStyle = '#e8c44a';
      ctx.fillText(IS_MOBILE ? 'SHAKE!' : 'SHAKEDOWN!', cx + jx, cy + jy);
      ctx.restore();

      // Second layer — white core text
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(IS_MOBILE ? 'SHAKE!' : 'SHAKEDOWN!', cx + jx, cy + jy);
      ctx.restore();

      // --- Timer bar ---
      const barW = VIRTUAL_WIDTH * 0.6;
      const barH = 10;
      const barX = cx - barW / 2;
      const barY = cy + 55;
      const barR = 5;

      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, barR);
      ctx.fillStyle = '#1a2030';
      ctx.fill();

      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * progress, barH, barR);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      barGrad.addColorStop(0, '#FF6B2D');
      barGrad.addColorStop(1, '#e8c44a');
      ctx.fillStyle = barGrad;
      ctx.fill();

      // --- Motion debug readout (mobile + auto-shake OFF only) ---
      if (IS_MOBILE && !autoShakeMobile) {
        const d = getMotionDebug();
        ctx.globalAlpha = 0.95;
        ctx.font = `bold 11px monospace`;
        const good = d.attached && d.events > 0;
        ctx.fillStyle = good ? '#6bff9a' : '#ff6b6b';
        let status: string;
        if (d.status === 'unsupported') status = 'MOTION: device does not support accelerometer';
        else if (d.status === 'awaiting-permission') status = 'MOTION: tap screen to enable';
        else if (d.status === 'permission-denied') status = 'MOTION: permission denied — check Safari settings';
        else if (d.status === 'insecure-context') status = 'MOTION BLOCKED: HTTPS required (use tunnel)';
        else if (!d.attached) status = 'MOTION: not attached';
        else if (d.events === 0) status = `MOTION: listener attached but no events (check HTTPS)`;
        else status = `MOTION ✓ delta ${d.current.toFixed(1)}  peak ${d.peak.toFixed(1)}  ${d.events}evt`;
        ctx.fillText(status, cx, barY + barH + 18);
      }

      break;
    }

    case 'resume': {
      const fadeAlpha = 1 - ls.phaseTimer / 0.3;
      ctx.globalAlpha = fadeAlpha;
      ctx.font = `bold ${IS_PORTRAIT ? 28 : 24}px monospace`;
      ctx.fillStyle = '#e8c44a';
      ctx.fillText(`Level ${ls.level + 1}`, cx, cy);
      break;
    }
  }

  ctx.restore();
}
