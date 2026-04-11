/**
 * Headless merge verification: spawns same-tier gems, runs physics,
 * and asserts merge detection, body removal, next-tier spawn, and chain merges.
 */
import Matter from 'matter-js';

// -- Gem config (mirrors src/game/gems.ts) -----------------------------------
const GEM_TIERS = [
  { id: 0, type: 'quartz',   color: '#E8E8E8', radius: 16, points: 1  },
  { id: 1, type: 'topaz',    color: '#F5C542', radius: 22, points: 3  },
  { id: 2, type: 'emerald',  color: '#50C878', radius: 30, points: 6  },
  { id: 3, type: 'sapphire', color: '#2563EB', radius: 38, points: 10 },
  { id: 4, type: 'ruby',     color: '#DC2626', radius: 48, points: 15 },
  { id: 5, type: 'amethyst', color: '#9333EA', radius: 58, points: 21 },
  { id: 6, type: 'diamond',  color: '#67E8F9', radius: 70, points: 28 },
  { id: 7, type: 'opal',     color: '#F472B6', radius: 84, points: 36 },
];

const MERGE_MAP = Object.fromEntries(
  GEM_TIERS.slice(0, -1).map(g => [g.id, g.id + 1]),
);

const GEM_PLUGIN_KEY = 'gemData';
let nextGemId = 1;

function spawnGem(engine, x, y, tier) {
  const def = GEM_TIERS[tier];
  const body = Matter.Bodies.circle(x, y, def.radius, {
    restitution: 0.4,
    friction: 0.1,
    frictionAir: 0.01,
    density: 0.001,
    plugin: { [GEM_PLUGIN_KEY]: { gemId: nextGemId++, tier } },
  });
  Matter.Composite.add(engine.world, body);
  return body;
}

function getGemData(body) {
  return body.plugin?.[GEM_PLUGIN_KEY];
}

// -- Merge detection + execution (mirrors src/game/mergeDetector + mergeExecutor)
const mergeQueue = [];
const pendingBodies = new Set();
let mergeCount = 0;

function initMergeDetection(engine) {
  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const dataA = getGemData(pair.bodyA);
      const dataB = getGemData(pair.bodyB);
      if (!dataA || !dataB) continue;
      if (dataA.tier !== dataB.tier) continue;
      const nextTier = MERGE_MAP[dataA.tier];
      if (nextTier === undefined) continue;
      if (pendingBodies.has(pair.bodyA.id) || pendingBodies.has(pair.bodyB.id)) continue;

      pendingBodies.add(pair.bodyA.id);
      pendingBodies.add(pair.bodyB.id);

      mergeQueue.push({
        bodyA: pair.bodyA,
        bodyB: pair.bodyB,
        nextTier,
        midX: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
        midY: (pair.bodyA.position.y + pair.bodyB.position.y) / 2,
      });
    }
  });
}

function processMerges(engine) {
  const spawned = [];
  while (mergeQueue.length > 0) {
    const event = mergeQueue.shift();
    const inWorld = Matter.Composite.allBodies(engine.world);
    const aExists = inWorld.includes(event.bodyA);
    const bExists = inWorld.includes(event.bodyB);

    pendingBodies.delete(event.bodyA.id);
    pendingBodies.delete(event.bodyB.id);

    if (!aExists || !bExists) continue;

    Matter.Composite.remove(engine.world, event.bodyA);
    Matter.Composite.remove(engine.world, event.bodyB);

    const newBody = spawnGem(engine, event.midX, event.midY, event.nextTier);
    spawned.push(newBody);
    mergeCount++;
  }
  return spawned;
}

// -- Test harness -----------------------------------------------------------
const TIMESTEP = 1000 / 60;
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

function gemBodies(engine) {
  return Matter.Composite.allBodies(engine.world).filter(b => getGemData(b));
}

// -- Setup ------------------------------------------------------------------
const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.8, scale: 0.001 } });

// Container walls (420×600 centered in 1280×720)
const CX = 430, CY = 90, CW = 420, CH = 600, WT = 50;
const wallOpts = { isStatic: true };
Matter.Composite.add(engine.world, [
  Matter.Bodies.rectangle(CX + CW / 2, CY + CH + WT / 2, CW + WT * 2, WT, wallOpts),
  Matter.Bodies.rectangle(CX - WT / 2, CY + CH / 2, WT, CH + WT, wallOpts),
  Matter.Bodies.rectangle(CX + CW + WT / 2, CY + CH / 2, WT, CH + WT, wallOpts),
]);

initMergeDetection(engine);
Matter.Events.on(engine, 'afterUpdate', () => processMerges(engine));

console.log('Merge system verification:');
console.log('');

// -- Test 1: Basic merge (two tier-0 gems → one tier-1) --------------------
console.log('Test 1: Basic same-tier merge');
const initBodyCount = Matter.Composite.allBodies(engine.world).length;

spawnGem(engine, CX + 100, CY + 10, 0);
spawnGem(engine, CX + 116, CY + 10, 0); // close enough to collide

// Run enough ticks for them to fall and collide
for (let i = 0; i < 300; i++) Matter.Engine.update(engine, TIMESTEP);

const gemsAfter1 = gemBodies(engine);
const hasTier1 = gemsAfter1.some(b => getGemData(b).tier === 1);
assert('Two tier-0 gems merged into tier-1', hasTier1);
assert('Exactly one gem remains after merge', gemsAfter1.length === 1);
assert('At least one merge occurred', mergeCount >= 1);

console.log('');

// -- Test 2: Max-tier gems don't merge --------------------------------------
console.log('Test 2: Max-tier no-op');
mergeCount = 0;

// Clear previous gems
for (const b of gemBodies(engine)) Matter.Composite.remove(engine.world, b);

spawnGem(engine, CX + 100, CY + 10, 7); // opal (max)
spawnGem(engine, CX + 168, CY + 10, 7); // opal (max) — radii overlap: 84+84

for (let i = 0; i < 300; i++) Matter.Engine.update(engine, TIMESTEP);

const maxGems = gemBodies(engine);
assert('Max-tier gems not merged (both remain)', maxGems.length === 2);
assert('No merges fired for max-tier', mergeCount === 0);

console.log('');

// -- Test 3: Chain merge (tier-1 sitting at bottom, then two tier-0 merge on top → chain to tier-2)
console.log('Test 3: Chain merge cascade');
mergeCount = 0;

for (const b of gemBodies(engine)) Matter.Composite.remove(engine.world, b);

// Place a tier-1 gem and let it settle at the bottom
spawnGem(engine, CX + 120, CY + 10, 1);
for (let i = 0; i < 300; i++) Matter.Engine.update(engine, TIMESTEP);

// Now spawn two tier-0 directly above — they'll collide mid-fall,
// merge into a tier-1, and that tier-1 lands on the existing tier-1 → tier-2
spawnGem(engine, CX + 112, CY + 10, 0);
spawnGem(engine, CX + 128, CY + 10, 0);

for (let i = 0; i < 600; i++) Matter.Engine.update(engine, TIMESTEP);

const chainGems = gemBodies(engine);
const hasTier2 = chainGems.some(b => getGemData(b).tier === 2);
assert('Chain merge produced tier-2', hasTier2);
assert('Multiple merges occurred (chain)', mergeCount >= 2);

console.log('');

// -- Test 4: Rapid spawn stress test ----------------------------------------
console.log('Test 4: Rapid spawn stress test (10+ gems)');
mergeCount = 0;

for (const b of gemBodies(engine)) Matter.Composite.remove(engine.world, b);

// Spawn 12 tier-0 gems in a tight cluster
for (let i = 0; i < 12; i++) {
  spawnGem(engine, CX + 80 + (i % 4) * 35, CY + 10 + Math.floor(i / 4) * 35, 0);
}

let noError = true;
try {
  for (let i = 0; i < 600; i++) Matter.Engine.update(engine, TIMESTEP);
} catch (e) {
  noError = false;
  console.error('  Error during stress test:', e);
}

const stressGems = gemBodies(engine);
const allFinite = stressGems.every(b => {
  const { x, y } = b.position;
  return Number.isFinite(x) && Number.isFinite(y);
});

assert('No errors during rapid cascade', noError);
assert('All remaining gem positions are finite', allFinite);
assert('Merges occurred during stress test', mergeCount > 0);
assert('Fewer gems remain than spawned (merges consumed some)', stressGems.length < 12);

// -- Summary ----------------------------------------------------------------
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);

if (failed > 0) process.exit(1);
