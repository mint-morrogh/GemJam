// ---------------------------------------------------------------------------
// DPR-aware rendering configuration
// ---------------------------------------------------------------------------
// Scales shadow/glow effect radii relative to devicePixelRatio so that
// GPU fill cost drops proportionally on high-DPR screens while visual
// appearance stays perceptually consistent.
//
// Rationale: on a DPR-3 screen the canvas backing store is 9× larger.
// Soft effects (glow halos, shadows) gain no perceptible quality from
// the extra resolution. Dividing their virtual-coordinate radii by DPR
// keeps the physical-pixel footprint constant across devices.

// ---------------------------------------------------------------------------
// DPR capping
// ---------------------------------------------------------------------------
// The canvas backing store is VIRTUAL_WIDTH * dpr × VIRTUAL_HEIGHT * dpr.
// On high-DPR phones (3×) this creates an 8.3M pixel buffer that dominates
// frame budget. Capping DPR to 2 keeps the buffer at 3.7M pixels — a 56%
// reduction on DPR-3 devices — with no perceptible quality loss at typical
// phone viewing distances. Layout (CSS dimensions) is unaffected.

/** Hard ceiling on DPR used for canvas backing store. */
let maxDpr = 3;

/**
 * Maximum total pixels for the canvas backing store.
 * If the capped buffer would exceed this budget, DPR is reduced further.
 * Default ~3.7M (1280×2 × 720×2) — comfortably within mobile GPU budgets.
 */
let pixelBudget = 480 * 3 * 960 * 3; // 4,147,200 — supports DPR 3 at portrait res

/** Set the DPR cap. Values < 1 are clamped to 1. */
export function setMaxDpr(cap: number): void {
  maxDpr = Math.max(1, cap);
}

/** Get the current DPR cap. */
export function getMaxDpr(): number {
  return maxDpr;
}

/** Set the pixel budget for the canvas backing store. */
export function setPixelBudget(budget: number): void {
  pixelBudget = Math.max(1, budget);
}

/** Get the current pixel budget. */
export function getPixelBudget(): number {
  return pixelBudget;
}

/** Cached effective DPR value — updated on resize via `refreshDpr()`. */
let dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
/** Raw device DPR (uncapped). */
let rawDpr = dpr;

/** Call on resize / orientation change to pick up DPR changes.
 *  Pass virtualWidth/virtualHeight so the pixel budget can be enforced. */
export function refreshDpr(virtualWidth?: number, virtualHeight?: number): void {
  rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // On desktop (DPR 1), calculate how much the canvas is being stretched
  // and use at least that ratio so text/sprites aren't fuzzy
  if (rawDpr <= 1 && typeof window !== 'undefined') {
    const cssScale = Math.min(window.innerHeight / (virtualHeight || 960), window.innerWidth / (virtualWidth || 480));
    if (cssScale > 1) rawDpr = Math.min(cssScale, maxDpr);
  }

  // Apply cap
  let effective = Math.min(rawDpr, maxDpr);

  // Enforce pixel budget if virtual dimensions are known
  if (virtualWidth && virtualHeight) {
    const pixels = virtualWidth * effective * virtualHeight * effective;
    if (pixels > pixelBudget) {
      effective = Math.sqrt(pixelBudget / (virtualWidth * virtualHeight));
      // Round down to nearest 0.25 to avoid non-integer buffer sizes
      effective = Math.floor(effective * 4) / 4;
      effective = Math.max(1, effective);
    }
  }

  dpr = effective;
}

/** Current effective (capped) DPR used for rendering. */
export function getDpr(): number {
  return dpr;
}

/** Raw device DPR (uncapped, directly from window.devicePixelRatio). */
export function getRawDpr(): number {
  return rawDpr;
}

// ---------------------------------------------------------------------------
// Effect scale factors
// ---------------------------------------------------------------------------
// These divide the virtual-coordinate radius of soft effects by DPR so
// the physical pixel area stays ~constant regardless of screen density.

/**
 * Scale factor for glow/shadow radii.
 * At DPR 1 → 1.0 (unchanged). At DPR 3 → 0.333 (1/3 virtual radius).
 * This keeps the physical-pixel coverage constant.
 */
export function glowRadiusScale(): number {
  return 1 / dpr;
}

/**
 * Scale factor for shadow offsets (e.g. drop shadow dx/dy).
 * Uses same 1/DPR scaling.
 */
export function shadowOffsetScale(): number {
  return 1 / dpr;
}

/**
 * Scale factor for glow alpha intensity.
 * On high-DPR the glow covers fewer virtual pixels, so we boost alpha
 * slightly to maintain perceived brightness.
 * At DPR 1 → 1.0, DPR 2 → ~1.2, DPR 3 → ~1.35.
 * Multiplied by the quality tier's glowIntensity.
 */
export function glowAlphaScale(): number {
  const base = dpr <= 1 ? 1 : Math.min(Math.sqrt(dpr) * 0.8, 1.5);
  return base * currentGlowIntensity;
}

// ---------------------------------------------------------------------------
// Render quality tiers
// ---------------------------------------------------------------------------

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Human-readable name. */
  tier: QualityTier;
  /** Max DPR for canvas backing store. */
  maxDpr: number;
  /** Glow/shadow intensity multiplier (0 = off, 1 = full). */
  glowIntensity: number;
  /** Whether to show particle effects. */
  particles: boolean;
  /** Whether to show the pulsing gem glow. */
  gemGlow: boolean;
  /** Max pixel budget for canvas backing store. */
  pixelBudget: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    tier: 'low',
    maxDpr: 1,
    glowIntensity: 0,
    particles: false,
    gemGlow: false,
    pixelBudget: 1280 * 720,           // 921,600
  },
  medium: {
    tier: 'medium',
    maxDpr: 2,
    glowIntensity: 0.6,
    particles: true,
    gemGlow: true,
    pixelBudget: 1280 * 2 * 720 * 2,   // 3,686,400
  },
  high: {
    tier: 'high',
    maxDpr: 3,
    glowIntensity: 1.0,
    particles: true,
    gemGlow: true,
    pixelBudget: 1280 * 3 * 720 * 3,   // 8,294,400
  },
};

/** The currently active preset. */
let activePreset: QualityPreset = QUALITY_PRESETS.medium;
/** Whether the user has manually chosen a tier (disables auto-detection). */
let userOverride = false;

/** Get the active quality preset. */
export function getQualityPreset(): Readonly<QualityPreset> {
  return activePreset;
}

/** Get the active quality tier name. */
export function getQualityTier(): QualityTier {
  return activePreset.tier;
}

/**
 * Apply a quality preset. Updates DPR cap, pixel budget, and returns the
 * preset so callers can read particle/glow flags.
 * @param tier  The quality tier to apply.
 * @param isUserOverride  If true, auto-detection is disabled until reset.
 */
export function setQualityTier(tier: QualityTier, isUserOverride = true): QualityPreset {
  const preset = QUALITY_PRESETS[tier];
  activePreset = preset;
  maxDpr = preset.maxDpr;
  pixelBudget = preset.pixelBudget;
  // Smooth glow transition — target the new intensity, don't snap
  targetGlowIntensity = preset.glowIntensity;
  if (isUserOverride) userOverride = true;
  return preset;
}

/** Whether a user override is active. */
export function hasUserOverride(): boolean {
  return userOverride;
}

/** Clear user override, allowing auto-detection to apply again. */
export function clearUserOverride(): void {
  userOverride = false;
}

// ---------------------------------------------------------------------------
// Adaptive effect frame-skipping
// ---------------------------------------------------------------------------
// When FPS drops below threshold, expensive effects (glow, flash, particles)
// skip frames to recover budget. Uses a rolling average to avoid flicker.

const FPS_WINDOW = 30; // frames for rolling average
const fpsHistory: number[] = [];
let rollingFps = 60;
/** Frame counter for skip-pattern. */
let effectFrameCounter = 0;

/**
 * Feed a raw frame-time sample (ms) into the rolling FPS tracker.
 * Call once per render frame.
 */
export function feedFrameTime(frameTimeMs: number): void {
  const fps = frameTimeMs > 0 ? 1000 / frameTimeMs : 60;
  fpsHistory.push(fps);
  if (fpsHistory.length > FPS_WINDOW) fpsHistory.shift();
  rollingFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
  effectFrameCounter++;
}

/** Current rolling average FPS. */
export function getRollingFps(): number {
  return rollingFps;
}

/**
 * Whether expensive effects (glow, flash, particles) should render this frame.
 * - FPS >= 50: always render
 * - FPS 35–50: render every other frame
 * - FPS < 35: render every 3rd frame
 * Returns true when the effect should be drawn.
 */
export function shouldRenderEffects(): boolean {
  if (rollingFps >= 50) return true;
  if (rollingFps >= 35) return (effectFrameCounter % 2) === 0;
  return (effectFrameCounter % 3) === 0;
}

// ---------------------------------------------------------------------------
// Smooth tier transitions
// ---------------------------------------------------------------------------
// When quality tier changes, glow intensity interpolates over ~0.3s to
// avoid visual pop.

let targetGlowIntensity = activePreset.glowIntensity;
let currentGlowIntensity = activePreset.glowIntensity;
const TRANSITION_SPEED = 4; // units/second (reaches target in ~0.25s)

/**
 * Tick the smooth transition. Call once per update frame with dt in seconds.
 */
export function updateTransition(dt: number): void {
  if (currentGlowIntensity === targetGlowIntensity) return;
  const diff = targetGlowIntensity - currentGlowIntensity;
  const step = TRANSITION_SPEED * dt;
  if (Math.abs(diff) <= step) {
    currentGlowIntensity = targetGlowIntensity;
  } else {
    currentGlowIntensity += Math.sign(diff) * step;
  }
}

/** Get the smoothly interpolated glow intensity (0–1). */
export function getSmoothedGlowIntensity(): number {
  return currentGlowIntensity;
}

/**
 * Auto-detect the best quality tier based on device capabilities.
 * Heuristic:
 *   - low: <=2 cores OR very low memory (<512MB via deviceMemory)
 *   - high: >=6 cores AND DPR <= 2 (desktop or high-end tablet)
 *   - medium: everything else (most phones)
 *
 * Does nothing if the user has manually selected a tier.
 * Returns the selected tier.
 */
export function autoDetectQuality(): QualityTier {
  if (userOverride) return activePreset.tier;

  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory as number | undefined; // Chrome-only
  const deviceDpr = window.devicePixelRatio || 1;
  const screenPixels = window.screen.width * window.screen.height * deviceDpr * deviceDpr;

  // Low-end: few cores, limited memory, or tiny screen
  if (cores <= 2 || (mem !== undefined && mem < 1) || screenPixels < 500_000) {
    return setQualityTier('low', false).tier;
  }

  // High-end: many cores, moderate DPR (typically desktop / flagship tablet)
  if (cores >= 6 && deviceDpr <= 2) {
    return setQualityTier('high', false).tier;
  }

  // Default: medium (most mobile devices)
  return setQualityTier('medium', false).tier;
}
