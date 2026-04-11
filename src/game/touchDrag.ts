// ---------------------------------------------------------------------------
// Touch-drag stub — drag system disabled (launcher mode only)
// Kept as a module so renderer.ts import doesn't break.
// ---------------------------------------------------------------------------

import { type Body } from '../physics/planckWorld';

export interface DraggedGem {
  body: Body;
  tier: number;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
}

export function getDraggedGem(): DraggedGem | null { return null; }
export function resetDragState(): void {}
export function updateSnapBack(_dt: number): boolean { return false; }
export function cancelDrag(): void {}
