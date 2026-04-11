import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './canvas';

/** Callback invoked each frame with the 2D context and delta time in seconds. */
export type DrawCallback = (ctx: CanvasRenderingContext2D, dt: number) => void;

export interface RenderLoop {
  start: () => void;
  stop: () => void;
}

/**
 * Create a render loop driven by requestAnimationFrame.
 * Clears the canvas each frame, computes delta time, and calls the draw callback.
 */
export function createRenderLoop(ctx: CanvasRenderingContext2D, draw: DrawCallback): RenderLoop {
  let rafId = 0;
  let lastTime = 0;
  let running = false;

  function frame(time: number) {
    if (!running) return;

    const dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;

    // Clear in virtual coordinates (context is already DPR-scaled)
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    draw(ctx, dt);

    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}
