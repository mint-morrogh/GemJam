import type { GemTier, GemMergeMap, GemInstance } from './types';
import { getGemSprite } from './gem-sprites';

// ---------------------------------------------------------------------------
// Gem tier configuration — 10 tiers, small → large
// ---------------------------------------------------------------------------

export const GEM_TIERS: readonly GemTier[] = [
  { id: 0, name: 'Quartz',    radius: 15, baseColor: '#E8E8E8', points: 1,    spriteKey: 'quartz'    },
  { id: 1, name: 'Topaz',     radius: 19, baseColor: '#F5C542', points: 3,    spriteKey: 'topaz'     },
  { id: 2, name: 'Emerald',   radius: 24, baseColor: '#50C878', points: 8,    spriteKey: 'emerald'   },
  { id: 3, name: 'Sapphire',  radius: 29, baseColor: '#2563EB', points: 20,   spriteKey: 'sapphire'  },
  { id: 4, name: 'Ruby',      radius: 35, baseColor: '#DC2626', points: 50,   spriteKey: 'ruby'      },
  { id: 5, name: 'Amethyst',  radius: 41, baseColor: '#9333EA', points: 120,  spriteKey: 'amethyst'  },
  { id: 6, name: 'Diamond',   radius: 48, baseColor: '#67E8F9', points: 300,  spriteKey: 'diamond'   },
  { id: 7, name: 'Opal',      radius: 55, baseColor: '#F472B6', points: 750,  spriteKey: 'opal'      },
  { id: 8, name: 'Obsidian',  radius: 62, baseColor: '#1E1B4B', points: 1800, spriteKey: 'obsidian'  },
  { id: 9, name: 'Celestite', radius: 70, baseColor: '#FBBF24', points: 4500, spriteKey: 'celestite' },
] as const;

// ---------------------------------------------------------------------------
// Merge mapping — Tier N + Tier N → Tier N+1, max tier returns null
// ---------------------------------------------------------------------------

export const MERGE_MAP: GemMergeMap = Object.fromEntries(
  GEM_TIERS.map((g) => [g.id, g.id < GEM_TIERS.length - 1 ? g.id + 1 : null]),
);

// ---------------------------------------------------------------------------
// Factory functions (pure & stateless)
// ---------------------------------------------------------------------------

/**
 * Create a fully resolved gem instance for a given tier id.
 * Looks up tier data, resolves the cached sprite, and returns all properties.
 * Throws if tierId is out of range.
 */
export function createGem(tierId: number): GemInstance {
  const tier = GEM_TIERS[tierId];
  if (!tier) throw new RangeError(`Unknown gem tier id: ${tierId}`);

  return {
    tierId: tier.id,
    name: tier.name,
    radius: tier.radius,
    baseColor: tier.baseColor,
    points: tier.points,
    spriteKey: tier.spriteKey,
    sprite: getGemSprite(tier.spriteKey, tier.radius, tier.baseColor),
  };
}

/**
 * Get the next tier id after merging two gems of the given tier.
 * Returns the resulting GemTier, or null if the tier is terminal (max).
 */
export function getNextTier(tierId: number): GemTier | null {
  const nextId = MERGE_MAP[tierId];
  if (nextId == null) return null;
  return GEM_TIERS[nextId] ?? null;
}
