// ---------------------------------------------------------------------------
// Black Hole gem mechanic — animated suck-in sequence
// ---------------------------------------------------------------------------
// On first contact, the blackhole activates. Over ~0.8s it pulls all
// same-tier gems toward itself (ignoring physics collisions). Once they
// arrive, they're absorbed, score is awarded, and the blackhole becomes
// one tier up.

import { GEM_TIERS, MERGE_MAP } from './gems';
import { getGemData, spawnGem } from './gemSpawner';
import { bodyPos, dynamicBodies, setVelocity, type Body } from '../physics/planckWorld';
import { emitMergeBurst } from './particles';
import { addMergeAnimation } from './mergeAnimation';
import { Vec2 } from 'planck';
import type { World } from 'planck';

export type BlackholeCallback = (
  tier: number, absorbed: number, totalPoints: number, x: number, y: number,
) => void;

let _onBlackhole: BlackholeCallback | null = null;
export function setOnBlackhole(cb: BlackholeCallback): void { _onBlackhole = cb; }

const triggered = new Set<number>();

// ---------------------------------------------------------------------------
// Active black hole animations
// ---------------------------------------------------------------------------

interface ActiveBlackhole {
  world: World;
  body: Body;
  tier: number;
  victims: Body[];
  elapsed: number;
  duration: number;
  done: boolean;
}

const active: ActiveBlackhole[] = [];

/** Is there an active black hole animation running? */
export function hasActiveBlackhole(): boolean { return active.length > 0; }

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

export function checkBlackholeContact(world: World, bodyA: Body, bodyB: Body): void {
  tryActivate(world, bodyA);
  tryActivate(world, bodyB);
}

function tryActivate(world: World, body: Body): void {
  const data = getGemData(body);
  if (!data || !data.blackhole) return;
  if (triggered.has(data.gemId)) return;
  triggered.add(data.gemId);
  data.blackhole = false;

  const tier = data.tier;

  // Find all same-tier gems
  const victims: Body[] = [];
  for (const b of dynamicBodies(world)) {
    if (b === body) continue;
    const d = getGemData(b);
    if (!d || d.tier !== tier) continue;
    victims.push(b);
  }

  active.push({
    world,
    body,
    tier,
    victims,
    elapsed: 0,
    duration: 0.8,
    done: false,
  });
}

// ---------------------------------------------------------------------------
// Per-frame update — pull victims toward the black hole
// ---------------------------------------------------------------------------

export function updateBlackholes(dt: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const bh = active[i];
    bh.elapsed += dt;
    const t = Math.min(bh.elapsed / bh.duration, 1); // 0→1

    const bhPos = bodyPos(bh.body);

    // Pull each victim toward the black hole center
    for (const v of bh.victims) {
      const vPos = bodyPos(v);
      const dx = bhPos.x - vPos.x;
      const dy = bhPos.y - vPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) continue;

      // Accelerating pull — gets faster as t increases
      const pullStrength = (2 + t * 15) * 60; // pixels/sec
      const nx = dx / dist;
      const ny = dy / dist;

      // Override velocity directly toward black hole (ignores physics walls)
      v.setLinearVelocity(Vec2(nx * pullStrength / 30, ny * pullStrength / 30));

      // Small burst as they get close
      if (dist < 15 && t > 0.3) {
        emitMergeBurst(vPos.x, vPos.y, bh.tier, false);
      }
    }

    // Finalize when animation complete
    if (t >= 1 && !bh.done) {
      bh.done = true;
      finalize(bh);
      active.splice(i, 1);
    }
  }
}

function finalize(bh: ActiveBlackhole): void {
  const { world, body, tier, victims } = bh;
  const pos = bodyPos(body);
  const def = GEM_TIERS[tier];
  if (!def) return;

  const absorbed = victims.length;
  const totalPoints = def.points * (absorbed + 1) * (absorbed + 1);

  // Remove all victims
  for (const v of victims) {
    try { world.destroyBody(v); } catch { /* already destroyed */ }
  }

  // Remove blackhole body
  try { world.destroyBody(body); } catch { /* already destroyed */ }

  // Spawn result one tier up
  const nextTier = MERGE_MAP[tier] ?? tier;
  const newBody = spawnGem(world, pos.x, pos.y, nextTier);
  setVelocity(newBody, 0, -30);
  addMergeAnimation(newBody, pos.x, pos.y);

  // Big explosion bursts
  emitMergeBurst(pos.x, pos.y, nextTier, false);
  emitMergeBurst(pos.x, pos.y, Math.min(tier + 3, 11), false);

  _onBlackhole?.(tier, absorbed, totalPoints, pos.x, pos.y);
}

// ---------------------------------------------------------------------------
// Rendering — draw swirling vortex during active black holes
// ---------------------------------------------------------------------------

export function drawActiveBlackholes(ctx: CanvasRenderingContext2D, time: number): void {
  for (const bh of active) {
    const pos = bodyPos(bh.body);
    const t = bh.elapsed / bh.duration;
    const r = 20 + t * 40;
    const spin = time * 8;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Dark vortex core
    ctx.globalAlpha = 0.6 + t * 0.3;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, '#0a0015');
    grad.addColorStop(0.4, '#2d1050');
    grad.addColorStop(0.7, '#6B21A8');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Spinning arms
    ctx.globalAlpha = 0.3 + t * 0.2;
    for (let a = 0; a < 4; a++) {
      const angle = spin + (Math.PI * 2 * a) / 4;
      ctx.save();
      ctx.rotate(angle);
      const armGrad = ctx.createLinearGradient(0, 0, r * 1.2, 0);
      armGrad.addColorStop(0, '#C084FC');
      armGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = armGrad;
      ctx.fillRect(0, -2, r * 1.2, 4);
      ctx.restore();
    }

    ctx.restore();
  }
}

export function resetBlackholeTracker(): void {
  triggered.clear();
  active.length = 0;
}
