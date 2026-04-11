/**
 * Core game loop module — requestAnimationFrame orchestration
 * with fixed-timestep physics via an accumulator pattern.
 *
 * Physics `update(fixedDt)` runs at a deterministic rate (default 1/60s)
 * regardless of display refresh rate. Render runs once per frame.
 */

/** Fixed physics timestep in seconds (60 Hz) */
export const FIXED_DT = 1 / 60;

/** Max accumulated time (seconds). Prevents spiral-of-death after tab-backgrounding or long GC pauses. */
const MAX_ACCUMULATOR = 0.25;

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (alpha: number) => void;

export type LoopState = 'stopped' | 'running' | 'paused';

let rafId = 0;
let state: LoopState = 'stopped';
let lastTimestamp = 0;
let accumulator = 0;

let updateFn: UpdateCallback | null = null;
let renderFn: RenderCallback | null = null;

// -- Debug stats ------------------------------------------------------------
export interface LoopStats {
  /** Smoothed frames per second. */
  fps: number;
  /** Number of physics steps executed in the most recent frame. */
  physicsSteps: number;
}

let frameTimes: number[] = [];
const stats: LoopStats = { fps: 0, physicsSteps: 0 };

/** Read-only snapshot of current loop performance stats. */
export function getStats(): Readonly<LoopStats> {
  return stats;
}

function tick(timestamp: number): void {
  if (state === 'stopped') return;

  // Always keep the RAF loop alive while not stopped
  rafId = requestAnimationFrame(tick);

  // When paused, spin RAF but skip all game logic
  if (state === 'paused') return;

  // First frame or resuming: seed timestamp, no delta
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    return;
  }

  const frameDt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  accumulator += frameDt;

  // Spiral-of-death protection: clamp so we never run more than
  // MAX_ACCUMULATOR worth of physics steps in a single frame.
  if (accumulator > MAX_ACCUMULATOR) {
    accumulator = MAX_ACCUMULATOR;
  }

  // Fixed-timestep physics updates — consume accumulated time
  let steps = 0;
  while (accumulator >= FIXED_DT) {
    if (updateFn) updateFn(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  stats.physicsSteps = steps;

  // FPS: rolling average over last ~1 second of frame times
  frameTimes.push(frameDt);
  while (frameTimes.length > 0 && frameTimes.reduce((a, b) => a + b, 0) > 1) {
    frameTimes.shift();
  }
  stats.fps = frameTimes.length > 0
    ? frameTimes.length / frameTimes.reduce((a, b) => a + b, 0)
    : 0;

  // Alpha = leftover fraction for render interpolation
  const alpha = accumulator / FIXED_DT;
  if (renderFn) renderFn(alpha);
}

export interface LoopCallbacks {
  update?: UpdateCallback;
  render?: RenderCallback;
}

/** Get current loop state. */
export function getState(): LoopState {
  return state;
}

/**
 * Start the game loop.
 * - `update(fixedDt)` is called 0+ times per frame at a fixed rate
 * - `render(alpha)` is called once per frame with interpolation alpha
 */
export function startLoop(callbacks: LoopCallbacks = {}): void {
  if (state !== 'stopped') return;

  updateFn = callbacks.update ?? null;
  renderFn = callbacks.render ?? null;
  state = 'running';
  lastTimestamp = 0;
  accumulator = 0;
  frameTimes = [];
  stats.fps = 0;
  stats.physicsSteps = 0;
  rafId = requestAnimationFrame(tick);
}

/**
 * Pause the game loop. RAF keeps spinning so resume is instant,
 * but update/render are skipped and game time is frozen.
 */
export function pause(): void {
  if (state !== 'running') return;
  state = 'paused';
}

/**
 * Resume from pause. Resets lastTimestamp so the elapsed pause
 * duration is not counted as a single huge frame delta.
 */
export function resume(): void {
  if (state !== 'paused') return;
  lastTimestamp = 0;   // next tick will re-seed — no time spike
  state = 'running';
}

/**
 * Fully stop the game loop and cancel the animation frame.
 */
export function stop(): void {
  state = 'stopped';
  cancelAnimationFrame(rafId);
  rafId = 0;
  updateFn = null;
  renderFn = null;
}

/** @deprecated Use `stop()` instead. */
export const stopLoop = stop;
