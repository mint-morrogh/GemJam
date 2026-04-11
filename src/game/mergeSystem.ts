import { initMergeDetection } from './mergeDetector';
import { processMerges } from './mergeExecutor';
import type { World } from 'planck';

/**
 * Initialise merge detection on a Planck world.
 * Collision detection is handled via world contact events.
 * `processMerges(world)` must be called after each world.step() in the game loop.
 */
export function initMergeSystem(world: World): void {
  initMergeDetection(world);
}

export { processMerges };
