import { GRID, GEM_TIERS, MAX_SPAWN_TIER } from './gems';
import type { GemDef } from './gems';
import { getGemData } from './gemSpawner';
import { bodyPos, bodyRadius, dynamicBodies } from '../physics/planckWorld';
import type { World } from 'planck';

/** A gem that has been placed on the board (legacy — kept for type compat). */
export interface PlacedGem {
  def: GemDef;
  column: number;
  x: number;
  y: number;
  currentY: number;
  velocityY: number;
  falling: boolean;
}

/** Run stats shown on the game-over screen. */
export interface RunStats {
  mergeCount: number;
  peakTier: number;
  maxCombo: number;
}

export const GEM_QUEUE_DEPTH = 3;

export interface GameState {
  columns: PlacedGem[][];
  gemQueue: GemDef[];
  readonly nextGem: GemDef;
  gameOver: boolean;
  mergeCount: number;
  peakTier: number;
  maxCombo: number;
}

export function randomSpawnGem(): GemDef {
  return GEM_TIERS[Math.floor(Math.random() * (MAX_SPAWN_TIER + 1))];
}

function fillQueue(queue: GemDef[]): void {
  while (queue.length < GEM_QUEUE_DEPTH) {
    queue.push(randomSpawnGem());
  }
}

export function createGameState(): GameState {
  const columns: PlacedGem[][] = [];
  for (let i = 0; i < GRID.columnCount; i++) {
    columns.push([]);
  }
  const gemQueue: GemDef[] = [];
  fillQueue(gemQueue);

  return Object.defineProperty(
    { columns, gemQueue, gameOver: false, mergeCount: 0, peakTier: 0, maxCombo: 0 } as GameState,
    'nextGem',
    { get(this: GameState) { return this.gemQueue[0]; }, enumerable: true },
  );
}

export function consumeNextGem(state: GameState): GemDef {
  const gem = state.gemQueue.shift()!;
  fillQueue(state.gemQueue);
  return gem;
}

export function resetGameState(state: GameState): void {
  for (let i = 0; i < state.columns.length; i++) {
    state.columns[i].length = 0;
  }
  state.gemQueue.length = 0;
  fillQueue(state.gemQueue);
  state.gameOver = false;
  state.mergeCount = 0;
  state.peakTier = 0;
  state.maxCombo = 0;
}

// -- Overflow detection -------------------------------------------------------

export function checkOverflow(world: World): boolean {
  const bodies = dynamicBodies(world);
  for (const body of bodies) {
    if (!getGemData(body)) continue;
    const pos = bodyPos(body);
    const r = bodyRadius(body);
    if (pos.y - r < GRID.containerY) return true;
  }
  return false;
}

const DANGER_ZONE_DEPTH = 120;

export function getDangerLevel(world: World): number {
  const bodies = dynamicBodies(world);
  let highestTopEdge = GRID.containerY + GRID.containerHeight;
  for (const body of bodies) {
    if (!getGemData(body)) continue;
    const pos = bodyPos(body);
    const r = bodyRadius(body);
    const topEdge = pos.y - r;
    if (topEdge < highestTopEdge) highestTopEdge = topEdge;
  }
  const distBelow = highestTopEdge - GRID.containerY;
  if (distBelow >= DANGER_ZONE_DEPTH) return 0;
  if (distBelow <= 0) return 1;
  return 1 - distBelow / DANGER_ZONE_DEPTH;
}

// Legacy — kept for compat but unused with launcher system
export function updateFallingGems(_allGems: readonly PlacedGem[], _dt: number): boolean {
  return false;
}
