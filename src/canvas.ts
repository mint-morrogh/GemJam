import { refreshDpr, getDpr } from './game/renderConfig';

/** Whether the initial viewport is portrait mobile (<=768px wide). */
export const IS_PORTRAIT = window.innerWidth <= 768 && window.innerWidth < window.innerHeight;

/** Virtual resolution — all game drawing uses these coordinates.
 *  Portrait mobile uses a taller virtual space so the board fills ~65% of height. */
export const VIRTUAL_WIDTH = IS_PORTRAIT ? 480 : 1280;
export const VIRTUAL_HEIGHT = IS_PORTRAIT ? 960 : 720;
export const ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;

export interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** Create a <canvas> element with a 2D context, styled for letterbox/pillarbox centering. */
export function createCanvas(): CanvasHandle {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.style.position = 'absolute';
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';
  canvas.style.background = '#080a12';

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D rendering context');

  applyLetterboxStyle();
  sizeCanvas(canvas, ctx);

  return { canvas, ctx };
}

/** Set page background to black for letterbox/pillarbox bars. */
function applyLetterboxStyle(): void {
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';
  document.body.style.background = '#080a12';
  document.body.style.width = '100dvw';
  document.body.style.height = '100dvh';
  document.body.style.position = 'relative';
}

/** Max canvas CSS width on desktop to prevent the game from stretching
 *  across ultra-wide monitors. Matches the #app max-width breakpoint. */
const MAX_DESKTOP_WIDTH = 1400;

/**
 * Calculate CSS dimensions that fit the viewport while preserving aspect ratio.
 * On desktop (>=769px), caps width to MAX_DESKTOP_WIDTH so the board centers
 * at a comfortable size rather than filling enormous screens.
 */
function fitToViewport(): { cssWidth: number; cssHeight: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Cap width on desktop screens to match the CSS max-width breakpoint
  const effectiveWidth = (!IS_PORTRAIT && vw >= 769) ? Math.min(vw, MAX_DESKTOP_WIDTH) : vw;

  let cssWidth = effectiveWidth;
  let cssHeight = effectiveWidth / ASPECT_RATIO;

  if (cssHeight > vh) {
    cssHeight = vh;
    cssWidth = vh * ASPECT_RATIO;
  }

  return { cssWidth, cssHeight };
}

/**
 * Update --game-width and --game-height CSS custom properties on :root.
 * Called on every resize/orientationchange so layout CSS can react.
 */
function updateGameSizeProperties(cssWidth: number, cssHeight: number): void {
  const root = document.documentElement;
  root.style.setProperty('--game-width', `${Math.round(cssWidth)}px`);
  root.style.setProperty('--game-height', `${Math.round(cssHeight)}px`);
}

/**
 * Set canvas buffer size to virtualRes * DPR, apply CSS fit dimensions,
 * and scale the context so all draw commands use virtual coordinates.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  // Refresh renderConfig with virtual dimensions so DPR cap + pixel budget apply
  refreshDpr(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  const dpr = getDpr(); // capped DPR (respects maxDpr + pixel budget)
  const { cssWidth, cssHeight } = fitToViewport();

  // Buffer size = virtual resolution * capped DPR
  // On DPR-3 devices with cap=2: 1280×2 × 720×2 = 3.7M px (vs 8.3M uncapped)
  canvas.width = VIRTUAL_WIDTH * dpr;
  canvas.height = VIRTUAL_HEIGHT * dpr;

  // CSS size fits the viewport while maintaining aspect ratio (layout unchanged)
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  // Scale context so drawing commands use virtual coordinates
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Expose current game dimensions as CSS custom properties
  updateGameSizeProperties(cssWidth, cssHeight);
}

export interface VirtualPoint {
  x: number;
  y: number;
}

/**
 * Convert screen clientX/clientY to virtual-resolution coordinates.
 * Accounts for canvas offset and CSS-to-virtual scaling.
 */
export function screenToVirtual(canvas: HTMLCanvasElement, clientX: number, clientY: number): VirtualPoint {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * VIRTUAL_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT;
  return { x, y };
}

/**
 * Attach resize + orientationchange listeners that recalculate canvas layout.
 * orientationchange uses a short delay because some mobile browsers don't
 * update viewport dimensions synchronously with the event.
 * Returns a cleanup function to remove the listeners.
 */
export function initResize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): () => void {
  const onResize = () => sizeCanvas(canvas, ctx);
  let orientationTimer = 0;
  const onOrientationChange = () => {
    // Immediate resize for fast feedback
    onResize();
    // Deferred resize to catch delayed viewport dimension updates
    clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(onResize, 150);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientationChange);
  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    clearTimeout(orientationTimer);
  };
}
