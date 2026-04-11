# GemJam

### [Play GemJam](https://mint-morrogh.github.io/GemJam/)

A merge-based physics puzzle game for mobile and desktop browsers. Drop, aim, and fire gems into a glass well — match two of the same tier to merge them into a bigger, more valuable gem. Chase high scores across escalating levels with a shake mechanic that literally rattles the entire well between rounds.

## Play

Open `index.html` in any modern browser, or run the dev server:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` on your phone (same Wi-Fi) or desktop.

## Controls

**Mobile:** Hold one finger to aim, tap with a second finger to fire. Keep holding to rapid-fire.

**Desktop:** Mouse to aim, left-click to fire.

## The Physics

GemJam uses **Planck.js** (a JavaScript port of Box2D) — the same physics solver the original Suika Game uses. This was a deliberate choice after starting with Matter.js and hitting its architectural limits with circle-on-circle stacking jitter.

**What makes it feel right:**

- **Box2D sequential impulse solver** handles stacked circles without vibration or jitter. Bodies sleep when at rest and wake instantly on contact.
- **Tier-scaled mass** — density scales linearly (0.8 to 2.0 kg/m2) while radius scales 20% per tier. Adjacent tiers can nudge each other, but a diamond outweighs a pebble 140:1.
- **Tier-scaled bounciness** — small gems are bouncy (restitution 0.5), big gems thud (0.2). A pebble ricochets off a topaz; the topaz barely notices.
- **Rounded bottom corners** — 12-segment edge chains approximate quarter-circle arcs (R=45px) at the bucket floor corners, so gems slide inward rather than wedging into sharp corners.
- **Momentum-conserving merges** — when two gems merge, the new gem inherits the mass-weighted average velocity of both parents. No sudden stops or teleportation.
- **Gravity oscillation shake** — the level-up shake doesn't push individual bodies. It rapidly swings the world gravity vector in random directions (60-110 m/s2, changing every 50-120ms), with friction and damping temporarily zeroed. A glass lid seals the well top so nothing escapes. The result is genuinely chaotic — gems bounce off every surface and each other.

## Gem Tiers

12 tiers from pebble to diamond, with a prestige rainbow cycle:

| Tier | Name | Radius | Points |
|------|------|--------|--------|
| 0 | Pebble | 24 | 2 |
| 1 | Ore | 29 | 5 |
| 2 | Geode | 35 | 12 |
| 3 | Cluster | 42 | 30 |
| 4 | Garnet | 50 | 80 |
| 5 | Sapphire | 60 | 200 |
| 6 | Emerald | 72 | 500 |
| 7 | Topaz | 86 | 1,200 |
| 8 | Amethyst | 103 | 3,000 |
| 9 | Aquamarine | 125 | 7,500 |
| 10 | Ruby | 149 | 18,000 |
| 11 | Diamond | 179 | 50,000 |

Two max-tier diamonds merge into a **rainbow pebble** that progresses through all tiers again with rainbow shimmer. Two rainbow diamonds vanish in a spectacular burst.

## Features

- **Peggle-style aiming** with trajectory preview that fades before showing the full path
- **Glass well** with specular edge highlights, floor vignette, and rounded physics corners
- **Gem sprites** — PNG assets with per-tier canvas colorization and circular clipping
- **Merge effects** — flash bursts, expanding rings, light rays, flying stars, screen shake (tier-scaled intensity)
- **Gem sparkles** — white shimmer stars on gem surfaces (tier 4+), rendered with additive blending
- **Level system** — score thresholds at 1.5x scaling, shake interlude with anime-style overlay
- **Persistence** — full game state (gem positions, velocities, queue, score, level) saved to localStorage on blur/visibility change. Resume exactly where you left off.
- **Pause overlay** on tab switch / app background
- **Top nav** with score, next-level points, current level, dropdown menu with restart and auto-shake toggle
- **Bottom gem queue** showing next 3 gems with flow arrows and glow ring on the active gem

## Tech Stack

- **Planck.js** (Box2D) — 2D physics
- **Canvas 2D** — all rendering, no DOM game elements
- **TypeScript** + **Vite** — build tooling
- **No frameworks** — zero dependencies beyond Planck and Vite

## Project Structure

```
src/
  main.ts              # Game loop, world setup, input wiring
  canvas.ts            # Virtual resolution, DPR scaling
  physics/
    planckWorld.ts     # Planck.js wrapper (px/meter conversion, helpers)
  game/
    gems.ts            # Tier definitions, grid config
    gemSpawner.ts      # Body creation with tier-scaled physics
    gemSprites.ts      # PNG sprite loading + canvas colorization
    launcher.ts        # Trajectory computation, launch velocity
    input.ts           # Aim + fire (mouse/touch unified)
    mergeDetector.ts   # Collision → merge queue
    mergeExecutor.ts   # Queue drain, body swap, momentum transfer
    mergeAnimation.ts  # Flash, ring, rays, stars, screen shake
    particles.ts       # Particle system + sparkles + shimmers
    levelShake.ts      # Level thresholds, shake state machine
    persistence.ts     # Save/restore to localStorage
    renderer.ts        # All canvas drawing (board, gems, HUD, overlays)
    dropdown.ts        # Nav bar dropdown menu
    state.ts           # Game state, overflow detection
    scoring.ts         # Score, combo, high score, leaderboard
    settings.ts        # User preferences
    storage.ts         # localStorage helpers
    ...
public/
  gems/spheres/        # Gem PNG assets
```

## License

MIT
