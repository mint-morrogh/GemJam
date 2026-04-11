import { MERGE_MAP } from './gems';
import { getGemData } from './gemSpawner';
import { onBeginContact, bodyPos, bodyId, type Body } from '../physics/planckWorld';
import type { World } from 'planck';

// ---------------------------------------------------------------------------
// Merge event
// ---------------------------------------------------------------------------

export interface MergeEvent {
  bodyA: Body;
  bodyB: Body;
  nextTier: number;
  rainbow: boolean;
  midX: number;
  midY: number;
}

export const mergeQueue: MergeEvent[] = [];
export const pendingBodies = new Set<number>();

export function resetMergeQueue(): void {
  mergeQueue.length = 0;
  pendingBodies.clear();
}

const MAX_TIER = 11;

// ---------------------------------------------------------------------------
// Collision listener
// ---------------------------------------------------------------------------

export function initMergeDetection(world: World): void {
  onBeginContact(world, (bA, bB) => {
    const dataA = getGemData(bA);
    const dataB = getGemData(bB);
    if (!dataA || !dataB) return;
    if (bA.isStatic() || bB.isStatic()) return;
    if (dataA.tier !== dataB.tier) return;
    if (dataA.rainbow !== dataB.rainbow) return;

    const idA = bodyId(bA);
    const idB = bodyId(bB);
    if (pendingBodies.has(idA) || pendingBodies.has(idB)) return;

    let nextTier: number;
    let rainbow: boolean;

    if (dataA.tier === MAX_TIER) {
      if (dataA.rainbow) {
        nextTier = -1;
        rainbow = false;
      } else {
        nextTier = 0;
        rainbow = true;
      }
    } else {
      const mapped = MERGE_MAP[dataA.tier];
      if (mapped === undefined) return;
      nextTier = mapped;
      rainbow = dataA.rainbow;
    }

    pendingBodies.add(idA);
    pendingBodies.add(idB);

    const posA = bodyPos(bA);
    const posB = bodyPos(bB);
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;

    mergeQueue.push({ bodyA: bA, bodyB: bB, nextTier, rainbow, midX, midY });
  });
}
