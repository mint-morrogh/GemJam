// ---------------------------------------------------------------------------
// Procedural 16-bit pixel-art gem sprites (Canvas 2D)
// ---------------------------------------------------------------------------

/**
 * Draw a faceted gem shape onto a canvas context at (0,0) center.
 * The shape is an octagonal diamond with highlight and shadow facets
 * for a retro 16-bit / 32-bit aesthetic.
 *
 * @param ctx  - Target 2D context (caller handles translate/save/restore)
 * @param r    - Gem radius in pixels
 * @param base - Base hex color (will be shifted for facets)
 */
export function drawGem(
  ctx: CanvasRenderingContext2D,
  r: number,
  base: string,
): void {
  // Pixel-snap helper — round to nearest 2px grid for chunky retro look
  const snap = (v: number): number => Math.round(v / 2) * 2;

  const { dark, light, highlight } = facetColors(base);

  // -- Outer octagon body (base color) ------------------------------------
  const w = snap(r);       // half-width
  const h = snap(r * 1.1); // half-height (slightly taller than wide)
  const c = snap(r * 0.4); // corner cut size

  ctx.beginPath();
  ctx.moveTo(-w + c, -h);
  ctx.lineTo(w - c, -h);
  ctx.lineTo(w, -h + c);
  ctx.lineTo(w, h - c);
  ctx.lineTo(w - c, h);
  ctx.lineTo(-w + c, h);
  ctx.lineTo(-w, h - c);
  ctx.lineTo(-w, -h + c);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();

  // -- Dark bottom-right facets (shadow) ----------------------------------
  ctx.beginPath();
  ctx.moveTo(w - c, h);
  ctx.lineTo(-w + c, h);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w, h - c);
  ctx.lineTo(w - c, h);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w, -h + c);
  ctx.lineTo(w, h - c);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();

  // -- Light top-left facets (highlight) ----------------------------------
  ctx.beginPath();
  ctx.moveTo(-w + c, -h);
  ctx.lineTo(w - c, -h);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w, -h + c);
  ctx.lineTo(-w + c, -h);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w, h - c);
  ctx.lineTo(-w, -h + c);
  ctx.lineTo(0, snap(h * 0.15));
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();

  // -- Small specular highlight (top-left corner) -------------------------
  const hx = snap(-r * 0.3);
  const hy = snap(-r * 0.45);
  const hs = Math.max(2, snap(r * 0.22));
  ctx.fillStyle = highlight;
  ctx.fillRect(hx, hy, hs, hs);
  // Second smaller pixel
  ctx.fillRect(hx + hs, hy - hs, Math.max(2, snap(hs * 0.5)), Math.max(2, snap(hs * 0.5)));

  // -- 1px dark outline for crispness -------------------------------------
  ctx.beginPath();
  ctx.moveTo(-w + c, -h);
  ctx.lineTo(w - c, -h);
  ctx.lineTo(w, -h + c);
  ctx.lineTo(w, h - c);
  ctx.lineTo(w - c, h);
  ctx.lineTo(-w + c, h);
  ctx.lineTo(-w, h - c);
  ctx.lineTo(-w, -h + c);
  ctx.closePath();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Offscreen sprite cache — one canvas per (spriteKey, radius) pair
// ---------------------------------------------------------------------------

const spriteCache = new Map<string, CanvasImageSource>();

/**
 * Get (or create) a cached offscreen sprite for a gem tier.
 * Returns an ImageBitmap-compatible source that can be drawn with drawImage.
 */
export function getGemSprite(
  spriteKey: string,
  radius: number,
  baseColor: string,
): CanvasImageSource {
  const key = `${spriteKey}_${radius}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const size = Math.ceil(radius * 2.4); // enough room for the octagon + outline
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  // Disable smoothing for pixel-art crispness
  ctx.imageSmoothingEnabled = false;
  ctx.translate(size / 2, size / 2);
  drawGem(ctx, radius, baseColor);

  spriteCache.set(key, canvas);
  return canvas;
}

/** Clear the sprite cache (useful on hot-reload). */
export function clearSpriteCache(): void {
  spriteCache.clear();
  recolorCache.clear();
}

// ---------------------------------------------------------------------------
// Recolor / tint system — Canvas 2D composite-based palette swap
// ---------------------------------------------------------------------------

const recolorCache = new Map<string, HTMLCanvasElement>();

/**
 * Recolor an existing gem sprite to a new target color.
 *
 * Uses `globalCompositeOperation` to apply a hue/tint shift:
 *  1. Draw the source sprite (preserves luminance detail & alpha).
 *  2. Overlay the target color with 'source-atop' to replace hue while
 *     keeping the gem's shape.
 *  3. Re-draw the source with 'luminosity' to restore shading depth.
 *
 * Returns a cached HTMLCanvasElement usable with drawImage.
 */
export function recolorSprite(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetColor: string,
): HTMLCanvasElement {
  const key = `recolor_${(source as HTMLCanvasElement).dataset?.spriteKey ?? ''}_${targetColor}`;
  const cached = recolorCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 1. Draw original sprite
  ctx.drawImage(source, 0, 0);

  // 2. Tint: fill target color only where pixels exist (source-atop)
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = targetColor;
  ctx.fillRect(0, 0, sourceWidth, sourceHeight);

  // 3. Restore luminance detail from original
  ctx.globalCompositeOperation = 'luminosity';
  ctx.drawImage(source, 0, 0);

  // Reset composite mode
  ctx.globalCompositeOperation = 'source-over';

  recolorCache.set(key, canvas);
  return canvas;
}

/**
 * Convenience: get a fully tinted gem sprite for a given tier config.
 * Draws the base gem shape at the tier's radius, then recolors to targetColor.
 * If targetColor matches baseColor, returns the original cached sprite canvas.
 */
export function getTintedGemSprite(
  spriteKey: string,
  radius: number,
  baseColor: string,
  targetColor: string,
): CanvasImageSource {
  if (targetColor === baseColor) {
    return getGemSprite(spriteKey, radius, baseColor);
  }

  const cacheKey = `tinted_${spriteKey}_${radius}_${targetColor}`;
  const cached = recolorCache.get(cacheKey);
  if (cached) return cached;

  // Get or create the base sprite
  const base = getGemSprite(spriteKey, radius, baseColor) as HTMLCanvasElement;
  const size = base.width;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 1. Draw original
  ctx.drawImage(base, 0, 0);

  // 2. Overlay target hue (preserves alpha shape)
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = targetColor;
  ctx.fillRect(0, 0, size, size);

  // 3. Restore shading from original
  ctx.globalCompositeOperation = 'luminosity';
  ctx.drawImage(base, 0, 0);

  ctx.globalCompositeOperation = 'source-over';

  recolorCache.set(cacheKey, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------
// Color utilities — derive facet shades from a hex base color
// ---------------------------------------------------------------------------

export function facetColors(hex: string): {
  dark: string;
  light: string;
  highlight: string;
} {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

  return {
    dark: `rgb(${clamp(r * 0.55)},${clamp(g * 0.55)},${clamp(b * 0.55)})`,
    light: `rgb(${clamp(r * 1.3)},${clamp(g * 1.3)},${clamp(b * 1.3)})`,
    highlight: `rgba(255,255,255,0.85)`,
  };
}

/**
 * Parse a hex color string to RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
