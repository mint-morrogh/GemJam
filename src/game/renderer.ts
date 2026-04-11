import { bodyPos, bodyAngle, bodyId, type Body } from '../physics/planckWorld';
import { GRID, GEM_TIERS, nearestDropZone } from './gems';
import type { GemDef } from './gems';
import type { PlacedGem } from './state';
import type { ScoringState, ScoreEntry } from './scoring';
import { getGemData } from './gemSpawner';
import { getDraggedGem } from './touchDrag';
import { glowRadiusScale, shadowOffsetScale, glowAlphaScale, getQualityPreset } from './renderConfig';
import { getSettings } from './settings';
import { getGemSprite, getRainbowGemSprite } from './gemSprites';
import { getShimmers } from './particles';

// ---------------------------------------------------------------------------
// Responsive font sizing — canvas equivalent of CSS clamp(min, preferred, max)
// ---------------------------------------------------------------------------

/**
 * Fluid font size for canvas — analogous to CSS clamp(min, preferred, max).
 * In landscape, returns the authored `preferred` size unchanged.
 * In portrait, scales by 1.3× with a floor of `min`, ensuring readability
 * on screens as narrow as 320px (minimum ~10px real pixel size).
 */
function fontClamp(min: number, preferred: number, max: number): number {
  if (!IS_PORTRAIT) return preferred;
  return Math.round(Math.max(min, Math.min(preferred * 1.3, max)));
}

// Pre-computed responsive sizes (portrait values in comments)
const F_VALUE    = fontClamp(20, 20, 28);  // high score display
const F_HEADING  = fontClamp(20, 22, 30);  // "NEW HIGH SCORE"
const F_SCORE_LG = fontClamp(28, 36, 46);  // game over score
const F_TITLE    = fontClamp(48, 64, 72);  // "GAME OVER"
const F_BTN      = fontClamp(22, 28, 36);  // button text

// Touch-target-safe button dimensions (minimum 44px real on 320px screens)
const BTN_W = IS_PORTRAIT ? 260 : 220;
const BTN_H = IS_PORTRAIT ? 76 : 56;

// ---------------------------------------------------------------------------
// Top nav bar layout
// ---------------------------------------------------------------------------

const TOP_NAV_H = 40;

// ---------------------------------------------------------------------------
// Bottom next-gem strip layout
// ---------------------------------------------------------------------------

const BOTTOM_STRIP_H = 55;
const BOTTOM_STRIP_Y = IS_PORTRAIT
  ? GRID.containerY + GRID.containerHeight + 10
  : GRID.containerY + GRID.containerHeight + 8;
const BOTTOM_STRIP_X = GRID.containerX;
const BOTTOM_STRIP_W = GRID.containerWidth;
/** Horizontal spacing between gem centers in the bottom strip. */
const GEM_SLOT_SPACING = IS_PORTRAIT ? 70 : 65;
const GEM_SLOT_COUNT = 4;

// ---------------------------------------------------------------------------
// Board styling — dark arcade palette (BookBreaker-inspired)
// ---------------------------------------------------------------------------

const BG_DEEP = '#080a12';
const BG_MID = '#0c1018';
const ACCENT_GOLD = '#e8c44a';
/** Top corners: subtle rounding. Bottom corners: large curve so gems slide inward. */
const BUCKET_TOP_R = 8;
const BUCKET_BOT_R = 45;

/**
 * Draw the game board: viewport background gradient + glass bucket container.
 * The bucket uses translucent fills, specular wall highlights, rim lighting,
 * and caustic corner glows to simulate a dark-tinted glass vessel.
 */
export function drawBoard(ctx: CanvasRenderingContext2D): void {
  const { containerX: x, containerY: y, containerWidth: w, containerHeight: h } = GRID;

  // -- Full viewport background gradient ------------------------------------
  const bgGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  bgGrad.addColorStop(0, BG_DEEP);
  bgGrad.addColorStop(0.35, BG_MID);
  bgGrad.addColorStop(1, BG_DEEP);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const R4 = [BUCKET_TOP_R, BUCKET_TOP_R, BUCKET_BOT_R, BUCKET_BOT_R] as const;

  // -- Outer glow (soft diffuse halo) ---------------------------------------
  ctx.save();
  ctx.shadowColor = 'rgba(100, 160, 220, 0.06)';
  ctx.shadowBlur = 50;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, R4);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.4)';
  ctx.fill();
  ctx.restore();

  // -- Glass interior (barely-there blue tint) ------------------------------
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, R4);
  ctx.fillStyle = 'rgba(60, 100, 160, 0.02)';
  ctx.fill();

  // == Clipped interior effects ================================================
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, R4);
  ctx.clip();

  // -- Left edge specular line ------------------------------------------------
  const edgeGrad = ctx.createLinearGradient(x, y + h * 0.1, x, y + h * 0.7);
  edgeGrad.addColorStop(0, 'rgba(220, 240, 255, 0)');
  edgeGrad.addColorStop(0.15, 'rgba(220, 240, 255, 0.15)');
  edgeGrad.addColorStop(0.5, 'rgba(220, 240, 255, 0.1)');
  edgeGrad.addColorStop(1, 'rgba(220, 240, 255, 0)');
  ctx.strokeStyle = edgeGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h * 0.08);
  ctx.lineTo(x + 1, y + h * 0.72);
  ctx.stroke();

  // -- Right edge specular line (fainter) -------------------------------------
  const edgeGradR = ctx.createLinearGradient(x, y + h * 0.15, x, y + h * 0.6);
  edgeGradR.addColorStop(0, 'rgba(200, 225, 250, 0)');
  edgeGradR.addColorStop(0.2, 'rgba(200, 225, 250, 0.06)');
  edgeGradR.addColorStop(0.5, 'rgba(200, 225, 250, 0.04)');
  edgeGradR.addColorStop(1, 'rgba(200, 225, 250, 0)');
  ctx.strokeStyle = edgeGradR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w - 1, y + h * 0.12);
  ctx.lineTo(x + w - 1, y + h * 0.62);
  ctx.stroke();

  // -- Interior floor vignette (soft darkening at base) -----------------------
  const floorDark = ctx.createLinearGradient(x, y + h - 80, x, y + h);
  floorDark.addColorStop(0, 'rgba(0, 0, 0, 0)');
  floorDark.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = floorDark;
  ctx.fillRect(x, y + h - 80, w, 80);

  ctx.restore(); // remove clip

  // -- Outer border (single clean line) -------------------------------------
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, R4);
  ctx.strokeStyle = 'rgba(140, 180, 230, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // -- Inner highlight stroke (glass thickness) -----------------------------
  const R4i = [
    Math.max(0, BUCKET_TOP_R - 2), Math.max(0, BUCKET_TOP_R - 2),
    Math.max(0, BUCKET_BOT_R - 2), Math.max(0, BUCKET_BOT_R - 2),
  ];
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, R4i);
  ctx.strokeStyle = 'rgba(120, 170, 225, 0.04)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Launcher gem + trajectory line (Peggle-style aiming)
// ---------------------------------------------------------------------------

import type { TrajectoryPoint } from './launcher';

/**
 * Draw the next gem sitting at the launch point (always visible).
 * Shows the player what gem they're about to fire.
 */
export function drawLauncherGem(
  ctx: CanvasRenderingContext2D,
  launchX: number,
  launchY: number,
  gemDef: GemDef,
  time: number,
  heavy = false,
  bonus = false,
  blackhole = false,
): void {
  const actualR = gemDef.radius;
  // Display at actual physics size — gems range from 14 to 22 for spawnable tiers
  const displayR = actualR;

  // Bonus gem: golden aura
  if (bonus) drawBonusAura(ctx, launchX, launchY, displayR, time, 1);

  // Pulsing glow ring
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.save();
  ctx.beginPath();
  ctx.arc(launchX, launchY, displayR + 6 + pulse * 3, 0, Math.PI * 2);
  ctx.strokeStyle = gemDef.color;
  ctx.globalAlpha = 0.15 + 0.1 * pulse;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Dashed circle showing exact physics size (so player can judge how big it'll be)
  ctx.save();
  ctx.beginPath();
  ctx.arc(launchX, launchY, actualR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Gem sprite or circle fallback — drawn at display size
  ctx.save();
  const sprite = getGemSprite(gemDef.id);
  if (sprite) {
    ctx.beginPath();
    ctx.arc(launchX, launchY, displayR, 0, Math.PI * 2);
    ctx.clip();
    const size = displayR * 2;
    ctx.drawImage(sprite, launchX - displayR, launchY - displayR, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(launchX, launchY, displayR, 0, Math.PI * 2);
    ctx.fillStyle = gemDef.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Heavy gem: just a dark overlay, no text
  if (heavy) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(launchX, launchY, displayR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blackhole: dark purple swirling aura
  if (blackhole) {
    const bhPulse = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * bhPulse;
    const bhGrad = ctx.createRadialGradient(launchX, launchY, displayR * 0.3, launchX, launchY, displayR + 10);
    bhGrad.addColorStop(0, '#1a0030');
    bhGrad.addColorStop(0.5, '#6B21A8');
    bhGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bhGrad;
    ctx.beginPath();
    ctx.arc(launchX, launchY, displayR + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${IS_PORTRAIT ? 10 : 9}px monospace`;
    ctx.fillStyle = '#C084FC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLACK HOLE', launchX, launchY);
    ctx.restore();
  }

  // Tier label below the gem
  ctx.font = `bold ${IS_PORTRAIT ? 11 : 10}px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gemDef.type, launchX, launchY + displayR + 4);
  ctx.restore();
}

/**
 * Draw the animated trajectory line showing the predicted gem path.
 * Dashed line with marching animation, fading toward the tail.
 */
export function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  points: readonly TrajectoryPoint[],
  time: number,
  _gemColor?: string,
  _gemRadius?: number,
): void {
  if (points.length < 2) return;

  ctx.save();

  // Animated dash pattern (marching ants)
  const dashLen = 8;
  const gapLen = 6;
  const speed = 50; // px/s dash animation speed
  ctx.setLineDash([dashLen, gapLen]);
  ctx.lineDashOffset = -(time * speed) % (dashLen + gapLen);

  // Draw trajectory fading out gradually — fully gone by ~35% of total length
  const cutoff = Math.floor(points.length * 0.35);
  if (cutoff < 2) { ctx.restore(); return; }

  const BATCHES = 10;
  const batchSize = Math.max(1, Math.floor(cutoff / BATCHES));
  for (let b = 0; b < BATCHES; b++) {
    const start = b * batchSize;
    const end = Math.min(start + batchSize, cutoff);
    if (start >= end) break;
    const t = b / BATCHES; // 0 → 1 over the visible portion
    const alpha = 0.45 * (1 - t); // linear fade from 0.45 → 0
    const width = 2.5 - t * 1.2;  // 2.5 → 1.3
    if (alpha < 0.01) break;

    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    for (let i = start + 1; i <= end; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}


// ---------------------------------------------------------------------------
// Next-gem queue shift animation (horizontal, slides left)
// ---------------------------------------------------------------------------

const QUEUE_SHIFT_DURATION = 0.3;

interface QueueShiftAnim {
  active: boolean;
  progress: number;
  exitingGem: GemDef | null;
}

const queueAnim: QueueShiftAnim = { active: false, progress: 0, exitingGem: null };

/** Trigger the visual queue shift after firing a gem. */
export function triggerQueueShift(exitingGem: GemDef): void {
  queueAnim.active = true;
  queueAnim.progress = 0;
  queueAnim.exitingGem = exitingGem;
}

/** Reset the queue animation (e.g. on game restart). */
export function resetQueueAnimation(): void {
  queueAnim.active = false;
  queueAnim.progress = 0;
  queueAnim.exitingGem = null;
}

/** Advance queue shift animation each update tick. */
export function updateQueueAnimation(dt: number): void {
  if (!queueAnim.active) return;
  queueAnim.progress += dt / QUEUE_SHIFT_DURATION;
  if (queueAnim.progress >= 1) {
    queueAnim.progress = 1;
    queueAnim.active = false;
    queueAnim.exitingGem = null;
  }
}

// ---------------------------------------------------------------------------
// Bottom next-gem strip (horizontal row below bucket)
// ---------------------------------------------------------------------------

/** Draw a single gem in the bottom strip with optional glow ring. */
function drawStripGem(
  ctx: CanvasRenderingContext2D,
  gem: GemDef,
  cx: number,
  cy: number,
  scale: number,
  alpha: number,
  showRing: boolean,
): void {
  const maxR = 20;
  const r = Math.min(gem.radius, maxR) * scale;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Glow ring behind the first gem
  if (showRing) {
    const ringGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.8);
    ringGrad.addColorStop(0, gem.color);
    ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Gem sprite or fallback circle
  const sprite = getGemSprite(gem.id);
  if (sprite) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sprite, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gem.color;
    ctx.fill();
  }

  // Thin border ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.15 * alpha).toFixed(2)})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw the polished "NEXT" strip below the bucket.
 * Glass-style background, gems with glow, arrow flow indicators.
 */
export function drawNextGemPanel(ctx: CanvasRenderingContext2D, queue: readonly { def: GemDef; heavy: boolean; bonus: boolean; blackhole: boolean }[]): void {
  const sx = BOTTOM_STRIP_X;
  const sy = BOTTOM_STRIP_Y;
  const sw = BOTTOM_STRIP_W;
  const sh = BOTTOM_STRIP_H;
  const R = 14;
  const centerY = sy + sh / 2;

  // -- Glass-style background (matches bucket aesthetic) ----------------------
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, R);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.5)';
  ctx.fill();

  // Inner glow
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, R);
  ctx.clip();
  const innerGlow = ctx.createRadialGradient(sx + sw / 2, sy, 0, sx + sw / 2, sy, sw * 0.4);
  innerGlow.addColorStop(0, 'rgba(140, 180, 230, 0.04)');
  innerGlow.addColorStop(1, 'rgba(140, 180, 230, 0)');
  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.ellipse(sx + sw / 2, sy, sw * 0.4, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, R);
  ctx.strokeStyle = 'rgba(140, 180, 230, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // -- "NEXT" label with subtle styling --------------------------------------
  ctx.save();
  ctx.font = `bold ${IS_PORTRAIT ? 10 : 9}px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', sx + 18, centerY - 12);
  ctx.fillText('E', sx + 18, centerY - 2);
  ctx.fillText('X', sx + 18, centerY + 8);
  ctx.fillText('T', sx + 18, centerY + 18);
  ctx.restore();

  // Subtle divider
  ctx.save();
  const divGrad = ctx.createLinearGradient(sx + 34, sy + 8, sx + 34, sy + sh - 8);
  divGrad.addColorStop(0, 'rgba(140, 180, 230, 0)');
  divGrad.addColorStop(0.5, 'rgba(140, 180, 230, 0.1)');
  divGrad.addColorStop(1, 'rgba(140, 180, 230, 0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + 34, sy + 8);
  ctx.lineTo(sx + 34, sy + sh - 8);
  ctx.stroke();
  ctx.restore();

  // -- Gem slots (animated) ---------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx + 36, sy, sw - 36, sh, [0, R, R, 0]);
  ctx.clip();

  const gemAreaStart = sx + 50;
  const gemAreaWidth = sw - 50 - 15;
  const animating = queueAnim.active;
  const t = animating ? 1 - (1 - queueAnim.progress) * (1 - queueAnim.progress) : 1;
  const slideOffset = (1 - t) * GEM_SLOT_SPACING;

  const totalGemsWidth = (GEM_SLOT_COUNT - 1) * GEM_SLOT_SPACING;
  const firstSlotX = gemAreaStart + (gemAreaWidth - totalGemsWidth) / 2;

  // Flow arrows between gem slots (pointing left toward next-to-fire)
  for (let i = 0; i < GEM_SLOT_COUNT - 1; i++) {
    const arrowX = firstSlotX + (i + 0.5) * GEM_SLOT_SPACING + slideOffset;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(arrowX + 4, centerY - 4);
    ctx.lineTo(arrowX - 4, centerY);
    ctx.lineTo(arrowX + 4, centerY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Exiting gem
  if (animating && queueAnim.exitingGem) {
    const exitX = firstSlotX - GEM_SLOT_SPACING + slideOffset;
    drawStripGem(ctx, queueAnim.exitingGem, exitX, centerY, 1, 1 - t, false);
  }

  // Queue gems
  const slotsToShow = Math.min(queue.length, GEM_SLOT_COUNT);
  for (let i = 0; i < slotsToShow; i++) {
    const item = queue[i];
    const slotX = firstSlotX + i * GEM_SLOT_SPACING + slideOffset;
    const isNew = animating && i === GEM_SLOT_COUNT - 1;
    const baseAlpha = i === 0 ? 1 : 0.4 + 0.3 * (1 - i / GEM_SLOT_COUNT);
    const alpha = isNew ? baseAlpha * t : baseAlpha;
    drawStripGem(ctx, item.def, slotX, centerY - 2, 1, alpha, i === 0);

    // Blackhole gem: dark purple swirling aura in queue
    if (item.blackhole) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#6B21A8';
      ctx.beginPath();
      ctx.arc(slotX, centerY - 2, Math.min(item.def.radius, 20) + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.8;
      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#C084FC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BH', slotX, centerY - 2);
      ctx.restore();
    }

    // Bonus gem glow aura in queue
    if (item.bonus) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(slotX, centerY - 2, Math.min(item.def.radius, 20) + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dark overlay for heavy gems (no text, just darker)
    if (item.heavy) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(slotX, centerY - 2, Math.min(item.def.radius, 20), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore(); // remove clip
}

// ---------------------------------------------------------------------------
// Danger zone indicator
// ---------------------------------------------------------------------------

/**
 * Draw the glass lid that seals the well during shake.
 * `progress` 0 = fully open, 1 = fully sealed.
 * Two panels slide in from left and right to meet in the middle.
 */
export function drawShakeLid(ctx: CanvasRenderingContext2D, progress: number): void {
  if (progress <= 0) return;

  const { containerX: cx, containerY: cy, containerWidth: cw } = GRID;
  const lidH = 10;
  const halfW = cw / 2;

  // Ease-out for closing, ease-in for opening
  const t = progress;
  const slideX = halfW * t; // how far each panel has slid in

  ctx.save();

  // Left panel sliding right
  const lx = cx;
  const ly = cy - lidH / 2;
  const lw = slideX;

  // Right panel sliding left
  const rx = cx + cw - slideX;
  const rw = slideX;

  // Glass panel fill
  const panelGrad = ctx.createLinearGradient(cx, ly, cx, ly + lidH);
  panelGrad.addColorStop(0, 'rgba(140, 180, 230, 0.15)');
  panelGrad.addColorStop(0.5, 'rgba(180, 210, 245, 0.25)');
  panelGrad.addColorStop(1, 'rgba(140, 180, 230, 0.15)');

  // Left panel
  if (lw > 0) {
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lidH, [4, 0, 0, 4]);
    ctx.fillStyle = panelGrad;
    ctx.fill();
    // Bright edge
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Right panel
  if (rw > 0) {
    ctx.beginPath();
    ctx.roundRect(rx, ly, rw, lidH, [0, 4, 4, 0]);
    ctx.fillStyle = panelGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center seam glow when fully closed
  if (t > 0.9) {
    const seamAlpha = (t - 0.9) / 0.1;
    const seamGrad = ctx.createRadialGradient(cx + halfW, cy, 0, cx + halfW, cy, 15);
    seamGrad.addColorStop(0, `rgba(200, 225, 255, ${(0.3 * seamAlpha).toFixed(2)})`);
    seamGrad.addColorStop(1, 'rgba(200, 225, 255, 0)');
    ctx.fillStyle = seamGrad;
    ctx.beginPath();
    ctx.arc(cx + halfW, cy, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw the danger zone at the top of the container.
 * Only visible when gems are close to the top (dangerLevel > 0).
 * When overflowProgress > 0, shows a countdown timer bar.
 *
 * @param dangerLevel 0–1 how close gems are to the line
 * @param time elapsed game time (for pulse animation)
 * @param overflowProgress 0–1 how far through the grace period (0=just started, 1=game over)
 */
export function drawDangerZone(
  ctx: CanvasRenderingContext2D,
  dangerLevel: number,
  time: number,
  overflowProgress = 0,
): void {
  // Hidden when no danger
  if (dangerLevel <= 0 && overflowProgress <= 0) return;

  const { containerX, containerY, containerWidth } = GRID;

  ctx.save();

  if (dangerLevel > 0) {
    const pulse = 0.4 + 0.6 * ((Math.sin(time * (8 + dangerLevel * 8)) + 1) / 2);
    const alpha = 0.1 + 0.5 * dangerLevel * pulse;

    // Pulsing red strip
    ctx.fillStyle = `rgba(255, 40, 40, ${alpha * 0.5})`;
    ctx.fillRect(containerX, containerY - 3, containerWidth, 6);

    // Bright line
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + 0.7 * dangerLevel * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(containerX, containerY);
    ctx.lineTo(containerX + containerWidth, containerY);
    ctx.stroke();

    // Red screen edge vignette when danger is high
    if (dangerLevel > 0.5) {
      const vigAlpha = (dangerLevel - 0.5) * 0.3 * pulse;
      ctx.fillStyle = `rgba(255, 20, 20, ${vigAlpha.toFixed(3)})`;
      ctx.fillRect(containerX, containerY, containerWidth, 40);
    }
  }

  // Countdown bar when overflow is active
  if (overflowProgress > 0) {
    const barW = containerWidth * 0.7;
    const barH = 8;
    const barX = containerX + (containerWidth - barW) / 2;
    const barY = containerY + 12;
    const remaining = 1 - overflowProgress;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Remaining time bar (red → orange → green)
    const barColor = remaining > 0.5 ? '#f87171' : remaining > 0.25 ? '#FF6B2D' : '#22C55E';
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * remaining, barH, 4);
    ctx.fill();

    // "DANGER" text
    const textPulse = 0.6 + 0.4 * Math.sin(time * 12);
    ctx.globalAlpha = textPulse;
    ctx.font = `bold ${IS_PORTRAIT ? 14 : 12}px monospace`;
    ctx.fillStyle = '#FF4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER', containerX + containerWidth / 2, barY + barH + 14);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Top nav bar (BookBreaker-style compact score bar)
// ---------------------------------------------------------------------------

/**
 * Draw a thin horizontal nav bar across the top showing score, combo, and high score.
 * 40px tall, full viewport width, dark background.
 */
export function drawScoreHUD(
  ctx: CanvasRenderingContext2D,
  scoring: Readonly<ScoringState>,
  level = 1,
  pointsLeft = 0,
  gold = 0,
): void {
  const w = VIRTUAL_WIDTH;
  const h = TOP_NAV_H;

  // -- Background bar ---------------------------------------------------------
  ctx.fillStyle = '#0c1018';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(80, 100, 150, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w, h);
  ctx.stroke();

  ctx.save();
  ctx.textBaseline = 'middle';

  const labelY = 13;
  const valueY = 28;

  // -- Left: SCORE ------------------------------------------------------------
  ctx.font = `bold 9px monospace`;
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 15, labelY);

  ctx.font = `bold ${IS_PORTRAIT ? 14 : 13}px monospace`;
  ctx.fillStyle = ACCENT_GOLD;
  ctx.fillText(scoring.score.toLocaleString(), 15, valueY);

  // -- Left-center: GOLD ------------------------------------------------------
  const goldX = IS_PORTRAIT ? 150 : 140;
  ctx.font = `bold 9px monospace`;
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'left';
  ctx.fillText('GOLD', goldX, labelY);

  ctx.font = `bold ${IS_PORTRAIT ? 14 : 13}px monospace`;
  ctx.fillStyle = '#FBBF24';
  ctx.fillText(gold.toLocaleString(), goldX, valueY);

  // -- Center: COMBO when active, otherwise NEXT LVL points remaining ---------
  if (scoring.comboCount >= 2) {
    const comboColor = scoring.comboMultiplier >= 4 ? '#FF6B6B'
      : scoring.comboMultiplier >= 3 ? '#FBBF24'
      : scoring.comboMultiplier >= 2 ? '#34D399'
      : '#FFFFFF';

    ctx.font = `bold 9px monospace`;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('COMBO', w / 2, labelY);

    ctx.font = `bold ${IS_PORTRAIT ? 16 : 15}px monospace`;
    ctx.fillStyle = comboColor;
    ctx.fillText(`${scoring.comboCount}x  (${scoring.comboMultiplier}x)`, w / 2, valueY);
  } else {
    ctx.font = `bold 9px monospace`;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT LVL', w / 2, labelY);

    ctx.font = `bold ${IS_PORTRAIT ? 16 : 15}px monospace`;
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(pointsLeft > 0 ? pointsLeft.toLocaleString() : 'MAX', w / 2, valueY);
  }

  // -- Right: LEVEL -----------------------------------------------------------
  ctx.font = `bold 9px monospace`;
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'right';
  ctx.fillText('LEVEL', w - 15, labelY);

  ctx.font = `bold ${IS_PORTRAIT ? 16 : 15}px monospace`;
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText(String(level), w - 15, valueY);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pause overlay
// ---------------------------------------------------------------------------

const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/**
 * Draw a semi-transparent pause overlay with resume instructions.
 */
export function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;
  const cx = w / 2;
  const cy = h / 2;

  // Dark backdrop
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 12, 0.80)';
  ctx.fillRect(0, 0, w, h);

  // Centered box
  const boxW = IS_PORTRAIT ? 300 : 340;
  const boxH = 120;
  const bx = cx - boxW / 2;
  const by = cy - boxH / 2;

  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 14);
  ctx.fillStyle = '#0c1018';
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 196, 74, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${IS_PORTRAIT ? 28 : 24}px monospace`;
  ctx.fillStyle = '#e8c44a';
  ctx.fillText('PAUSED', cx, cy - 20);

  // Instruction
  ctx.font = `${IS_PORTRAIT ? 15 : 13}px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(IS_MOBILE ? 'tap to resume' : 'click to resume', cx, cy + 20);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Game-over summary overlay
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import type { RunStats } from './state';

/**
 * Draw the game-over overlay with animated fade-in.
 * `bgAlpha` controls backdrop opacity (0–1).
 * `elAlpha(index)` returns per-element opacity for staggered reveal.
 * Element indices: 0=title, 1=score, 2=stats, 3=highScore, 4=leaderboard, 5=button.
 */
export function drawGameOverSummary(
  ctx: CanvasRenderingContext2D,
  scoring: Readonly<ScoringState>,
  isNewHighScore: boolean,
  stats: RunStats,
  bgAlpha: number,
  elAlpha: (index: number) => number,
  history: ScoreEntry[] = [],
  rank = -1,
): void {
  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();

  // -- Backdrop with vignette -------------------------------------------------
  ctx.fillStyle = `rgba(4, 6, 10, ${(0.75 * bgAlpha).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);

  // Red vignette glow from edges
  if (bgAlpha > 0.3) {
    const vigAlpha = (bgAlpha - 0.3) / 0.7 * 0.15;
    const vig = ctx.createRadialGradient(cx, cy, h * 0.2, cx, cy, h * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(180, 40, 40, ${vigAlpha.toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // -- Glass panel behind content ---------------------------------------------
  const panelW = IS_PORTRAIT ? 400 : 360;
  const panelH = IS_PORTRAIT ? 540 : 470;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  const panelR = 20;

  if (bgAlpha > 0.2) {
    const pAlpha = Math.min(1, (bgAlpha - 0.2) / 0.5);
    ctx.save();
    ctx.globalAlpha = pAlpha;

    // Panel background
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, panelR);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
    ctx.fill();

    // Glass highlight on panel
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, panelR);
    ctx.clip();
    const panelGlow = ctx.createRadialGradient(panelX + panelW * 0.3, panelY, 0, panelX + panelW * 0.3, panelY, panelW * 0.5);
    panelGlow.addColorStop(0, 'rgba(140, 180, 230, 0.06)');
    panelGlow.addColorStop(1, 'rgba(140, 180, 230, 0)');
    ctx.fillStyle = panelGlow;
    ctx.beginPath();
    ctx.ellipse(panelX + panelW * 0.3, panelY, panelW * 0.5, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Panel border
    ctx.save();
    ctx.globalAlpha = pAlpha;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, panelR);
    ctx.strokeStyle = 'rgba(140, 180, 230, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // -- Layout: all Y positions relative to panelY for clean spacing -----------
  const titleY = panelY + 55;
  const divider1Y = panelY + 90;
  const scoreLabelY = panelY + 112;
  const scoreValueY = panelY + 145;
  const statsStartY = panelY + 185;
  const statsGap = IS_PORTRAIT ? 24 : 22;
  const divider2Y = panelY + 270;
  const hsY = divider2Y + 18;
  const lbStartY = panelY + 330;
  const btnY = panelY + panelH - BTN_H - 20;

  // -- Element 0: "GAME OVER" ------------------------------------------------
  const a0 = elAlpha(0);
  if (a0 > 0) {
    ctx.globalAlpha = a0;
    ctx.save();
    ctx.shadowColor = '#FF2222';
    ctx.shadowBlur = 25;
    ctx.font = `bold ${F_TITLE}px monospace`;
    ctx.fillStyle = '#FF3333';
    ctx.fillText('GAME OVER', cx, titleY);
    ctx.restore();

    ctx.globalAlpha = a0;
    ctx.font = `bold ${F_TITLE}px monospace`;
    ctx.fillStyle = '#FF4444';
    ctx.fillText('GAME OVER', cx, titleY);
  }

  // -- Element 1: Final score -------------------------------------------------
  const a1 = elAlpha(1);
  if (a1 > 0) {
    ctx.globalAlpha = a1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, divider1Y);
    ctx.lineTo(panelX + panelW - 30, divider1Y);
    ctx.stroke();

    ctx.font = `bold 10px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('FINAL SCORE', cx, scoreLabelY);

    ctx.save();
    ctx.shadowColor = '#e8c44a';
    ctx.shadowBlur = 15;
    ctx.font = `bold ${F_SCORE_LG}px monospace`;
    ctx.fillStyle = '#e8c44a';
    ctx.fillText(scoring.score.toLocaleString(), cx, scoreValueY);
    ctx.restore();
  }

  // -- Element 2: Run stats ---------------------------------------------------
  const a2 = elAlpha(2);
  if (a2 > 0) {
    ctx.globalAlpha = a2;
    const tierName = GEM_TIERS[stats.peakTier]?.type ?? '—';
    const capName = tierName.charAt(0).toUpperCase() + tierName.slice(1);
    const tierColor = GEM_TIERS[stats.peakTier]?.color ?? '#ffffff';

    const labelLeft = panelX + 40;
    const valueRight = panelX + panelW - 40;

    const statRows = [
      { label: 'Merges', value: String(stats.mergeCount), color: '#ffffff' },
      { label: 'Best Gem', value: capName, color: tierColor },
      { label: 'Max Combo', value: `${stats.maxCombo}x`, color: stats.maxCombo >= 5 ? '#FF6B6B' : stats.maxCombo >= 3 ? '#e8c44a' : '#ffffff' },
    ];

    for (let i = 0; i < statRows.length; i++) {
      const row = statRows[i];
      const ry = statsStartY + i * statsGap;

      ctx.font = `12px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, labelLeft, ry);

      ctx.font = `bold 13px monospace`;
      ctx.fillStyle = row.color;
      ctx.textAlign = 'right';
      ctx.fillText(row.value, valueRight, ry);
    }
  }

  // -- Element 3: High score --------------------------------------------------
  const a3 = elAlpha(3);
  if (a3 > 0) {
    ctx.globalAlpha = a3;
    ctx.textAlign = 'center';

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 30, divider2Y);
    ctx.lineTo(panelX + panelW - 30, divider2Y);
    ctx.stroke();

    if (isNewHighScore) {
      ctx.save();
      ctx.shadowColor = '#e8c44a';
      ctx.shadowBlur = 12;
      ctx.font = `bold ${F_HEADING}px monospace`;
      ctx.fillStyle = '#FBBF24';
      ctx.fillText('NEW HIGH SCORE!', cx, hsY);
      ctx.restore();

      ctx.font = `bold ${F_VALUE}px monospace`;
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(scoring.highScore.toLocaleString(), cx, hsY + 25);
    } else {
      ctx.font = `bold 10px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText('HIGH SCORE', cx, hsY);

      ctx.font = `bold ${F_VALUE}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(scoring.highScore.toLocaleString(), cx, hsY + 22);
    }
  }

  // -- Element 4: Leaderboard ------------------------------------------------
  const a4 = elAlpha(4);
  if (a4 > 0 && history.length > 0) {
    ctx.globalAlpha = a4;
    ctx.textAlign = 'center';

    ctx.font = `bold 9px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('TOP SCORES', cx, lbStartY);

    const rowH = 17;
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const rowY = lbStartY + 16 + i * rowH;
      const isCurrent = i === rank;

      ctx.font = `${isCurrent ? 'bold ' : ''}11px monospace`;
      ctx.fillStyle = isCurrent ? '#FBBF24' : 'rgba(255, 255, 255, 0.4)';

      const d = new Date(entry.date);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      ctx.fillText(`${i + 1}. ${entry.score.toLocaleString()}  ${entry.bestCombo}x  ${dateStr}`, cx, rowY);
    }
  }

  // -- Element 5: "Play Again" button ----------------------------------------
  const a5 = elAlpha(5);
  if (a5 > 0) {
    ctx.globalAlpha = a5;
    ctx.textAlign = 'center';

    const btnX = cx - BTN_W / 2;

    // Button glow
    ctx.save();
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, BTN_W, BTN_H, 14);
    ctx.fillStyle = '#22C55E';
    ctx.fill();
    ctx.restore();

    // Button face
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, BTN_W, BTN_H, 14);
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + BTN_H);
    btnGrad.addColorStop(0, '#2DD45A');
    btnGrad.addColorStop(1, '#1AA34A');
    ctx.fillStyle = btnGrad;
    ctx.fill();

    // Button border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `bold ${F_BTN}px monospace`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Play Again', cx, btnY + BTN_H / 2);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Placed gems
// ---------------------------------------------------------------------------

/** Draw all gems that have been placed on the board (uses animated currentY). */
export function drawPlacedGems(ctx: CanvasRenderingContext2D, gems: readonly PlacedGem[]): void {
  for (const gem of gems) {
    const drawY = gem.currentY;

    // Filled circle
    ctx.beginPath();
    ctx.arc(gem.x, drawY, gem.def.radius, 0, Math.PI * 2);
    ctx.fillStyle = gem.def.color;
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small inner highlight (top-left light source per style guide)
    ctx.beginPath();
    ctx.arc(
      gem.x - gem.def.radius * 0.25,
      drawY - gem.def.radius * 0.25,
      gem.def.radius * 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Drop target preview (shown while dragging a gem)
// ---------------------------------------------------------------------------

/** Valid drop column highlight color. */
const DROP_VALID_COL = 'rgba(80, 200, 120, 0.12)';
/** Valid drop column border color. */
const DROP_VALID_BORDER = 'rgba(80, 200, 120, 0.35)';
/** Invalid / out-of-bounds indicator color. */
const DROP_INVALID_COL = 'rgba(220, 60, 60, 0.10)';
const DROP_INVALID_BORDER = 'rgba(220, 60, 60, 0.30)';

/**
 * Draw a drop-target column highlight while a gem is being dragged.
 * - Valid column: green highlight with dashed landing circle
 * - Out-of-bounds: red overlay with X rejection indicator
 * Only draws when a drag is active.
 */
export function drawDropTargetPreview(ctx: CanvasRenderingContext2D): void {
  const drag = getDraggedGem();
  if (!drag) return;

  const { containerX, containerY, containerWidth, containerHeight } = GRID;
  const _dp = bodyPos(drag.body);
  const gemX = _dp.x;
  const gemY = _dp.y;

  // Check if the gem center is within the container bounds
  const inBoundsX = gemX >= containerX && gemX <= containerX + containerWidth;
  const inBoundsY = gemY >= containerY && gemY <= containerY + containerHeight;
  const isValid = inBoundsX && inBoundsY;

  // Snap to the nearest column regardless
  const zone = nearestDropZone(gemX);
  const colX = zone.minX;
  const colW = zone.maxX - zone.minX;

  ctx.save();

  if (isValid) {
    // -- Valid column highlight ------------------------------------------------
    ctx.fillStyle = DROP_VALID_COL;
    ctx.fillRect(colX, containerY, colW, containerHeight);

    // Left + right border glow
    ctx.strokeStyle = DROP_VALID_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(colX, containerY);
    ctx.lineTo(colX, containerY + containerHeight);
    ctx.moveTo(colX + colW, containerY);
    ctx.lineTo(colX + colW, containerY + containerHeight);
    ctx.stroke();

    // Landing indicator — dashed circle outline near bottom of column
    const def = GEM_TIERS[drag.tier];
    if (def) {
      const indicatorY = containerY + containerHeight - def.radius;
      ctx.beginPath();
      ctx.arc(zone.centerX, indicatorY, def.radius, 0, Math.PI * 2);
      ctx.strokeStyle = DROP_VALID_BORDER;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    // -- Invalid / out-of-bounds indicator ------------------------------------
    ctx.fillStyle = DROP_INVALID_COL;
    ctx.fillRect(colX, containerY, colW, containerHeight);

    ctx.strokeStyle = DROP_INVALID_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(colX, containerY);
    ctx.lineTo(colX, containerY + containerHeight);
    ctx.moveTo(colX + colW, containerY);
    ctx.lineTo(colX + colW, containerY + containerHeight);
    ctx.stroke();

    // X rejection indicator at center of column
    const cx = zone.centerX;
    const cy = containerY + containerHeight / 2;
    const sz = 14;
    ctx.strokeStyle = DROP_INVALID_BORDER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - sz, cy - sz);
    ctx.lineTo(cx + sz, cy + sz);
    ctx.moveTo(cx + sz, cy - sz);
    ctx.lineTo(cx - sz, cy + sz);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Physics gems
// ---------------------------------------------------------------------------

/** Scale factor applied to a gem while it's being dragged. */
const DRAG_SCALE = 1.15;
/** Opacity of a gem while it's being dragged. */
const DRAG_ALPHA = 0.8;

/**
 * Draw all gem bodies currently in the Matter.js world.
 * Reads gem metadata from each body to determine tier/color/radius.
 * The currently dragged gem (if any) is drawn last, scaled up and translucent.
 * @param time  Elapsed game time in seconds (drives glow pulse).
 */
export function drawPhysicsGems(ctx: CanvasRenderingContext2D, bodies: readonly Body[], time: number = 0): void {
  const drag = getDraggedGem();
  const dragBId = drag ? bodyId(drag.body) : -1;

  // Draw non-dragged gems first
  for (const body of bodies) {
    if (bodyId(body) === dragBId) continue;
    const data = getGemData(body);
    if (!data) continue;
    const def = GEM_TIERS[data.tier];
    if (!def) continue;
    const pos = bodyPos(body);
    if (data.bonus) drawBonusAura(ctx, pos.x, pos.y, def.radius, time, 1);
    if (data.blackhole) drawBlackholeAura(ctx, pos.x, pos.y, def.radius, time);
    drawSingleGem(ctx, pos.x, pos.y, def, 1, 1, data.tier, time, bodyAngle(body), data.rainbow, data.heavy);
  }

  // Draw dragged gem last (on top) with lift effect
  if (drag) {
    const data = getGemData(drag.body);
    const def = GEM_TIERS[drag.tier];
    if (def) {
      const pos = bodyPos(drag.body);
      drawSingleGem(ctx, pos.x, pos.y, def, DRAG_SCALE, DRAG_ALPHA, drag.tier, time, bodyAngle(drag.body), data?.rainbow ?? false, data?.heavy ?? false);
    }
  }
}

/**
 * Draw shimmer flash points on gem surfaces.
 * Each shimmer is a bright 4-pointed star that flashes in and out.
 */
export function drawGemShimmers(ctx: CanvasRenderingContext2D): void {
  const shimmers = getShimmers();
  if (shimmers.length === 0) return;

  ctx.save();
  // Additive blending — can only add light, never create dark artifacts
  ctx.globalCompositeOperation = 'lighter';

  for (const s of shimmers) {
    const pos = bodyPos(s.bodyRef);
    const x = pos.x + s.offX;
    const y = pos.y + s.offY;
    const t = s.age / s.lifetime;
    const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
    if (alpha < 0.05) continue;

    const sz = s.size * (0.5 + 0.5 * alpha);

    // Soft glow halo
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, sz * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Bright 4-pointed star
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const r = i % 2 === 0 ? sz : sz * 0.2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/** Draw a single gem circle with optional scale and alpha modifiers. */
function drawSingleGem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  def: GemDef,
  scale: number,
  alpha: number,
  tier: number = 0,
  time: number = 0,
  angle: number = 0,
  rainbow: boolean = false,
  heavy: boolean = false,
): void {
  const r = def.radius * scale;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Apply body rotation
  if (angle !== 0) {
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.translate(-x, -y);
  }

  // DPR-aware effect scaling — reduces fill area on high-DPR screens
  const gScale = glowRadiusScale();
  const sScale = shadowOffsetScale();
  const aScale = glowAlphaScale();

  // Drop shadow behind dragged gem (offset scaled by DPR)
  if (scale > 1) {
    const shadowOff = 3 * sScale;
    ctx.beginPath();
    ctx.arc(x + shadowOff, y + shadowOff, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
  }

  // -- Pulsing glow (drawn behind the gem) ------------------------------------
  // Rainbow gems get an animated hue-cycling glow; normal gems use def.color
  const showGlow = time >= 0 && getSettings().showParticles && getQualityPreset().gemGlow;
  if (showGlow) {
    const glowBase = rainbow ? 0.20 : 0.06 + tier * 0.04;
    const glowPulse = 0.5 + 0.5 * Math.sin(time * (rainbow ? 5 : 3) + tier * 0.7);
    const rawGlowAlpha = glowBase * (0.5 + 0.5 * glowPulse);
    const finalGlowAlpha = alpha * rawGlowAlpha * aScale;

    if (finalGlowAlpha > 0.02) {
      const glowRadius = r * (1.35 + tier * 0.05) * gScale;
      const grad = ctx.createRadialGradient(x, y, r * 0.5 * gScale, x, y, glowRadius);

      if (rainbow) {
        // Animated rainbow glow
        const hue = ((time * 90) % 360 + 360) % 360;
        grad.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, def.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.globalAlpha = finalGlowAlpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha; // restore for gem body
    }
  }

  // Gem body — sprite clipped to circle (prevents square PNG edges)
  const sprite = rainbow
    ? getRainbowGemSprite(tier, time)
    : getGemSprite(tier);
  if (sprite) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    const size = r * 2;
    ctx.drawImage(sprite, x - r, y - r, size, size);
    ctx.restore();
  } else {
    // Fallback: colored circle (while sprites load or if missing)
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
  }

  // Heavy gem: dark tint
  if (heavy) {
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Draw a dark pulsing purple vortex behind a blackhole gem. */
function drawBlackholeAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  const auraR = r + 12 + pulse * 5;
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.15 * pulse;
  const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, auraR);
  grad.addColorStop(0, '#1a0030');
  grad.addColorStop(0.4, '#6B21A8');
  grad.addColorStop(0.7, '#9333EA');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw a pulsing golden aura behind a bonus gem. Call before drawSingleGem. */
function drawBonusAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, alpha: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  const auraR = r + 8 + pulse * 4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * (0.15 + 0.1 * pulse);
  const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, auraR);
  grad.addColorStop(0, '#FBBF24');
  grad.addColorStop(0.6, '#FBBF24');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
