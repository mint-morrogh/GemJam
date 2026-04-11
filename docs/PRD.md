# Product Requirements Document

## Project Overview

### Name
GemJam

### Description
GemJam is a Suika-style gem merging browser game with roguelike upgrade mechanics. Players drop gems into a container where matching gems merge into larger, more valuable gems. The game combines satisfying physics-based merge mechanics with roguelike progression systems for replayability.

### Problem Statement
Casual mobile gamers want quick, satisfying puzzle-merge experiences they can play in a browser without installing an app. Suika Game proved the merge-drop formula is deeply engaging, but few browser-native alternatives exist with roguelike depth.

### Goals
1. Deliver a polished, mobile-first Suika-style merge game playable in any browser
2. Add roguelike upgrade mechanics for run-based replayability
3. Achieve smooth 60fps on mid-range mobile devices
4. Ship a playable MVP for mobile testing ASAP

---

## Users & Personas

### Primary Users
- **Casual mobile gamers**: Play in short sessions (2-10 min), want instant-load browser games
- **Merge/puzzle fans**: Enjoy Suika Game, 2048, merge-style mechanics
- **Roguelike fans**: Want progression depth beyond pure high-score chasing

### User Needs
| User Type | Need | Priority |
|-----------|------|----------|
| Casual gamer | Instant load, no install, tap-to-play | Critical |
| Mobile user | Responsive touch controls, fits any screen | Critical |
| Puzzle fan | Satisfying merge feedback (visual + audio) | High |
| Roguelike fan | Meaningful choices between runs | Medium |

---

## Features & Requirements

### Core Features (MVP)

1. **Gem Drop Mechanic**: Tap/click to drop gems into a container
   - Horizontal position control via touch/mouse
   - Preview of next gem
   - Gravity pulls gems down into the container

2. **Gem Merging**: Two identical gems touching merge into the next tier
   - Merge chain: produces satisfying visual/particle feedback
   - Each merge tier = larger gem + more points
   - Gem tier progression (small to large, ~8-10 tiers)

3. **Physics Container**: Walled container with gravity
   - Gems stack, roll, and settle realistically
   - Circle-circle and circle-wall collision
   - Game over when gems overflow the top line

4. **Scoring System**: Points awarded on merge
   - Higher tier merges = exponentially more points
   - Combo multiplier for chain merges
   - High score persistence (localStorage)

5. **Mobile-First UI**: Responsive touch interface
   - Portrait orientation optimized
   - Touch to position + release to drop
   - Score, next gem preview, game over overlay

### Future Features (Post-MVP)
- Roguelike upgrade shop between runs (pick 1 of 3 upgrades)
- Special gem types (bomb gem, wildcard gem, freeze gem)
- Daily challenge mode with seeded RNG
- Gem skins/themes
- Combo system with visual flourishes
- Achievement system
- Sound effects and music

---

## Technical Requirements

### Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Language | TypeScript | Type safety, same as BookBreaker |
| Build | Vite | Fast dev server, simple config, proven in BookBreaker |
| Rendering | HTML5 Canvas 2D | Direct pixel control, performant on mobile |
| Physics | Matter.js | Rigid body gravity + circle collision + stacking (more complex than BookBreaker's custom physics) |
| Hosting | GitHub Pages | Free, simple, `/GemJam/` base path |
| Persistence | localStorage | High scores, settings, run state |

### Non-Functional Requirements

- **Performance**: 60fps on mid-range mobile (iPhone SE 2, Pixel 5 class)
- **Load time**: < 2s to interactive on 4G
- **Bundle size**: < 500KB gzipped
- **Browser support**: Modern evergreen browsers (Chrome, Safari, Firefox)
- **Offline**: Fully playable offline after first load

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mobile FPS | 60fps sustained | DevTools performance tab |
| Load time | < 2s to playable | Lighthouse |
| Touch responsiveness | < 16ms input lag | Manual testing |
| Session length | 3-10 min average | Analytics (future) |

---

## Constraints & Assumptions

### Constraints
- Browser-only (no native app)
- No backend/server required for MVP
- Must work on mobile Chrome and Safari

### Assumptions
- Matter.js provides sufficient physics fidelity for merge detection
- Canvas 2D is performant enough (no WebGL needed for MVP)
- Portrait-only is acceptable for MVP

### Dependencies
- Matter.js (physics engine)
- Vite (build tooling)
- @chenglou/pretext (text measurement, from BookBreaker stack)

---

## Timeline

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Project Setup | 2026-04-10 | Complete |
| Docs & Planning | 2026-04-10 | Complete |
| Core Physics + Rendering | TBD | Todo |
| Gem Drop + Merge Mechanic | TBD | Todo |
| Scoring + UI | TBD | Todo |
| Mobile Polish + Testing | TBD | Todo |
| MVP Playable | TBD | Todo |

---

*Last updated: 2026-04-10*
