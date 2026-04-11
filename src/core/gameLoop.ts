import Matter from 'matter-js';

export interface GameLoopHandle {
  runner: Matter.Runner;
  stop: () => void;
}

/**
 * Start a Matter.Runner to drive the physics engine, and
 * run Matter.Render so the scene is drawn each frame.
 */
export function startGameLoop(engine: Matter.Engine, render: Matter.Render): GameLoopHandle {
  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  Matter.Render.run(render);

  return {
    runner,
    stop() {
      Matter.Runner.stop(runner);
      Matter.Render.stop(render);
    },
  };
}
