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

const MAX_TIER = 10;

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

    // Essence wildcard bypass — essence merges with ANY gem regardless of
    // tier or rainbow status. Checked before the normal same-tier gate.
    const isEssenceMerge = dataA.essence || dataB.essence;
    if (!isEssenceMerge) {
      if (dataA.tier !== dataB.tier) return;
      if (dataA.rainbow !== dataB.rainbow) return;
    }

    const idA = bodyId(bA);
    const idB = bodyId(bB);
    if (pendingBodies.has(idA) || pendingBodies.has(idB)) return;

    let nextTier: number;
    let rainbow: boolean;
    let tierSkipped = false;

    if (isEssenceMerge) {
      // Promote whichever gem is the "hit" target: if exactly one is essence,
      // the other's tier is used; if both essence, pick the higher-tier essence
      // (typically both are tier 1, so tier 2 is the result). Rainbow state
      // carries from the hit gem. MAX_TIER hit triggers the prestige cycle.
      const hit = dataA.essence && dataB.essence
        ? (dataA.tier >= dataB.tier ? dataA : dataB)
        : (dataA.essence ? dataB : dataA);
      if (hit.tier === MAX_TIER) {
        if (hit.rainbow) { nextTier = -1; rainbow = false; }
        else { nextTier = 0; rainbow = true; }
      } else {
        nextTier = hit.tier + 1;
        rainbow = hit.rainbow;
      }
    } else if (dataA.tier === MAX_TIER) {
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
      const canSkip = skipChance > 0 && nextTier < MAX_TIER && !!GEM_TIERS[nextTier + 1];
      const roll = Math.random();
      console.log(`[MERGE] tier ${dataA.tier}→${nextTier} skipChance=${(skipChance * 100).toFixed(1)}% canSkip=${canSkip} roll=${(roll * 100).toFixed(1)}%`);
      if (canSkip && roll < skipChance) {
        nextTier = nextTier + 1;
        tierSkipped = true;
        console.log(`[TIER SKIP] PROC! → tier ${nextTier}`);
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
