# Project Structure

## Overview

GemJam follows the same architectural approach as BookBreaker: a pure TypeScript + Canvas 2D game with no UI framework. The game loop orchestrates physics (via Matter.js), state management, and rendering each frame. Modules are organized by concern (physics, rendering, game logic, UI).

## Directory Structure

```
project-root/
├── .claude/              # AI agent configurations
│   ├── agents/          # Specialized agent definitions
│   └── settings.json    # Agent model settings
│
├── docs/                 # Project documentation
│   ├── CHANGELOG.md     # Change history
│   ├── STRUCTURE.md     # This file
│   ├── WORKFLOW.md      # Development workflow
│   ├── ADR.md           # Architecture decisions
│   ├── TODO.md          # Task tracking
│   └── PRD.md           # Product requirements
│
├── src/                  # Source code
│   ├── main.ts          # Entry point, UI menus, game init
│   ├── game.ts          # Game class, loop orchestration, state
│   ├── physics.ts       # Matter.js setup, collision handling, merge detection
│   ├── renderer.ts      # Canvas rendering pipeline
│   ├── gems.ts          # Gem definitions (tiers, sizes, colors, sprites)
│   ├── scoring.ts       # Score calculation, combo system
│   ├── input.ts         # Touch/mouse input handling
│   ├── save.ts          # localStorage persistence
│   └── types.ts         # TypeScript interfaces
│
├── public/              # Static assets
│   └── index.html       # HTML shell
│
├── index.html           # Vite entry HTML
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── CLAUDE.md            # AI instructions
```

## Conventions

### File Naming
- `kebab-case.ts` for all source files
- One primary concern per file
- Types collected in `types.ts`

### Module Organization
- **game.ts** is the orchestrator — it owns state and calls into other modules
- **physics.ts** wraps Matter.js — game.ts never touches Matter directly
- **renderer.ts** is pure output — reads game state, draws to canvas
- **input.ts** is pure input — captures events, exposes current state

### Import Patterns
- Modules import types from `types.ts`
- Game imports from all modules; modules don't import from game
- No circular dependencies

---

*Last updated: 2026-04-10*
