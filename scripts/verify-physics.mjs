/**
 * Headless verification: spawns 5+ circles in a walled container,
 * runs the engine, and asserts gravity, collision, and containment.
 */
import Matter from 'matter-js';

const WIDTH = 800;
const HEIGHT = 600;
const THICKNESS = 50;
const TIMESTEP = 1000 / 60;
const TICKS = 600; // ~10 seconds of simulation

// --- Setup engine with gravity ---
const engine = Matter.Engine.create({
  gravity: { x: 0, y: 9.8, scale: 0.001 },
});

// --- Create walls ---
const wallOpts = { isStatic: true };
const top    = Matter.Bodies.rectangle(WIDTH / 2, -THICKNESS / 2, WIDTH + THICKNESS * 2, THICKNESS, wallOpts);
const bottom = Matter.Bodies.rectangle(WIDTH / 2, HEIGHT + THICKNESS / 2, WIDTH + THICKNESS * 2, THICKNESS, wallOpts);
const left   = Matter.Bodies.rectangle(-THICKNESS / 2, HEIGHT / 2, THICKNESS, HEIGHT + THICKNESS * 2, wallOpts);
const right  = Matter.Bodies.rectangle(WIDTH + THICKNESS / 2, HEIGHT / 2, THICKNESS, HEIGHT + THICKNESS * 2, wallOpts);
Matter.Composite.add(engine.world, [top, bottom, left, right]);

// --- Spawn 8 circles at varied positions ---
const circles = [];
const spawns = [
  { x: 100, y: 50, r: 20 },
  { x: 250, y: 30, r: 25 },
  { x: 400, y: 60, r: 15 },
  { x: 550, y: 40, r: 30 },
  { x: 700, y: 20, r: 18 },
  { x: 200, y: 100, r: 22 },
  { x: 500, y: 80, r: 28 },
  { x: 350, y: 10, r: 20 },
];

for (const s of spawns) {
  const body = Matter.Bodies.circle(s.x, s.y, s.r, {
    restitution: 0.6,
    friction: 0.1,
    frictionAir: 0.01,
    density: 0.001,
  });
  Matter.Composite.add(engine.world, body);
  circles.push({ body, startY: s.y });
}

// Record initial Y positions
const initialYs = circles.map(c => c.body.position.y);

// --- Run simulation ---
for (let i = 0; i < TICKS; i++) {
  Matter.Engine.update(engine, TIMESTEP);
}

// --- Verify ---
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('Physics verification results:');
console.log('');

// 1. Gravity: all circles should have moved downward from their start position
const allFell = circles.every((c, i) => c.body.position.y > initialYs[i]);
assert('All circles fell under gravity', allFell);

// 2. Containment: no circle escaped the container bounds (with generous margin)
const MARGIN = THICKNESS + 50; // walls + body radius margin
const allContained = circles.every(c => {
  const { x, y } = c.body.position;
  return x > -MARGIN && x < WIDTH + MARGIN && y > -MARGIN && y < HEIGHT + MARGIN;
});
assert('All circles stayed inside container', allContained);

// 3. Circles should have settled near the bottom (gravity pulled them down)
const allNearBottom = circles.every(c => c.body.position.y > HEIGHT * 0.5);
assert('All circles settled in lower half (gravity working)', allNearBottom);

// 4. Collision: circles shouldn't all be at exact same position (they push each other)
const positions = circles.map(c => `${c.body.position.x.toFixed(1)},${c.body.position.y.toFixed(1)}`);
const uniquePositions = new Set(positions);
assert('Circles have distinct positions (collisions working)', uniquePositions.size === circles.length);

// 5. No circle has NaN or Infinity position (simulation stable)
const allFinite = circles.every(c => {
  const { x, y } = c.body.position;
  return Number.isFinite(x) && Number.isFinite(y);
});
assert('All positions are finite (simulation stable)', allFinite);

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);

if (failed > 0) {
  console.log('');
  console.log('Final positions:');
  circles.forEach((c, i) => {
    console.log(`  Circle ${i}: (${c.body.position.x.toFixed(1)}, ${c.body.position.y.toFixed(1)})`);
  });
  process.exit(1);
}
