// ---------------------------------------------------------------------------
// Offscreen board background cache
// ---------------------------------------------------------------------------
// The board background (container, column dividers, drop zone strip) and the
// score HUD skeleton are static geometry redrawn from scratch every frame.
// This module pre-renders them to an offscreen canvas and blits the result
// with a single drawImage() call per frame — replacing ~40 draw calls.
//
// The cache is invalidated on resize (canvas dimensions change) or when
// the quality tier changes.

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../canvas';
import { drawBoard } from './renderer';

let boardCanvas: HTMLCanvasElement | null = null;
let boardCtx: CanvasRenderingContext2D | null = null;
let cachedWidth = 0;
let cachedHeight = 0;

/** Invalidate the cache (e.g. on resize or tier change). */
export function invalidateBoardCache(): void {
  cachedWidth = 0;
  cachedHeight = 0;
}

/**
 * Get (or rebuild) the cached board background.
 * Returns the offscreen canvas ready for drawImage().
 */
export function getBoardCache(): HTMLCanvasElement {
  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;

  if (boardCanvas && cachedWidth === w && cachedHeight === h) {
    return boardCanvas;
  }

  // Create or resize offscreen canvas
  if (!boardCanvas) {
    boardCanvas = document.createElement('canvas');
    boardCtx = boardCanvas.getContext('2d')!;
  }
  boardCanvas.width = w;
  boardCanvas.height = h;
  cachedWidth = w;
  cachedHeight = h;

  // Clear and render the board background
  boardCtx!.clearRect(0, 0, w, h);
  drawBoard(boardCtx!);

  return boardCanvas;
}
