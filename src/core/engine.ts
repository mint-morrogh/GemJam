import Matter from 'matter-js';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../canvas';

export interface EngineHandle {
  engine: Matter.Engine;
  render: Matter.Render;
}

/**
 * Create a Matter.js Engine and Render bound to the given canvas element.
 * The render viewport matches the virtual resolution so physics coordinates
 * align with the game's coordinate system.
 */
export function createEngine(canvas: HTMLCanvasElement): EngineHandle {
  const engine = Matter.Engine.create();

  const render = Matter.Render.create({
    canvas,
    engine,
    options: {
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      wireframes: true,
      background: '#111',
    },
  });

  return { engine, render };
}
