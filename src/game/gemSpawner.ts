import { GEM_TIERS } from './gems';
import { createCircle, type Body } from '../physics/planckWorld';
import { getBounceBonus } from './shop';
import type { World } from 'planck';

// ---------------------------------------------------------------------------
// Gem body metadata (stored as Planck body userData)
// ---------------------------------------------------------------------------

export interface GemData {
  gemId: number;
  tier: number;
  rainbow: boolean;
  /** Heavy gems have massive weight — push everything out of the way. */
  heavy: boolean;
  /** Bonus gems score 5x points on merge. */
  bonus: boolean;
  /** Black hole gem — absorbs all same-tier gems on first contact. */
  blackhole: boolean;
}

let nextGemId = 1;

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

export function spawnGem(
  world: World,
  x: number,
  y: number,
  tier: number,
  rainbow = false,
  heavy = false,
): Body {
  const def = GEM_TIERS[tier];
  if (!def) throw new RangeError(`Invalid gem tier: ${tier}`);

  const t = tier / (GEM_TIERS.length - 1);
  const baseDensity = 0.8 + t * 1.2;
  // Heavy gems: 20x density — they smash through everything to the bottom
  const density = heavy ? baseDensity * 20 : baseDensity;
  const restitution = Math.min(0.95, (heavy ? 0.15 : (0.5 - t * 0.3)) + getBounceBonus());
  const friction = 0.3 + t * 0.2;
  const linearDamping = heavy ? 0.1 : (0.8 - t * 0.5);
  const angularDamping = 2.0 + t * 1.0;

  const gemData: GemData = { gemId: nextGemId++, tier, rainbow, heavy, bonus: false, blackhole: false };

  return createCircle(world, x, y, def.radius, {
    density,
    friction,
    restitution,
    linearDamping,
    angularDamping,
    userData: gemData,
  });
}

// ---------------------------------------------------------------------------
// Metadata access
// ---------------------------------------------------------------------------

export function getGemData(body: Body): GemData | undefined {
  const ud = body.getUserData();
  if (ud && typeof ud === 'object' && 'gemId' in (ud as any)) return ud as GemData;
  return undefined;
}

export function setGemTier(body: Body, tier: number): void {
  const data = getGemData(body);
  if (data) data.tier = tier;
}
