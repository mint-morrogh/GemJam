// ---------------------------------------------------------------------------
// Peggle-style gem launcher — trajectory computation and state
// ---------------------------------------------------------------------------

import { GRID } from './gems';
import { FIXED_DT } from '../engine/gameLoop';

// ---------------------------------------------------------------------------
// Launcher state
// ---------------------------------------------------------------------------

export interface LauncherState {
  /** Launch point X (virtual coords — centered above bucket). */
  launchX: number;
  /** Launch point Y (virtual coords — just above bucket top). */
  launchY: number;
}

/** Create launcher positioned at the center-top of the bucket. */
export function createLauncherState(): LauncherState {
  return {
    launchX: GRID.containerX + GRID.containerWidth / 2,
    launchY: GRID.containerY - 20,
  };
}

// ---------------------------------------------------------------------------
// Launch velocity
// ---------------------------------------------------------------------------

/** Speed magnitude applied to launched gems (pixels/second). */
export const LAUNCH_SPEED = 600;

/**
 * Compute the launch velocity vector from the launcher toward the aim point.
 * Returns null if the aim is too close or aimed upward (vy must be positive).
 */
export function getLaunchVelocity(
  launcher: LauncherState,
  aimX: number,
  aimY: number,
): { vx: number; vy: number } | null {
  const dx = aimX - launcher.launchX;
  const dy = aimY - launcher.launchY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 10) return null;
  if (dy < 1) return null; // prevent upward shots, but allow shallow angles
  const vx = (dx / dist) * LAUNCH_SPEED;
  const vy = (dy / dist) * LAUNCH_SPEED;
  return { vx, vy };
}

// ---------------------------------------------------------------------------
// Trajectory prediction (parabolic arc + wall bounces)
// ---------------------------------------------------------------------------
// Simulates forward in time using the same gravity/friction constants as
// Matter.js, producing an array of points the gem will approximately follow.
// Ignores gem-gem collisions (matches Peggle's approach).

export interface TrajectoryPoint {
  x: number;
  y: number;
}

/**
 * Compute predicted trajectory points starting from (startX, startY) with
 * initial velocity (vx, vy). Stops after `maxBounces` wall reflections or
 * `maxSteps` physics steps.
 */
export function computeTrajectory(
  startX: number,
  startY: number,
  vx: number,
  vy: number,
  gemRadius: number,
  tier = 0,
  maxSteps = 300,
  maxBounces = 3,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;

  // Planck-matched physics (pixels/second units, Euler integration)
  const t = tier / 11;
  const linearDamping = 0.8 - t * 0.5;       // mirrors gemSpawner
  const bounceRestitution = Math.max(0.5 - t * 0.3, 0.2);

  const dt = FIXED_DT; // seconds per step
  const gravityPxPerS2 = 25 * 30; // 25 m/s² * 30 PPM = 750 px/s²
  const damping = Math.max(0, 1 - linearDamping * dt); // per-step damping
  const restitution = bounceRestitution;

  const wallLeft = GRID.containerX;
  const wallRight = GRID.containerX + GRID.containerWidth;
  const wallBottom = GRID.containerY + GRID.containerHeight;

  let bounces = 0;

  for (let i = 0; i < maxSteps; i++) {
    // Euler integration (px/s units)
    vy += gravityPxPerS2 * dt;
    vx *= damping;
    vy *= damping;
    x += vx * dt;
    y += vy * dt;

    // Wall bounces
    if (x - gemRadius < wallLeft) {
      x = wallLeft + gemRadius;
      vx = -vx * restitution;
      bounces++;
    }
    if (x + gemRadius > wallRight) {
      x = wallRight - gemRadius;
      vx = -vx * restitution;
      bounces++;
    }
    if (y + gemRadius > wallBottom) {
      y = wallBottom - gemRadius;
      vy = -vy * restitution;
      bounces++;
    }

    // Record every other point to keep array manageable
    if (i % 2 === 0) points.push({ x, y });

    if (bounces >= maxBounces) break;
    if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01 && y + gemRadius >= wallBottom - 1) break;
  }

  return points;
}
