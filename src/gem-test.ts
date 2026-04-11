// ---------------------------------------------------------------------------
// Visual test: render all gem tiers on a canvas for verification
// ---------------------------------------------------------------------------

import { GEM_TIERS } from './gems';
import { drawGem, getGemSprite } from './gem-sprites';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const BG = '#1a1a2e';

const canvas = document.createElement('canvas');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
canvas.style.display = 'block';
canvas.style.margin = '0 auto';
canvas.style.background = BG;
canvas.style.imageRendering = 'pixelated';

document.body.style.margin = '0';
document.body.style.background = '#000';
document.body.style.display = 'flex';
document.body.style.alignItems = 'center';
document.body.style.justifyContent = 'center';
document.body.style.minHeight = '100vh';

document.getElementById('app')?.appendChild(canvas)
  ?? document.body.appendChild(canvas);

const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// -- Layout constants ---------------------------------------------------------
const TIER_COUNT = GEM_TIERS.length;
const ROW_Y = CANVAS_H * 0.45;          // vertical center for gems
const LABEL_Y_OFFSET = 20;              // gap below gem to label
const POINTS_Y_OFFSET = 16;             // gap below label to points
const TITLE_Y = 50;
const SPACING = CANVAS_W / (TIER_COUNT + 1); // even horizontal distribution

// -- Draw title ---------------------------------------------------------------
ctx.save();
ctx.font = 'bold 32px monospace';
ctx.fillStyle = '#e0e0e0';
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText('GemJam — Tier Showcase', CANVAS_W / 2, TITLE_Y);

ctx.font = '16px monospace';
ctx.fillStyle = '#888';
ctx.fillText('10 tiers · progressive radius · exponential points · 16-bit pixel art', CANVAS_W / 2, TITLE_Y + 40);
ctx.restore();

// -- Draw each tier -----------------------------------------------------------
for (let i = 0; i < TIER_COUNT; i++) {
  const tier = GEM_TIERS[i];
  const x = SPACING * (i + 1);

  // Draw the gem procedurally
  ctx.save();
  ctx.translate(x, ROW_Y);
  drawGem(ctx, tier.radius, tier.baseColor);
  ctx.restore();

  // Tier label (name)
  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = tier.baseColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(tier.name, x, ROW_Y + tier.radius * 1.15 + LABEL_Y_OFFSET);

  // Tier details
  ctx.font = '11px monospace';
  ctx.fillStyle = '#aaa';
  const detailY = ROW_Y + tier.radius * 1.15 + LABEL_Y_OFFSET + POINTS_Y_OFFSET;
  ctx.fillText(`r=${tier.radius}px`, x, detailY);
  ctx.fillText(`${tier.points} pts`, x, detailY + 14);
  ctx.fillText(`id: ${tier.id}`, x, detailY + 28);
  ctx.restore();

  // Also warm the sprite cache (proves getGemSprite works)
  getGemSprite(tier.spriteKey, tier.radius, tier.baseColor);
}

// -- Merge chain legend -------------------------------------------------------
ctx.save();
ctx.font = '13px monospace';
ctx.fillStyle = '#666';
ctx.textAlign = 'center';
ctx.textBaseline = 'bottom';
ctx.fillText(
  GEM_TIERS.map((t) => t.name).join(' → '),
  CANVAS_W / 2,
  CANVAS_H - 30,
);
ctx.fillText('Merge chain: two of tier N → one of tier N+1  (Celestite is terminal)', CANVAS_W / 2, CANVAS_H - 50);
ctx.restore();
