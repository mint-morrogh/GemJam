import Matter from 'matter-js';

export { Matter };

export interface CreateEngineOptions {
  gravity?: number;
  gravityX?: number;
}

/**
 * Creates a Matter.Engine with configurable gravity.
 * @param options.gravity - Vertical gravity magnitude (default 9.8, downward)
 * @param options.gravityX - Horizontal gravity (default 0)
 */
export function createEngine(options: CreateEngineOptions = {}): Matter.Engine {
  const { gravity = 9.8, gravityX = 0 } = options;

  const engine = Matter.Engine.create({
    gravity: {
      x: gravityX,
      y: gravity,
      scale: 0.001,
    },
  });

  return engine;
}

export interface WallBodies {
  top: Matter.Body;
  bottom: Matter.Body;
  left: Matter.Body;
  right: Matter.Body;
}

/**
 * Creates four static wall bodies at the edges of the given dimensions and adds them to the world.
 */
export function createWalls(
  engine: Matter.Engine,
  width: number,
  height: number,
  thickness: number = 50
): WallBodies {
  const options = { isStatic: true } as const;

  const top = Matter.Bodies.rectangle(width / 2, -thickness / 2, width + thickness * 2, thickness, options);
  const bottom = Matter.Bodies.rectangle(width / 2, height + thickness / 2, width + thickness * 2, thickness, options);
  const left = Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height + thickness * 2, options);
  const right = Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height + thickness * 2, options);

  Matter.Composite.add(engine.world, [top, bottom, left, right]);

  return { top, bottom, left, right };
}

export interface SpawnCircleOptions {
  restitution?: number;
  friction?: number;
  frictionAir?: number;
  density?: number;
}

/**
 * Creates a circle body with sensible defaults, adds it to the world, and returns it.
 */
export function spawnCircle(
  engine: Matter.Engine,
  x: number,
  y: number,
  radius: number,
  options: SpawnCircleOptions = {}
): Matter.Body {
  const {
    restitution = 0.6,
    friction = 0.1,
    frictionAir = 0.01,
    density = 0.001,
  } = options;

  const body = Matter.Bodies.circle(x, y, radius, {
    restitution,
    friction,
    frictionAir,
    density,
  });

  Matter.Composite.add(engine.world, body);

  return body;
}

export interface PhysicsLoop {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
}

const FIXED_TIMESTEP = 1000 / 60; // ~16.67ms per tick

/**
 * Creates a physics update loop that calls Matter.Engine.update each frame
 * with a fixed timestep. Can be started and stopped.
 */
export function createPhysicsLoop(engine: Matter.Engine): PhysicsLoop {
  let rafId = 0;
  let _running = false;

  function tick() {
    if (!_running) return;
    Matter.Engine.update(engine, FIXED_TIMESTEP);
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (_running) return;
      _running = true;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      _running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    get running() {
      return _running;
    },
  };
}
