// ---------------------------------------------------------------------------
// Planck.js (Box2D) physics wrapper for GemJam
// ---------------------------------------------------------------------------
// Box2D's sequential impulse solver handles circle stacking far better than
// Matter.js's position-based solver. This module wraps Planck.js and exposes
// pixel-coordinate helpers so the rest of the game doesn't need to think
// about meters/pixel conversion.

import { World, Vec2, Circle, Box, Edge, Body, Contact } from 'planck';
export type { Body } from 'planck';

// ---------------------------------------------------------------------------
// Coordinate conversion — Box2D works best with 0.1–10m objects
// ---------------------------------------------------------------------------

const PPM = 30; // pixels per meter

export function px(m: number): number { return m * PPM; }
export function m(px: number): number { return px / PPM; }

// ---------------------------------------------------------------------------
// Body ID system (Planck bodies have no numeric .id like Matter.js)
// ---------------------------------------------------------------------------

let _nextId = 1;
const _idMap = new WeakMap<Body, number>();

export function bodyId(b: Body): number {
  let id = _idMap.get(b);
  if (id == null) { id = _nextId++; _idMap.set(b, id); }
  return id;
}

// ---------------------------------------------------------------------------
// Convenience reads — all return PIXEL coordinates
// ---------------------------------------------------------------------------

export function bodyPos(b: Body): { x: number; y: number } {
  const p = b.getPosition();
  return { x: p.x * PPM, y: p.y * PPM };
}

export function bodyVel(b: Body): { x: number; y: number } {
  const v = b.getLinearVelocity();
  return { x: v.x * PPM, y: v.y * PPM };
}

export function bodyAngle(b: Body): number {
  return b.getAngle();
}

export function bodyAngVel(b: Body): number {
  return b.getAngularVelocity();
}

export function bodySpeed(b: Body): number {
  const v = b.getLinearVelocity();
  return Math.sqrt(v.x * v.x + v.y * v.y) * PPM;
}

export function bodyMass(b: Body): number {
  return b.getMass();
}

/** Get circle radius in pixels (first fixture assumed Circle). */
export function bodyRadius(b: Body): number {
  const f = b.getFixtureList();
  if (!f) return 0;
  const s = f.getShape() as any;
  return (s.getRadius?.() ?? 0) * PPM;
}

// ---------------------------------------------------------------------------
// World creation
// ---------------------------------------------------------------------------

export function createWorld(gravityY = 10): World {
  return new World(Vec2(0, gravityY));
}

// ---------------------------------------------------------------------------
// Body creation — all positions/sizes in PIXELS, converted internally
// ---------------------------------------------------------------------------

export interface DynCircleOpts {
  density?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  userData?: unknown;
}

export function createCircle(
  world: World,
  xPx: number,
  yPx: number,
  radiusPx: number,
  opts: DynCircleOpts = {},
): Body {
  const body = world.createDynamicBody({
    position: Vec2(m(xPx), m(yPx)),
    linearDamping: opts.linearDamping ?? 0.05,
    angularDamping: opts.angularDamping ?? 2.0,
    allowSleep: true,
    bullet: false,
  });
  body.createFixture({
    shape: Circle(m(radiusPx)),
    density: opts.density ?? 1.0,
    friction: opts.friction ?? 0.4,
    restitution: opts.restitution ?? 0.3,
  });
  if (opts.userData !== undefined) body.setUserData(opts.userData);
  bodyId(body); // assign ID eagerly
  return body;
}

export interface StaticRectOpts {
  friction?: number;
  restitution?: number;
}

export function createStaticRect(
  world: World,
  centerXPx: number,
  centerYPx: number,
  widthPx: number,
  heightPx: number,
  opts: StaticRectOpts = {},
): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(m(centerXPx), m(centerYPx)),
  });
  body.createFixture({
    shape: Box(m(widthPx / 2), m(heightPx / 2)),
    friction: opts.friction ?? 0.4,
    restitution: opts.restitution ?? 0.1,
  });
  return body;
}

/** Create a static segment for corner arcs. */
export function createStaticSegment(
  world: World,
  x1Px: number, y1Px: number,
  x2Px: number, y2Px: number,
  opts: StaticRectOpts = {},
): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(0, 0),
  });
  body.createFixture({
    shape: Edge(Vec2(m(x1Px), m(y1Px)), Vec2(m(x2Px), m(y2Px))),
    friction: opts.friction ?? 0.4,
    restitution: opts.restitution ?? 0.1,
  });
  return body;
}

// ---------------------------------------------------------------------------
// Body manipulation — pixel-coordinate inputs
// ---------------------------------------------------------------------------

export function setVelocity(b: Body, vxPx: number, vyPx: number): void {
  b.setLinearVelocity(Vec2(m(vxPx), m(vyPx)));
}

export function setAngularVelocity(b: Body, w: number): void {
  b.setAngularVelocity(w);
}

// ---------------------------------------------------------------------------
// Body iteration
// ---------------------------------------------------------------------------

export function allBodies(world: World): Body[] {
  const result: Body[] = [];
  for (let b = world.getBodyList(); b; b = b.getNext()) {
    result.push(b);
  }
  return result;
}

export function dynamicBodies(world: World): Body[] {
  const result: Body[] = [];
  for (let b = world.getBodyList(); b; b = b.getNext()) {
    if (b.isDynamic()) result.push(b);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Collision events
// ---------------------------------------------------------------------------

export function onBeginContact(
  world: World,
  cb: (bodyA: Body, bodyB: Body) => void,
): void {
  world.on('begin-contact', (contact: Contact) => {
    const a = contact.getFixtureA().getBody();
    const b = contact.getFixtureB().getBody();
    cb(a, b);
  });
}

// ---------------------------------------------------------------------------
// Corner arc — chain of edge segments approximating a quarter circle
// ---------------------------------------------------------------------------

export function createCornerArc(
  world: World,
  centerXPx: number,
  centerYPx: number,
  radiusPx: number,
  startAngle: number,
  endAngle: number,
  segments = 10,
  opts: StaticRectOpts = {},
): Body[] {
  const bodies: Body[] = [];
  for (let i = 0; i < segments; i++) {
    const a1 = startAngle + (endAngle - startAngle) * (i / segments);
    const a2 = startAngle + (endAngle - startAngle) * ((i + 1) / segments);
    const x1 = centerXPx + radiusPx * Math.cos(a1);
    const y1 = centerYPx + radiusPx * Math.sin(a1);
    const x2 = centerXPx + radiusPx * Math.cos(a2);
    const y2 = centerYPx + radiusPx * Math.sin(a2);
    bodies.push(createStaticSegment(world, x1, y1, x2, y2, opts));
  }
  return bodies;
}
