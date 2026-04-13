import { GRID, GEM_TIERS, MAX_SPAWN_TIER } from './gems';
import type { GemDef } from './gems';
import { getGemData } from './gemSpawner';
import { bodyPos, bodyRadius, bodySpeed, dynamicBodies } from '../physics/planckWorld';
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

export const GEM_QUEUE_DEPTH = 7;

export interface GameState {
  columns: PlacedGem[][];
  gemQueue: SpawnResult[];
  readonly nextGem: SpawnResult;
  gameOver: boolean;
  mergeCount: number;
  peakTier: number;
  maxCombo: number;
}

/** Extra spawn chance for tier 4 (garnet), driven by shop upgrades. */
let garnetChance = 0;
export function getGarnetChance(): number { return garnetChance; }
export function setGarnetChance(v: number): void { garnetChance = v; }

/** Chance to spawn a heavy gem variant. */
let heavyChance = 0;
export function getHeavyChance(): number { return heavyChance; }
export function setHeavyChance(v: number): void { heavyChance = v; }

/** Chance to spawn a bonus (5x score) gem. */
let bonusChance = 0;
export function getBonusChance(): number { return bonusChance; }
export function setBonusChance(v: number): void { bonusChance = v; }

/** Chance a merge jumps one extra tier. */
let tierSkipChance = 0;
export function getTierSkipChance(): number { return tierSkipChance; }
export function setTierSkipChance(v: number): void {
  tierSkipChance = v;
  console.log(`[TIER SKIP] chance set to ${(v * 100).toFixed(2)}%`);
}

/** Chance to spawn a black hole gem. */
let blackholeChance = 0;
export function getBlackholeChance(): number { return blackholeChance; }
export function setBlackholeChance(v: number): void { blackholeChance = v; }

/** Chance for a merge to cause an explosion that pushes nearby gems. */
let explosionChance = 0;
export function getExplosionChance(): number { return explosionChance; }
export function setExplosionChance(v: number): void { explosionChance = v; }

/** Chance to spawn a bonus gem nearby on merge. */
let bonusGemSpawnChance = 0;
export function getBonusGemSpawnChance(): number { return bonusGemSpawnChance; }
export function setBonusGemSpawnChance(v: number): void { bonusGemSpawnChance = v; }

export interface SpawnResult { def: GemDef; heavy: boolean; bonus: boolean; blackhole: boolean; }

export function randomSpawnGem(): SpawnResult {
  const heavy = heavyChance > 0 && Math.random() < heavyChance;
  const bonus = bonusChance > 0 && Math.random() < bonusChance;
  const blackhole = !heavy && !bonus && blackholeChance > 0 && Math.random() < blackholeChance;
  if (garnetChance > 0 && Math.random() < garnetChance) {
    return { def: GEM_TIERS[MAX_SPAWN_TIER + 1], heavy, bonus, blackhole };
  }
  return { def: GEM_TIERS[Math.floor(Math.random() * (MAX_SPAWN_TIER + 1))], heavy, bonus, blackhole };
}

function fillQueue(queue: SpawnResult[]): void {
  while (queue.length < GEM_QUEUE_DEPTH) {
    queue.push(randomSpawnGem());
  }
}

export function createGameState(): GameState {
  const columns: PlacedGem[][] = [];
  for (let i = 0; i < GRID.columnCount; i++) {
    columns.push([]);
  }
  const gemQueue: SpawnResult[] = [];
  fillQueue(gemQueue);

  return Object.defineProperty(
    { columns, gemQueue, gameOver: false, mergeCount: 0, peakTier: 0, maxCombo: 0 } as GameState,
    'nextGem',
    { get(this: GameState) { return this.gemQueue[0]; }, enumerable: true },
  );
}

export function consumeNextGem(state: GameState): SpawnResult {
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

/** Speed threshold — gems slower than this trigger overflow/danger.
 *  Lower = stricter (only fully resting), higher = catches slow-rolling gems too. */
const SETTLED_SPEED = 120;

export function checkOverflow(world: World): boolean {
  const bodies = dynamicBodies(world);
  for (const body of bodies) {
    if (!getGemData(body)) continue;
    if (bodySpeed(body) > SETTLED_SPEED) continue; // skip gems still in flight
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
    if (bodySpeed(body) > SETTLED_SPEED) continue; // skip gems still in flight
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
