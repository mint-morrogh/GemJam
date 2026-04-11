# Architecture Decision Records

## Overview

Architecture Decision Records (ADRs) capture the context and reasoning behind significant technical decisions.

---

## ADR-001: Project Initialization with HyperSpace

**Date**: 2026-04-10
**Status**: Accepted

### Context
This project was initialized using HyperSpace, which provides AI agent orchestration without prescribing a specific code structure.

### Decision
- Use HyperSpace for AI agent management
- Let AI agents determine code structure during development
- Follow task-driven workflow for task management

### Consequences
- **Positive**: Flexible architecture that adapts to actual needs
- **Positive**: AI agents can optimize structure based on real requirements
- **Negative**: Initial structure is minimal, requires AI to build out

---

## ADR-002: Tech Stack — TypeScript + Vite + Canvas 2D + Matter.js

**Date**: 2026-04-10
**Status**: Accepted

### Context
GemJam is a Suika-style merge game requiring physics simulation (gravity, circle collisions, stacking) and smooth rendering. BookBreaker proved that TypeScript + Vite + Canvas 2D delivers excellent mobile performance. However, BookBreaker's custom physics (ball-paddle bouncing) is simpler than what GemJam needs (multi-body gravity, stacking, friction, simultaneous collisions).

### Options Considered
1. **Full custom physics (like BookBreaker)**
   - Pros: Zero dependencies, full control
   - Cons: Massive effort to get stacking/friction/multi-collision right

2. **Matter.js for physics**
   - Pros: Proven rigid body engine, handles gravity/stacking/friction out of the box, ~60KB gzipped
   - Cons: Additional dependency, less control over collision internals

3. **Rapier.js (WASM physics)**
   - Pros: Very fast, deterministic
   - Cons: WASM loading complexity, overkill for 2D circle game

### Decision
Use Matter.js for physics, keeping the rest of the stack identical to BookBreaker (TypeScript, Vite, Canvas 2D). Matter.js handles the hard parts (gravity, stacking, friction, collision pairs) while we own rendering and game logic.

### Consequences
- **Positive**: Physics "just works" for stacking and merging
- **Positive**: Well-documented, large community
- **Positive**: Canvas 2D rendering stays in our control (we don't use Matter's renderer)
- **Negative**: ~60KB added to bundle
- **Risks**: Need to tune Matter.js params (restitution, friction, sleeping) for satisfying gem feel

---

## ADR-003: Mobile-First Virtual Resolution Scaling

**Date**: 2026-04-10
**Status**: Accepted

### Context
BookBreaker uses a virtual resolution (900x1200) that scales to fit viewport with DPR-aware canvas sizing. This approach eliminates per-device layout issues and keeps game logic resolution-independent.

### Decision
Adopt the same virtual resolution pattern:
- Virtual game space (e.g., 600x900 portrait)
- Canvas sized to viewport with `devicePixelRatio` scaling
- All game logic uses virtual coordinates
- Renderer applies scale transform

### Consequences
- **Positive**: One coordinate system for all devices
- **Positive**: Proven pattern from BookBreaker
- **Negative**: Must remember to convert touch coordinates from screen to virtual space

---

*Add new ADRs above this line*
