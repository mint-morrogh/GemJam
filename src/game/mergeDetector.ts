import { MERGE_MAP, GEM_TIERS } from './gems';
import { getGemData } from './gemSpawner';
import { getTierSkipChance } from './state';
import { checkBlackholeContact } from './blackhole';
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
  tierSkipped: boolean;
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
    // Black hole check — triggers on ANY contact, before merge logic
    checkBlackholeContact(world, bA, bB);

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
    let tierSkipped = false;

    if (dataA.tier === MAX_TIER) {
      if (dataA.rainbow) {
        nextTier = -1;
        rainbow = false;
      } else {
        // Prestige loop — no tier skip allowed
        nextTier = 0;
        rainbow = true;
      }
    } else {
      const mapped = MERGE_MAP[dataA.tier];
      if (mapped === undefined) return;
      nextTier = mapped;
      rainbow = dataA.rainbow;

      // Tier skip: chance to jump one extra tier (not on max tier or prestige boundary)
      const skipChance = getTierSkipChance();
      if (skipChance > 0 && Math.random() < skipChance && nextTier < MAX_TIER && GEM_TIERS[nextTier + 1]) {
        nextTier = nextTier + 1;
        tierSkipped = true;
      }
    }

    pendingBodies.add(idA);
    pendingBodies.add(idB);

    const posA = bodyPos(bA);
    const posB = bodyPos(bB);
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;

    mergeQueue.push({ bodyA: bA, bodyB: bB, nextTier, rainbow, tierSkipped, midX, midY });
  });
}
