import { mergeQueue, pendingBodies } from './mergeDetector';
import { spawnGem, getGemData } from './gemSpawner';
import { getBonusGemSpawnChance, getExplosionChance } from './state';
import { addMergeAnimation, triggerScreenShake } from './mergeAnimation';
import { emitMergeBurst } from './particles';
import { bodyVel, bodyAngVel, bodyMass, bodyPos, bodyId, setVelocity, setAngularVelocity, dynamicBodies, type Body } from '../physics/planckWorld';
import { Vec2 } from 'planck';
import type { World } from 'planck';

export type MergeCallback = (resultTier: number, rainbow: boolean, midX: number, midY: number, bonusMerge: boolean, tierSkipped: boolean, bonusGemSpawned: boolean, exploded: boolean) => void;

let _onMerge: MergeCallback | null = null;

export function setOnMerge(cb: MergeCallback): void {
  _onMerge = cb;
}

export function processMerges(world: World): Body[] {
  const spawned: Body[] = [];

  while (mergeQueue.length > 0) {
    const event = mergeQueue.shift()!;

    // Guard: skip if either body was already removed
    const inWorld = dynamicBodies(world);
    const aExists = inWorld.includes(event.bodyA);
    const bExists = inWorld.includes(event.bodyB);

    pendingBodies.delete(bodyId(event.bodyA));
    pendingBodies.delete(bodyId(event.bodyB));

    if (!aExists || !bExists) continue;

    // Check bonus flag before destroying
    const dataA = getGemData(event.bodyA);
    const dataB = getGemData(event.bodyB);
    const bonusMerge = !!(dataA?.bonus || dataB?.bonus);

    // Capture momentum before removing sources
    const mA = bodyMass(event.bodyA);
    const mB = bodyMass(event.bodyB);
    const total = mA + mB;
    const vA = bodyVel(event.bodyA);
    const vB = bodyVel(event.bodyB);
    const avgVx = (vA.x * mA + vB.x * mB) / total;
    const avgVy = (vA.y * mA + vB.y * mB) / total;
    const avgAng = (bodyAngVel(event.bodyA) * mA + bodyAngVel(event.bodyB) * mB) / total;

    // Remove both source bodies
    world.destroyBody(event.bodyA);
    world.destroyBody(event.bodyB);

    if (event.nextTier === -1) {
      emitMergeBurst(event.midX, event.midY, 11);
      _onMerge?.(-1, false, event.midX, event.midY, bonusMerge, false, false, false);
      continue;
    }

    // Spawn merged gem with conserved momentum (bonus NOT inherited)
    const newBody = spawnGem(world, event.midX, event.midY, event.nextTier, event.rainbow);
    setVelocity(newBody, avgVx * 0.5, avgVy * 0.5);
    setAngularVelocity(newBody, avgAng * 0.3);
    addMergeAnimation(newBody, event.midX, event.midY, dataA?.tier ?? -1);
    emitMergeBurst(event.midX, event.midY, event.nextTier, event.rainbow);
    spawned.push(newBody);

    // Bonus gem spawn
    let bonusGemSpawned = false;
    const bgsChance = getBonusGemSpawnChance();
    if (bgsChance > 0 && Math.random() < bgsChance) {
      const bonusTier = Math.max(0, event.nextTier - 2 - Math.floor(Math.random() * 2));
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = 30 + Math.random() * 20;
      const bx = event.midX + Math.cos(offsetAngle) * offsetDist;
      const by = event.midY + Math.sin(offsetAngle) * offsetDist;
      const bonusBody = spawnGem(world, bx, by, bonusTier);
      setVelocity(bonusBody, Math.cos(offsetAngle) * 80, Math.sin(offsetAngle) * 80 - 50);
      spawned.push(bonusBody);
      bonusGemSpawned = true;
    }

    // Explosion: massive shockwave that rattles the whole well
    let exploded = false;
    const expChance = getExplosionChance();
    if (expChance > 0 && Math.random() < expChance) {
      exploded = true;
      const tier = event.nextTier;
      // Huge radius — covers most of the well. Force scales hard with tier.
      const blastRadius = 300 + tier * 30;
      const blastForce = 800 + tier * 400;

      for (const b of dynamicBodies(world)) {
        if (b === newBody) continue;
        if (!getGemData(b)) continue;
        if (!b.isAwake()) b.setAwake(true);
        const bPos = bodyPos(b);
        const dx = bPos.x - event.midX;
        const dy = bPos.y - event.midY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;

        // Everything in range gets blasted — falloff is gentle
        const falloff = dist < blastRadius ? (1 - dist / blastRadius) : 0;
        if (falloff <= 0) continue;
        const force = blastForce * falloff;
        const nx = dx / dist;
        const ny = dy / dist;
        b.applyLinearImpulse(
          Vec2(nx * force / 30, (ny - 0.3) * force / 30),
          b.getWorldCenter(),
          true,
        );
      }

      // Heavy screen shake — scales with tier
      triggerScreenShake(5 + tier * 2, 6);

      // Big explosion visuals — 4 layered particle bursts
      emitMergeBurst(event.midX, event.midY, Math.min(tier + 3, 11), event.rainbow);
      emitMergeBurst(event.midX, event.midY, Math.min(tier + 2, 11), event.rainbow);
      emitMergeBurst(event.midX, event.midY, Math.min(tier + 1, 11), event.rainbow);
      emitMergeBurst(event.midX, event.midY, tier, event.rainbow);
    }

    _onMerge?.(event.nextTier, event.rainbow, event.midX, event.midY, bonusMerge, event.tierSkipped, bonusGemSpawned, exploded);
  }

  return spawned;
}
