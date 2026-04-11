// ---------------------------------------------------------------------------
// Gem sphere sprite loader — loads sphere PNGs, tints per-tier at runtime
// ---------------------------------------------------------------------------

import { GEM_TIERS } from './gems';

/**
 * Sprite source for each game tier.
 * - `file`: image path under /gems/spheres/
 * - `tint`: false = use image as-is (has its own colors), true = apply tier color
 */
interface SpriteEntry {
  file: string;
  tint: boolean;
}

/**
 * Map each game tier index to its sprite source.
 * Pebble + tier1-3 have baked-in colors (tint: false).
 * Tier 4-10 are grayscale with runtime colorization (tint: true).
 * Tier 11 is natural diamond gray (tint: false).
 */
const TIER_SPRITES: SpriteEntry[] = [
  { file: 'gem_pebble.png', tint: false }, // 0: pebble (no color)
  { file: 'gem_tier1.png',  tint: true  }, // 1: moonstone (lavender)
  { file: 'gem_tier2.png',  tint: true  }, // 2: turquoise
  { file: 'gem_tier3.png',  tint: true  }, // 3: sapphire (blue)
  { file: 'gem_tier4.png',  tint: true  }, // 4: amethyst (purple)
  { file: 'gem_tier5.png',  tint: true  }, // 5: ruby (red)
  { file: 'gem_tier6.png',  tint: true  }, // 6: citrine (orange)
  { file: 'gem_tier7.png',  tint: true  }, // 7: topaz (yellow)
  { file: 'gem_tier8.png',  tint: true  }, // 8: emerald (green)
  { file: 'gem_tier9.png',  tint: true  }, // 9: jade (dark green)
  { file: 'gem_tier10.png', tint: false }, // 10: diamond (natural gray)
];

// Deduplicate and preload all unique images
const baseImageMap = new Map<string, HTMLImageElement>();

for (const entry of TIER_SPRITES) {
  if (!baseImageMap.has(entry.file)) {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}gems/spheres/${entry.file}`;
    baseImageMap.set(entry.file, img);
  }
}

// ---------------------------------------------------------------------------
// Normal sprite cache (static color per tier)
// ---------------------------------------------------------------------------

const spriteCache = new Map<number, HTMLCanvasElement>();

/** Apply a color tint to a canvas using composite ops. */
function applyTint(ctx: CanvasRenderingContext2D, img: HTMLImageElement, color: string): void {
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalCompositeOperation = 'luminosity';
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function createSprite(tier: number): HTMLCanvasElement | null {
  const entry = TIER_SPRITES[tier];
  if (!entry) return null;

  const img = baseImageMap.get(entry.file);
  if (!img || !img.complete || img.naturalWidth === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);

  if (entry.tint) {
    const def = GEM_TIERS[tier];
    if (def) applyTint(ctx, img, def.color);
  }

  return canvas;
}

/**
 * Get the sprite for a normal (non-rainbow) gem tier.
 * Returns a cached canvas if ready, null while loading.
 */
export function getGemSprite(tier: number): HTMLCanvasElement | null {
  const cached = spriteCache.get(tier);
  if (cached) return cached;

  const sprite = createSprite(tier);
  if (sprite) spriteCache.set(tier, sprite);
  return sprite;
}

// ---------------------------------------------------------------------------
// Rainbow sprite cache (animated hue cycling)
// ---------------------------------------------------------------------------

/** Number of pre-cached hue slots for rainbow animation. */
const RAINBOW_SLOTS = 24;

/** Rainbow cycle speed: full rotation every ~4 seconds. */
const RAINBOW_CYCLE_SPEED = 1.5;

/**
 * Cache: `${tier}_${slot}` → tinted canvas.
 * 24 hue slots × only the tiers that are actually rainbow on screen.
 */
const rainbowCache = new Map<string, HTMLCanvasElement>();

/** Convert HSL hue (0-360) to hex color at fixed S=85%, L=60%. */
function hueToHex(hue: number): string {
  const s = 0.85, l = 0.6;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function createRainbowSprite(tier: number, slot: number): HTMLCanvasElement | null {
  const entry = TIER_SPRITES[tier];
  if (!entry) return null;

  const img = baseImageMap.get(entry.file);
  if (!img || !img.complete || img.naturalWidth === 0) return null;

  const hue = (slot / RAINBOW_SLOTS) * 360;
  const color = hueToHex(hue);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);
  applyTint(ctx, img, color);

  return canvas;
}

/**
 * Get the rainbow-tinted sprite for a prestige gem.
 * The hue cycles smoothly based on the provided time value.
 * All tiers get the rainbow tint (even tiers 0-3 that are normally untinted).
 */
export function getRainbowGemSprite(tier: number, time: number): HTMLCanvasElement | null {
  const slot = Math.floor(((time * RAINBOW_CYCLE_SPEED) % RAINBOW_SLOTS + RAINBOW_SLOTS)) % RAINBOW_SLOTS;
  const key = `${tier}_${slot}`;

  const cached = rainbowCache.get(key);
  if (cached) return cached;

  const sprite = createRainbowSprite(tier, slot);
  if (sprite) rainbowCache.set(key, sprite);
  return sprite;
}

/** Clear all sprite caches (e.g. on hot-reload or color change). */
export function clearGemSpriteCache(): void {
  spriteCache.clear();
  rainbowCache.clear();
}
