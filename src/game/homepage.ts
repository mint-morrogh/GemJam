// ---------------------------------------------------------------------------
// Homepage — title screen shown on page load.
// ---------------------------------------------------------------------------
// Shows GEMJAM title over a darkened "full well" of random gems, with:
//   - CONTINUE (only when a save exists)
//   - NEW RUN
//   - GAME MODES (submenu: Classic / Suika)
// Per-mode high score is shown at the top.
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import { getGameMode, setGameMode, gameModeLabel, gameModeBlurb, type GameMode } from './gameMode';
import { loadHighScore, loadScoreHistory } from './scoring';

// ---------------------------------------------------------------------------
// Actions a click can resolve to
// ---------------------------------------------------------------------------

export type HomeAction =
  | { type: 'continue' }
  | { type: 'new-run' }
  | { type: 'select-mode'; mode: GameMode };

// ---------------------------------------------------------------------------
// Home state
// ---------------------------------------------------------------------------

type Submenu = 'main' | 'modes';

interface Sparkle {
  x: number;
  y: number;
  life: number;      // seconds remaining
  maxLife: number;   // seconds it started with
  size: number;
  hue: number;       // 0-360
  twinkleOffset: number;
}

interface HomeState {
  open: boolean;
  submenu: Submenu;
  /** seconds since opened, for fade-in */
  elapsed: number;
  /** Whether a resumable save was present at open time */
  hasSave: boolean;
  /** Active sparkles twinkling around the GEMJAM title */
  sparkles: Sparkle[];
  /** Accumulator for spawning new sparkles at a steady rate */
  sparkleSpawnTimer: number;
}

const state: HomeState = {
  open: false,
  submenu: 'main',
  elapsed: 0,
  hasSave: false,
  sparkles: [],
  sparkleSpawnTimer: 0,
};

export function isHomeOpen(): boolean { return state.open; }
export function isHomeSubmenu(): Submenu { return state.submenu; }

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

/** Open the homepage. `hasSave` controls whether CONTINUE is shown. */
export function openHome(hasSave: boolean): void {
  state.open = true;
  state.submenu = 'main';
  state.elapsed = 0;
  state.hasSave = hasSave;
  state.sparkles = [];
}

export function closeHome(): void {
  state.open = false;
}

export function updateHome(dt: number): void {
  if (!state.open) return;
  state.elapsed += dt;

  // Sparkles tick down
  for (let i = state.sparkles.length - 1; i >= 0; i--) {
    const sp = state.sparkles[i];
    sp.life -= dt;
    if (sp.life <= 0) state.sparkles.splice(i, 1);
  }

  // Spawn new sparkles around the GEMJAM title (main screen only)
  if (state.submenu === 'main') {
    state.sparkleSpawnTimer -= dt;
    if (state.sparkleSpawnTimer <= 0) {
      spawnSparkle();
      state.sparkleSpawnTimer = 0.06 + Math.random() * 0.14; // ~8-12/s
    }
  }
}

function spawnSparkle(): void {
  const cx = VIRTUAL_WIDTH / 2;
  // Roughly the title bounding box — must stay in sync with drawMain's titleY
  const titleSize = IS_PORTRAIT ? 64 : 56;
  const titleY = IS_PORTRAIT ? VIRTUAL_HEIGHT * 0.13 : VIRTUAL_HEIGHT * 0.11;
  const halfW = titleSize * 2.2; // ~width of "GEMJAM" at this font
  const halfH = titleSize * 0.7;
  state.sparkles.push({
    x: cx + (Math.random() - 0.5) * halfW * 2,
    y: titleY + (Math.random() - 0.5) * halfH * 2,
    life: 0.8 + Math.random() * 0.9,
    maxLife: 1.5,
    size: 2 + Math.random() * 3,
    hue: Math.random() < 0.5 ? 45 : 195, // gold or cyan accents
    twinkleOffset: Math.random() * Math.PI * 2,
  });
}

// ---------------------------------------------------------------------------
// Button layout
// ---------------------------------------------------------------------------

const BTN_W = IS_PORTRAIT ? 260 : 220;
const BTN_H = IS_PORTRAIT ? 56 : 46;
const BTN_GAP = 14;

function mainButtonRects(): { label: string; x: number; y: number; w: number; h: number; id: string }[] {
  const cx = VIRTUAL_WIDTH / 2;
  const btns: { label: string; x: number; y: number; w: number; h: number; id: string }[] = [];

  // Stack buttons in the lower half of the screen
  const baseY = VIRTUAL_HEIGHT * 0.58;
  let y = baseY;

  if (state.hasSave) {
    btns.push({ label: 'CONTINUE RUN', x: cx - BTN_W / 2, y, w: BTN_W, h: BTN_H, id: 'continue' });
    y += BTN_H + BTN_GAP;
  }
  btns.push({ label: 'NEW RUN', x: cx - BTN_W / 2, y, w: BTN_W, h: BTN_H, id: 'new-run' });
  y += BTN_H + BTN_GAP;
  btns.push({ label: 'GAME MODES', x: cx - BTN_W / 2, y, w: BTN_W, h: BTN_H, id: 'modes' });

  return btns;
}

function modeCardRects(): { mode: GameMode; x: number; y: number; w: number; h: number }[] {
  const cardW = IS_PORTRAIT ? 300 : 280;
  const cardH = IS_PORTRAIT ? 150 : 130;
  const gap = 18;
  const totalH = cardH * 2 + gap;
  const startY = VIRTUAL_HEIGHT / 2 - totalH / 2 + 20;
  const x = VIRTUAL_WIDTH / 2 - cardW / 2;
  return [
    { mode: 'classic', x, y: startY, w: cardW, h: cardH },
    { mode: 'suika',   x, y: startY + cardH + gap, w: cardW, h: cardH },
  ];
}

function backButtonRect(): { x: number; y: number; w: number; h: number } {
  const w = 100;
  const h = 36;
  return { x: VIRTUAL_WIDTH / 2 - w / 2, y: VIRTUAL_HEIGHT - h - 30, w, h };
}

// ---------------------------------------------------------------------------
// Click handler
// ---------------------------------------------------------------------------

export function handleHomeClick(vx: number, vy: number): HomeAction | null {
  if (!state.open) return null;

  if (state.submenu === 'main') {
    for (const btn of mainButtonRects()) {
      if (vx >= btn.x && vx <= btn.x + btn.w && vy >= btn.y && vy <= btn.y + btn.h) {
        if (btn.id === 'continue') return { type: 'continue' };
        if (btn.id === 'new-run') return { type: 'new-run' };
        if (btn.id === 'modes') { state.submenu = 'modes'; state.elapsed = 0; return null; }
      }
    }
  } else {
    // Modes screen
    for (const card of modeCardRects()) {
      if (vx >= card.x && vx <= card.x + card.w && vy >= card.y && vy <= card.y + card.h) {
        setGameMode(card.mode);
        state.submenu = 'main';
        state.elapsed = 0;
        return { type: 'select-mode', mode: card.mode };
      }
    }
    const back = backButtonRect();
    if (vx >= back.x && vx <= back.x + back.w && vy >= back.y && vy <= back.y + back.h) {
      state.submenu = 'main';
      state.elapsed = 0;
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function drawHome(ctx: CanvasRenderingContext2D): void {
  if (!state.open) return;

  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;

  // Global fade-in (0 → 1 over ~0.35s)
  const fade = Math.min(1, state.elapsed / 0.35);

  ctx.save();

  // Darkening overlay over the live physics scene — gems stay visible as
  // a subtle backdrop without fighting the UI for attention.
  ctx.fillStyle = 'rgba(4, 6, 12, 0.78)';
  ctx.fillRect(0, 0, w, h);

  // Subtle vignette on top for depth
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = fade;

  if (state.submenu === 'main') drawMain(ctx);
  else drawModes(ctx);

  ctx.restore();
}

function drawMain(ctx: CanvasRenderingContext2D): void {
  const cx = VIRTUAL_WIDTH / 2;

  // Title — GEMJAM. Positioned near the top so scores and buttons breathe.
  const titleY = IS_PORTRAIT ? VIRTUAL_HEIGHT * 0.13 : VIRTUAL_HEIGHT * 0.11;
  const titleSize = IS_PORTRAIT ? 64 : 56;

  ctx.save();
  ctx.font = `bold ${titleSize}px monospace`;
  const grad = ctx.createLinearGradient(0, titleY - titleSize / 2, 0, titleY + titleSize / 2);
  grad.addColorStop(0, '#FBBF24');
  grad.addColorStop(1, '#e8c44a');
  ctx.fillStyle = grad;
  ctx.fillText('GEMJAM', cx, titleY);
  ctx.restore();

  // Sparkles — drawn OVER the title so they twinkle on top
  drawSparkles(ctx);

  // Current mode + high score
  const mode = getGameMode();

  // Mode indicator under the title
  ctx.font = `bold 13px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`${gameModeLabel(mode).toUpperCase()} MODE`, cx, titleY + titleSize * 0.8);

  // Top 3 scores for this mode — laid out in three tabular columns
  // (rank · score · date) so every row aligns cleanly.
  const history = loadScoreHistory(mode).slice(0, 3);
  const lbY = titleY + titleSize * 0.8 + 46;
  ctx.font = `bold 13px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('TOP SCORES', cx, lbY);

  if (history.length === 0) {
    ctx.font = `13px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('No scores yet', cx, lbY + 24);
  } else {
    // Column x positions, all relative to center. Using monospace so rank
    // numerals align by digit width; score is right-aligned so commas/1000s
    // stack, date is left-aligned so slashes sit together.
    const rankX  = cx - 90;           // "1."  "2."  "3."   (left-aligned)
    const scoreX = cx + 30;           //         "12,345"   (right-aligned)
    const dateX  = cx + 45;           //         "4/13"     (left-aligned)

    ctx.font = `13px monospace`;
    for (let i = 0; i < history.length; i++) {
      const e = history[i];
      const d = new Date(e.date);
      const rowY = lbY + 24 + i * 20;

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillText(`${i + 1}.`, rankX, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(e.score.toLocaleString(), scoreX, rowY);

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, dateX, rowY);
    }
    // Restore centered alignment for anything rendered after the block
    ctx.textAlign = 'center';
  }

  // Buttons
  const btns = mainButtonRects();
  for (const btn of btns) {
    const isPrimary = btn.id === 'continue' || (!state.hasSave && btn.id === 'new-run');
    drawButton(ctx, btn.x, btn.y, btn.w, btn.h, btn.label, isPrimary);
  }
}

function drawModes(ctx: CanvasRenderingContext2D): void {
  const cx = VIRTUAL_WIDTH / 2;

  // Heading
  const headingY = IS_PORTRAIT ? VIRTUAL_HEIGHT * 0.18 : VIRTUAL_HEIGHT * 0.16;
  ctx.font = `bold 18px monospace`;
  ctx.fillStyle = '#e8c44a';
  ctx.fillText('SELECT MODE', cx, headingY);

  // Mode cards
  const cards = modeCardRects();
  const currentMode = getGameMode();
  for (const card of cards) {
    const isSelected = card.mode === currentMode;
    const hs = loadHighScore(card.mode);

    // Card background
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, 14);
    ctx.fillStyle = isSelected ? 'rgba(232, 196, 74, 0.12)' : 'rgba(12, 16, 24, 0.85)';
    ctx.fill();
    ctx.strokeStyle = isSelected ? 'rgba(232, 196, 74, 0.7)' : 'rgba(140, 180, 230, 0.25)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Mode name
    ctx.textAlign = 'left';
    ctx.font = `bold 20px monospace`;
    ctx.fillStyle = isSelected ? '#FBBF24' : '#ffffff';
    ctx.fillText(gameModeLabel(card.mode).toUpperCase(), card.x + 18, card.y + 28);

    // Blurb — word-wrapped so long descriptions stay inside the card
    ctx.font = `11px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    wrapTextLeft(ctx, gameModeBlurb(card.mode), card.x + 18, card.y + 52, card.w - 36, 14);

    // High score badge
    ctx.font = `bold 11px monospace`;
    ctx.fillStyle = '#e8c44a';
    ctx.textAlign = 'right';
    ctx.fillText(
      hs > 0 ? `HS  ${hs.toLocaleString()}` : 'no score yet',
      card.x + card.w - 18, card.y + card.h - 14,
    );

    // Selected check
    if (isSelected) {
      ctx.textAlign = 'right';
      ctx.font = `9px monospace`;
      ctx.fillStyle = '#FBBF24';
      ctx.fillText('SELECTED', card.x + card.w - 18, card.y + 22);
    }
  }

  // Back button
  ctx.textAlign = 'center';
  const back = backButtonRect();
  drawButton(ctx, back.x, back.y, back.w, back.h, 'BACK', false);
}

/** Draw a 4-point twinkling sparkle star at (cx, cy). */
function drawSparkleStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number, hue: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  const color = `hsla(${hue}, 100%, 80%, ${alpha})`;
  const coreColor = `hsla(${hue}, 100%, 92%, ${alpha})`;
  ctx.fillStyle = color;
  ctx.strokeStyle = coreColor;

  // Soft glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
  glow.addColorStop(0, `hsla(${hue}, 100%, 85%, ${alpha * 0.55})`);
  glow.addColorStop(1, `hsla(${hue}, 100%, 85%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 4-point star shape
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  const long = size;
  const short = size * 0.28;
  ctx.moveTo(0, -long);
  ctx.lineTo(short, -short);
  ctx.lineTo(long, 0);
  ctx.lineTo(short, short);
  ctx.lineTo(0, long);
  ctx.lineTo(-short, short);
  ctx.lineTo(-long, 0);
  ctx.lineTo(-short, -short);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D): void {
  for (const sp of state.sparkles) {
    // Life curve: ramp up over first 25%, hold, ramp down over last 25%
    const t = 1 - sp.life / sp.maxLife;
    let envelope: number;
    if (t < 0.25) envelope = t / 0.25;
    else if (t > 0.75) envelope = (1 - t) / 0.25;
    else envelope = 1;
    // Fast twinkle on top of the envelope
    const twinkle = 0.6 + 0.4 * Math.sin(state.elapsed * 12 + sp.twinkleOffset);
    const alpha = envelope * twinkle;
    drawSparkleStar(ctx, sp.x, sp.y, sp.size, alpha, sp.hue);
  }
}

/** Draw left-aligned word-wrapped text. Uses the caller's current font + fill. */
function wrapTextLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  ctx.textAlign = 'left';
  const words = text.split(' ');
  let line = '';
  let lineIdx = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIdx * lineHeight);
      line = word;
      lineIdx++;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lineIdx * lineHeight);
}

function drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, primary: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  if (primary) {
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.92)';
  } else {
    // Solid dark-gray panel so buttons read as buttons, not ghostly frames.
    ctx.fillStyle = '#1f2937';
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = primary ? 'rgba(134, 239, 172, 0.8)' : 'rgba(140, 180, 230, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${IS_PORTRAIT ? 15 : 13}px monospace`;
  ctx.fillStyle = primary ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
}

