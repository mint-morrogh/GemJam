import { mergeQueue, pendingBodies } from './mergeDetector';
import { spawnGem } from './gemSpawner';
import { addMergeAnimation } from './mergeAnimation';
import { emitMergeBurst } from './particles';
import { bodyVel, bodyAngVel, bodyMass, bodyId, setVelocity, setAngularVelocity, dynamicBodies, type Body } from '../physics/planckWorld';
import type { World } from 'planck';

export type MergeCallback = (resultTier: number, rainbow: boolean) => void;

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
      _onMerge?.(-1, false);
      continue;
    }

    // Spawn merged gem with conserved momentum
    const newBody = spawnGem(world, event.midX, event.midY, event.nextTier, event.rainbow);
    setVelocity(newBody, avgVx * 0.5, avgVy * 0.5);
    setAngularVelocity(newBody, avgAng * 0.3);
    addMergeAnimation(newBody, event.midX, event.midY);
    emitMergeBurst(event.midX, event.midY, event.nextTier, event.rainbow);
    spawned.push(newBody);

    _onMerge?.(event.nextTier, event.rainbow);
  }

  return spawned;
}
