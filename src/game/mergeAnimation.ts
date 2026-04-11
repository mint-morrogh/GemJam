import { GEM_TIERS } from './gems';
import { getGemData } from './gemSpawner';
import { getGemSprite } from './gemSprites';
import { glowRadiusScale, glowAlphaScale } from './renderConfig';
import { bodyPos, type Body } from '../physics/planckWorld';

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const BASE_SCALE_DUR = 0.06;
const BASE_FLASH_DUR = 0.09;
const BASE_RING_DUR = 0.22;
const BASE_GLOW_DUR = 0.28;
const BASE_RAYS_DUR = 0.3;
const BASE_STARS_DUR = 0.25;

// ---------------------------------------------------------------------------
// Anim types
// ---------------------------------------------------------------------------

interface ScaleAnim { body: Body; tier: number; elapsed: number; duration: number; }
interface FlashAnim { x: number; y: number; radius: number; tier: number; color: string; elapsed: number; duration: number; }
interface RingAnim { x: number; y: number; maxRadius: number; color: string; tier: number; elapsed: number; duration: number; thick: boolean; }
interface GlowAnim { x: number; y: number; radius: number; color: string; tier: number; elapsed: number; duration: number; }

/** Rotating light rays for high-tier merges */
interface RaysAnim { x: number; y: number; radius: number; color: string; rayCount: number; elapsed: number; duration: number; spin: number; }

/** Star burst — small 4-pointed stars flying outward */
interface StarAnim { x: number; y: number; vx: number; vy: number; size: number; color: string; elapsed: number; duration: number; rotation: number; rotSpeed: number; }

const scaleAnims: ScaleAnim[] = [];
const flashAnims: FlashAnim[] = [];
const ringAnims: RingAnim[] = [];
const glowAnims: GlowAnim[] = [];
const raysAnims: RaysAnim[] = [];
const starAnims: StarAnim[] = [];

// ---------------------------------------------------------------------------
// Screen shake state (read by render loop)
// ---------------------------------------------------------------------------

let shakeIntensity = 0;
let shakeDecay = 0;

export function getScreenShake(): { x: number; y: number } {
  if (shakeIntensity < 0.5) return { x: 0, y: 0 };
  return {
    x: (Math.random() - 0.5) * shakeIntensity * 2,
    y: (Math.random() - 0.5) * shakeIntensity * 2,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function addMergeAnimation(body: Body, midX: number, midY: number): void {
  const data = getGemData(body);
  if (!data) return;
  const def = GEM_TIERS[data.tier];
  if (!def) return;

  const tier = data.tier;
  const tm = 1 + tier * 0.1;

  // Cancel stale scale anims on this body (chain merges)
  for (let i = scaleAnims.length - 1; i >= 0; i--) {
    if (scaleAnims[i].body === body) scaleAnims.splice(i, 1);
  }

  // Scale-up (always)
  scaleAnims.push({ body, tier, elapsed: 0, duration: BASE_SCALE_DUR * tm });

  // Flash (always)
  flashAnims.push({
    x: midX, y: midY,
    radius: def.radius * (1.8 + tier * 0.2),
    tier, color: def.color, elapsed: 0,
    duration: BASE_FLASH_DUR * tm,
  });

  // Thin expanding ring (tier 1+)
  if (tier >= 1) {
    ringAnims.push({
      x: midX, y: midY,
      maxRadius: def.radius * (2.5 + tier * 0.3),
      color: def.color, tier, elapsed: 0,
      duration: BASE_RING_DUR * tm, thick: false,
    });
  }

  // Second thick ring (tier 3+)
  if (tier >= 3) {
    ringAnims.push({
      x: midX, y: midY,
      maxRadius: def.radius * (3.0 + tier * 0.4),
      color: '#ffffff', tier, elapsed: 0,
      duration: BASE_RING_DUR * tm * 1.2, thick: true,
    });
  }

  // Color glow (tier 2+)
  if (tier >= 2) {
    glowAnims.push({
      x: midX, y: midY,
      radius: def.radius * (2 + tier * 0.25),
      color: def.color, tier, elapsed: 0,
      duration: BASE_GLOW_DUR * tm,
    });
  }

  // Light rays (tier 4+) — rotating beams radiating from merge point
  if (tier >= 4) {
    const rayCount = 4 + Math.floor(tier / 2);
    raysAnims.push({
      x: midX, y: midY,
      radius: def.radius * (3 + tier * 0.5),
      color: def.color, rayCount, elapsed: 0,
      duration: BASE_RAYS_DUR * tm,
      spin: (Math.random() - 0.5) * 2,
    });
  }

  // Star burst (tier 2+) — small 4-pointed stars flying outward
  if (tier >= 2) {
    const count = 6 + tier * 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 60 + tier * 15 + Math.random() * 40;
      starAnims.push({
        x: midX, y: midY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + tier * 0.5 + Math.random() * 2,
        color: Math.random() < 0.4 ? '#ffffff' : def.color,
        elapsed: 0,
        duration: BASE_STARS_DUR * tm * (0.8 + Math.random() * 0.4),
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  // Screen shake (tier 5+)
  if (tier >= 5) {
    shakeIntensity = Math.max(shakeIntensity, 2 + (tier - 6) * 1.5);
    shakeDecay = 8;
  }
}

export function resetMergeAnimations(): void {
  scaleAnims.length = 0;
  flashAnims.length = 0;
  ringAnims.length = 0;
  glowAnims.length = 0;
  raysAnims.length = 0;
  starAnims.length = 0;
  shakeIntensity = 0;
}

// ---------------------------------------------------------------------------
// Draw helpers
// ---------------------------------------------------------------------------

/** Draw a 4-pointed star centered at origin. */
function drawStar(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const r = i % 2 === 0 ? size : size * 0.35;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Main update + draw
// ---------------------------------------------------------------------------

export function updateAndDrawMergeAnimations(
  ctx: CanvasRenderingContext2D,
  dt: number,
  renderEffects = true,
): void {
  const rScale = glowRadiusScale();
  const aBoost = glowAlphaScale();

  // Decay screen shake
  if (shakeIntensity > 0) {
    shakeIntensity = Math.max(0, shakeIntensity - shakeDecay * dt);
  }

  // -- Lingering color glow ---------------------------------------------------
  for (let i = glowAnims.length - 1; i >= 0; i--) {
    const a = glowAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    if (renderEffects) {
      const alpha = 0.4 * (1 - t) * (1 - t) * aBoost;
      if (alpha > 0.01) {
        const r = a.radius * (0.5 + 0.5 * t) * rScale;
        const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
        grad.addColorStop(0, a.color);
        grad.addColorStop(0.35, a.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (t >= 1) glowAnims.splice(i, 1);
  }

  // -- Light rays (tier 5+) ---------------------------------------------------
  for (let i = raysAnims.length - 1; i >= 0; i--) {
    const a = raysAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    if (renderEffects) {
      const alpha = 0.25 * (1 - t) * aBoost;
      if (alpha > 0.01) {
        const r = a.radius * (0.3 + 0.7 * t) * rScale;
        const rot = a.spin * a.elapsed;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(rot);
        ctx.globalAlpha = alpha;
        for (let j = 0; j < a.rayCount; j++) {
          const rayAngle = (Math.PI * 2 * j) / a.rayCount;
          const rayW = 3 + (1 - t) * 4;
          ctx.save();
          ctx.rotate(rayAngle);
          const grad = ctx.createLinearGradient(0, 0, r, 0);
          grad.addColorStop(0, a.color);
          grad.addColorStop(0.5, a.color);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, -rayW / 2, r, rayW);
          ctx.restore();
        }
        ctx.restore();
      }
    }
    if (t >= 1) raysAnims.splice(i, 1);
  }

  // -- Flash burst ------------------------------------------------------------
  for (let i = flashAnims.length - 1; i >= 0; i--) {
    const a = flashAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    if (renderEffects) {
      const alpha = (1 - t * t) * Math.min(0.85 + a.tier * 0.03, 1) * aBoost;
      const r = a.radius * (0.4 + 0.6 * t) * rScale;
      if (alpha > 0.01) {
        const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, a.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (t >= 1) flashAnims.splice(i, 1);
  }

  // -- Expanding rings --------------------------------------------------------
  for (let i = ringAnims.length - 1; i >= 0; i--) {
    const a = ringAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    if (renderEffects) {
      const alpha = (1 - t) * (a.thick ? 0.4 : 0.6) * aBoost;
      const r = a.maxRadius * t * rScale;
      const lineW = a.thick ? Math.max(1.5, 5 * (1 - t)) : Math.max(1, 3 * (1 - t));
      if (alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = lineW;
        ctx.stroke();
        ctx.restore();
      }
    }
    if (t >= 1) ringAnims.splice(i, 1);
  }

  // -- Flying stars -----------------------------------------------------------
  for (let i = starAnims.length - 1; i >= 0; i--) {
    const a = starAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.vy += 80 * dt; // slight gravity pull
    a.rotation += a.rotSpeed * dt;

    if (renderEffects) {
      const alpha = (1 - t) * (1 - t);
      const sz = a.size * (1 - t * 0.5);
      if (alpha > 0.01 && sz > 0.3) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = a.color;
        drawStar(ctx, sz);
        ctx.fill();
        ctx.restore();
      }
    }
    if (t >= 1) starAnims.splice(i, 1);
  }

  // -- Scale-up tween ---------------------------------------------------------
  for (let i = scaleAnims.length - 1; i >= 0; i--) {
    const a = scaleAnims[i];
    a.elapsed += dt;
    const t = Math.min(a.elapsed / a.duration, 1);
    const p = t < 1 ? 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI / 3)) : 1;
    const scale = Math.max(0, Math.min(p, 1.15));

    const def = GEM_TIERS[a.tier];
    if (!def) { scaleAnims.splice(i, 1); continue; }

    const { x, y } = bodyPos(a.body);
    const r = def.radius * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    const sprite = getGemSprite(a.tier);
    if (sprite) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = def.color;
      ctx.fill();
    }

    if (t < 0.4) {
      ctx.globalAlpha = 0.6 * (1 - t / 0.4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    if (t >= 1) scaleAnims.splice(i, 1);
  }
}
