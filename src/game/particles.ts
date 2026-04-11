// ---------------------------------------------------------------------------
// Lightweight particle system engine
// ---------------------------------------------------------------------------

/** Configuration for spawning a single particle. */
export interface ParticleConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Total lifetime in seconds. */
  lifetime: number;
  /** CSS color string (e.g. '#FF0000' or 'rgba(255,0,0,1)'). */
  color: string;
  /** Starting alpha (0–1). Fades to 0 over lifetime. */
  alpha: number;
  /** Radius in virtual pixels. */
  size: number;
  /** Gravity applied per second² (positive = down). Default 0. */
  gravity?: number;
  /** Size multiplier at end of life (1 = no change). Default 0 (shrink to nothing). */
  endSizeMult?: number;
}

/** Internal live particle state. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  age: number;
  color: string;
  alpha: number;
  size: number;
  gravity: number;
  endSizeMult: number;
}

/** Max active particles across the entire system (pool cap). */
const MAX_PARTICLES = 500;

/**
 * A lightweight canvas particle system.
 * Spawns, updates, and renders small circular particles with position,
 * velocity, lifetime, color, alpha fade, and size interpolation.
 */
export class ParticleSystem {
  private particles: Particle[] = [];

  /** Number of currently alive particles. */
  get count(): number {
    return this.particles.length;
  }

  /** Spawn a single particle. Oldest particles are culled if pool is full. */
  spawn(cfg: ParticleConfig): void {
    if (this.particles.length >= MAX_PARTICLES) {
      // Overwrite oldest particle in-place (O(1) vs shift's O(n))
      this.particles[0] = this.particles[this.particles.length - 1];
      this.particles.pop();
    }

    this.particles.push({
      x: cfg.x,
      y: cfg.y,
      vx: cfg.vx,
      vy: cfg.vy,
      lifetime: cfg.lifetime,
      age: 0,
      color: cfg.color,
      alpha: cfg.alpha,
      size: cfg.size,
      gravity: cfg.gravity ?? 0,
      endSizeMult: cfg.endSizeMult ?? 0,
    });
  }

  /** Spawn multiple particles at once from an array of configs. */
  spawnBatch(configs: ParticleConfig[]): void {
    for (const cfg of configs) {
      this.spawn(cfg);
    }
  }

  /**
   * Advance all particles by `dt` seconds.
   * Applies velocity, gravity, aging; removes expired particles.
   */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;

      if (p.age >= p.lifetime) {
        // Remove expired particle (swap with last for O(1) removal)
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      // Physics
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /** Render all alive particles onto the canvas. */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();

    for (const p of this.particles) {
      const t = p.age / p.lifetime; // 0 → 1 progress
      const alpha = p.alpha * (1 - t); // linear fade
      if (alpha <= 0.01) continue;

      const sizeMult = 1 + (p.endSizeMult - 1) * t; // lerp from 1 → endSizeMult
      const r = p.size * sizeMult;
      if (r <= 0.1) continue;

      // Soft glow halo — always white to avoid dark halos
      if (r > 2.5) {
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Bright white core on large particles
      if (r > 3) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /** Remove all particles. */
  clear(): void {
    this.particles.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Global singleton — shared across all game effects
// ---------------------------------------------------------------------------

export const particles = new ParticleSystem();

// ---------------------------------------------------------------------------
// Merge-burst effect
// ---------------------------------------------------------------------------

import { GEM_TIERS } from './gems';
import { getSettings } from './settings';
import { getGemData } from './gemSpawner';
import { getQualityPreset } from './renderConfig';
import { bodyPos, bodySpeed, bodyId, type Body } from '../physics/planckWorld';

/**
 * Spawn a radial burst of particles at a merge point.
 * Particle count, speed, and size scale with gem tier for visual distinction.
 * @param x       Merge midpoint X (virtual coords)
 * @param y       Merge midpoint Y (virtual coords)
 * @param tier    Tier index of the *source* gems (the ones that were consumed)
 */
/** Rainbow hue palette for rainbow merge particles. */
const RAINBOW_COLORS = ['#FF2D55', '#FF6B2D', '#FFD52D', '#2DFF6A', '#2DD4FF', '#9B3FE8', '#F472B6'];

/** Pick a random rainbow color. */
function randomRainbow(): string {
  return RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)];
}

export function emitMergeBurst(x: number, y: number, tier: number, rainbow = false): void {
  if (!getSettings().showParticles || !getQualityPreset().particles) return;
  const def = GEM_TIERS[tier];
  if (!def) return;

  // Rock tiers (0-3): gray/white particles. Gem tiers (4+): tier color. Rainbow: rainbow.
  const isRock = tier <= 3;
  const ROCK_COLORS = ['#C0B8A8', '#A0A0A0', '#D0D0D0', '#FFFFFF'];
  const getColor = rainbow
    ? randomRainbow
    : isRock
      ? () => ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)]
      : () => def.color;

  // --- Main burst: dense colored particles radiating outward ---
  const gemR = def.radius;
  const spread = gemR * 0.6; // particles spawn from within the gem edge
  const count = 20 + tier * 5;
  const speed = 120 + tier * 40;
  const baseSize = 3.5 + tier * 0.9;
  const lifetime = 0.2 + tier * 0.025;
  const gravity = 100 + tier * 20;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const spd = speed * (0.5 + Math.random() * 1.0);
    const sz = baseSize * (0.4 + Math.random() * 1.2);

    particles.spawn({
      x: x + Math.cos(angle) * spread * Math.random(),
      y: y + Math.sin(angle) * spread * Math.random(),
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      lifetime: lifetime * (0.7 + Math.random() * 0.6),
      color: getColor(),
      alpha: 1,
      size: sz,
      gravity,
      endSizeMult: 0.05,
    });
  }

  // --- White sparks: fast bright points ---
  const sparkCount = 8 + tier * 3;                     // 8–41 sparks
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = speed * (0.5 + Math.random() * 1.0);
    particles.spawn({
      x: x + Math.cos(angle) * spread * 0.5,
      y: y + Math.sin(angle) * spread * 0.5,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      lifetime: lifetime * 0.4,
      color: rainbow ? getColor() : '#FFFFFF',
      alpha: 1,
      size: baseSize * 0.5,
      gravity: gravity * 0.2,
      endSizeMult: 0,
    });
  }

  // --- Inner flash ring: tight burst of bright particles (all tiers) ---
  {
    const ringCount = 6 + tier * 2;
    for (let i = 0; i < ringCount; i++) {
      const angle = (Math.PI * 2 * i) / ringCount;
      const spd = speed * 0.3;
      particles.spawn({
        x: x + Math.cos(angle) * spread * 0.3,
        y: y + Math.sin(angle) * spread * 0.3,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        lifetime: lifetime * 0.3,
        color: '#FFFFFF',
        alpha: 0.9,
        size: baseSize * 1.5,
        gravity: 0,
        endSizeMult: 2.5, // expands then fades
      });
    }
  }

  // --- Slow floaters: large soft particles that linger (tier 3+) ---
  if (tier >= 3) {
    const floatCount = 5 + tier;
    for (let i = 0; i < floatCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 40;
      particles.spawn({
        x: x + Math.cos(angle) * spread,
        y: y + Math.sin(angle) * spread,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 20,
        lifetime: lifetime * 2,
        color: getColor(),
        alpha: 0.5,
        size: baseSize * 2.5,
        gravity: -15,
        endSizeMult: 0.2,
      });
    }
  }

  // --- Confetti: tiny fast particles in random directions (tier 5+) ---
  if (tier >= 5) {
    const confettiCount = 10 + tier * 3;
    for (let i = 0; i < confettiCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.8 + Math.random() * 1.2);
      particles.spawn({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 40,
        lifetime: lifetime * 1.2,
        color: rainbow ? randomRainbow() : (Math.random() < 0.3 ? '#FFFFFF' : getColor()),
        alpha: 0.9,
        size: 1.5 + Math.random() * 2,
        gravity: 200 + Math.random() * 100,
        endSizeMult: 0,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Idle gem sparkles — glimmering effect on gem tiers (4+)
// ---------------------------------------------------------------------------

/** Accumulated time for sparkle scheduling. */
let sparkleAccum = 0;
const SPARKLE_INTERVAL = 0.2; // check every 200ms

/**
 * Shimmer data — bright flash points that appear ON the gem surface.
 * Drawn by the renderer, not as particles (so they stay attached to the gem).
 */
export interface Shimmer {
  bodyRef: Body;
  /** Offset from body center (polar coords stored as x/y for speed). */
  offX: number;
  offY: number;
  age: number;
  lifetime: number;
  size: number;
}

const shimmers: Shimmer[] = [];
const MAX_SHIMMERS = 60;

/** Get active shimmers for rendering. */
export function getShimmers(): readonly Shimmer[] { return shimmers; }

/**
 * Update sparkles + shimmers. Call each update tick.
 * Spawns particles that drift away AND shimmers that flash on the gem surface.
 */
export function updateGemSparkles(
  dt: number,
  bodies: readonly Body[],
): void {
  // Update existing shimmers
  for (let i = shimmers.length - 1; i >= 0; i--) {
    shimmers[i].age += dt;
    if (shimmers[i].age >= shimmers[i].lifetime) {
      shimmers[i] = shimmers[shimmers.length - 1];
      shimmers.pop();
    }
  }

  if (!getSettings().showParticles || !getQualityPreset().particles) return;

  sparkleAccum += dt;
  if (sparkleAccum < SPARKLE_INTERVAL) return;
  sparkleAccum -= SPARKLE_INTERVAL;

  for (const body of bodies) {
    if (body.isStatic()) continue;
    const data = getGemData(body);
    if (!data || data.tier < 4) continue; // tier 4+ (garnet and up) — gems only, not rocks
    if (bodySpeed(body) > 3) continue;

    const def = GEM_TIERS[data.tier];
    if (!def) continue;

    // Lower chance — gentle twinkle, not a rave
    const chance = 0.06 + (data.tier - 2) * 0.03; // 6% → 33%
    if (Math.random() > chance) continue;

    const pos = bodyPos(body);
    const angle = Math.random() * Math.PI * 2;
    const dist = def.radius * (0.2 + Math.random() * 0.7);
    const tierScale = 1 + data.tier * 0.08; // slightly bigger sparkles on higher tiers

    // Drifting sparkle particle — always white or gem color, never black
    particles.spawn({
      x: pos.x + Math.cos(angle) * dist,
      y: pos.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 12,
      vy: -15 - Math.random() * 20,
      lifetime: 0.2 + Math.random() * 0.15,
      color: '#FFFFFF',
      alpha: 0.7 + Math.random() * 0.3,
      size: (1.5 + Math.random() * 1.5) * tierScale,
      gravity: -5,
      endSizeMult: 0,
    });

    // On-gem shimmer flash (stays attached to gem)
    if (shimmers.length < MAX_SHIMMERS && Math.random() < 0.35) {
      const sAngle = Math.random() * Math.PI * 2;
      const sDist = def.radius * (0.15 + Math.random() * 0.6);
      shimmers.push({
        bodyRef: body,
        offX: Math.cos(sAngle) * sDist,
        offY: Math.sin(sAngle) * sDist,
        age: 0,
        lifetime: 0.15 + Math.random() * 0.2,
        size: (2 + data.tier * 0.5 + Math.random() * 1.5) * tierScale,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Landing impact effect — dust puff when a gem comes to rest
// ---------------------------------------------------------------------------

/** Speed threshold (virtual px/s) — below this a gem is considered "at rest". */
const LAND_SPEED_THRESHOLD = 30;
/** Minimum previous-frame speed to trigger a landing effect (filters out already-resting gems). */
const LAND_MIN_PREV_SPEED = 60;

/** Previous-frame speed per body id. */
const prevSpeeds = new Map<number, number>();

/** Reusable set to avoid per-frame allocation in detectLandings. */
const _activeIds = new Set<number>();

/**
 * Call once per physics tick after `Matter.Engine.update`.
 * Scans all gem bodies for landing events and emits dust-puff particles.
 * @param bodies  All bodies currently in the physics world.
 */
export function detectLandings(bodies: readonly Body[]): void {
  if (!getSettings().showParticles || !getQualityPreset().particles) {
    prevSpeeds.clear();
    return;
  }

  _activeIds.clear();

  for (const body of bodies) {
    const data = getGemData(body);
    if (!data) continue;
    if (body.isStatic()) continue;

    const speed = bodySpeed(body);
    const id = bodyId(body);
    const prev = prevSpeeds.get(id) ?? 0;
    _activeIds.add(id);
    prevSpeeds.set(id, speed);

    // Trigger: was moving fast, now slow
    if (prev >= LAND_MIN_PREV_SPEED && speed < LAND_SPEED_THRESHOLD) {
      const def = GEM_TIERS[data.tier];
      if (!def) continue;
      const pos = bodyPos(body);
      emitLandingDust(pos.x, pos.y + def.radius, prev);
    }
  }

  // Prune entries for bodies that no longer exist (merged / removed)
  // Only iterate if the map could have stale entries
  if (prevSpeeds.size > _activeIds.size) {
    for (const id of prevSpeeds.keys()) {
      if (!_activeIds.has(id)) prevSpeeds.delete(id);
    }
  }
}

/** Reset landing tracker (call on game restart). */
export function resetLandingTracker(): void {
  prevSpeeds.clear();
}

/**
 * Emit a small horizontal dust-puff at a gem's base.
 * @param x       Center X of the landing point
 * @param y       Bottom Y of the gem (base)
 * @param impactSpeed  Speed at the previous frame — scales the effect
 */
function emitLandingDust(x: number, y: number, impactSpeed: number): void {
  // Scale factor: 0→1 based on impact speed (60–300 vp/s range)
  const intensity = Math.min((impactSpeed - LAND_MIN_PREV_SPEED) / 240, 1);

  const count = 4 + Math.round(intensity * 4); // 4–8 particles
  const spread = 30 + intensity * 40;           // horizontal speed
  const lifetime = 0.15 + intensity * 0.1;      // 150–250ms
  const size = 1.5 + intensity * 1.5;           // radius 1.5–3

  for (let i = 0; i < count; i++) {
    // Spread horizontally, slight upward drift
    const dir = i < count / 2 ? -1 : 1;
    const hSpeed = spread * (0.5 + Math.random() * 0.5) * dir;

    particles.spawn({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 2,
      vx: hSpeed,
      vy: -(10 + Math.random() * 20), // slight upward puff
      lifetime,
      color: 'rgba(200, 200, 220, 1)',
      alpha: 0.5 + intensity * 0.3,
      size: size * (0.6 + Math.random() * 0.8),
      gravity: 40,
      endSizeMult: 1.5, // expand slightly as they fade
    });
  }
}
