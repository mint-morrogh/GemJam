import { GEM_TIERS } from './gems';
import { createCircle, type Body } from '../physics/planckWorld';
import type { World } from 'planck';

// ---------------------------------------------------------------------------
// Gem body metadata (stored as Planck body userData)
// ---------------------------------------------------------------------------

export interface GemData {
  gemId: number;
  tier: number;
  rainbow: boolean;
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
): Body {
  const def = GEM_TIERS[tier];
  if (!def) throw new RangeError(`Invalid gem tier: ${tier}`);

  // Tier-scaled physics: small gems light & bouncy, big gems heavy anchors
  const t = tier / (GEM_TIERS.length - 1);
  // Gentle density scaling — most mass difference comes from size (radius²)
  // A tier 1 hitting tier 2 is only ~1.5x mass difference, so it can nudge it
  const density = 0.8 + t * 1.2;  // 0.8 → 2.0 linear
  const restitution = 0.5 - t * 0.3;           // 0.50 → 0.20
  const friction = 0.3 + t * 0.2;              // 0.3 → 0.5
  const linearDamping = 0.8 - t * 0.5;         // 0.8 → 0.3
  const angularDamping = 2.0 + t * 1.0;        // 2.0 → 3.0

  const gemData: GemData = { gemId: nextGemId++, tier, rainbow };

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
