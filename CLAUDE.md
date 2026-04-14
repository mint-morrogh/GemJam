# Task Management — Nexus (MANDATORY)

Nexus is the **single source of truth** for all project tasks. You MUST maintain it — this is not optional.

## Hard Rules (never skip these)

1. **Every request = a task.** When the user asks you to do anything (fix a bug, add a feature, refactor, investigate), FIRST create or find the matching Nexus task, THEN do the work. No exceptions, even for "small" or "quick" requests.
2. **Before working** → `hyperspace tasks update <id> --status in_progress`
3. **After completing work** → `hyperspace tasks update <id> --status review` — do this IMMEDIATELY when you finish, before responding.
4. **Discovered sub-work** → `hyperspace tasks add "title" --priority <level>` — if you find bugs, tech debt, or follow-up work while implementing, add them as new tasks.
5. **NEVER mark tasks "done"** — only move to "review". The user verifies and marks done.
6. **Start of session** → `hyperspace tasks list` — always check the board before doing anything.

## Task Lifecycle

```
User request → find/create task → set in_progress → do work → set review
```

Every piece of work flows through this. If no matching task exists, create one first.

## Commands

```bash
hyperspace tasks list                        # Active tasks (non-done)
hyperspace tasks list --all                  # All tasks including done
hyperspace tasks list --status todo          # Filter by status
hyperspace tasks add "Fix auth bug" --priority high
hyperspace tasks update <id> --status in_progress
hyperspace tasks update <id> --title "New title" --description "Details"
hyperspace tasks done <id>                   # Shorthand for --status done
hyperspace tasks search "auth"               # Search by title/description
```

Statuses: `todo`, `in_progress`, `review`, `done`
Priorities: `critical`, `high`, `medium`, `low`
IDs: Use first 8 chars of the task UUID.

---

Be extremely concise. Sacrifice grammar for the sake of concision.

# GemJam

GemJam is a Merge Based web browser game with roguelike upgrade mechanics

## Tech Stack

*Not yet defined*

## Project Guidelines

This project was initialized with HyperSpace. Follow these guidelines:

### Development Workflow

1. **Task-Driven Development**: Always work from tracked tasks (use `hyperspace tasks` CLI)
2. **Documentation First**: Update Obsidian/docs/CHANGELOG.md with all changes
3. **Structure as Needed**: Create directories and files following best practices for the chosen stack

### Agent System

This project uses specialized AI agents defined in `.claude/agents/`:

| Agent | Model | Role |
|-------|-------|------|
| **Maestro** | opusplan | Orchestrates and decomposes complex tasks |
| **Frontend-Dev** | opus | UI/UX implementation |
| **Backend-Dev** | opus | API and server development |
| **Unicorn** | opus | Full-stack features |
| **Paladin** | opus | Testing and QA |
| **Octocat** | opus | Git/GitHub operations |
| **Quill** | opus | Documentation |
| **Spyglass** | opus | Research and analysis |

### Key Documentation

- **Obsidian/docs/PRD.md** - Product requirements (update as requirements evolve)
- **Nexus Board** - Task tracking via `hyperspace tasks` CLI
- **Obsidian/docs/STRUCTURE.md** - Document architecture as you build
- **Obsidian/docs/WORKFLOW.md** - Development processes
- **Obsidian/docs/ADR.md** - Record architectural decisions
- **Obsidian/docs/CHANGELOG.md** - Track all changes (MANDATORY before commits)

### Changelog Maintenance

**CRITICAL**: Update `Obsidian/Obsidian/docs/CHANGELOG.md` before every commit.

Categories:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Fixed**: Bug fixes
- **Security**: Security improvements
- **Deprecated**: Soon-to-be removed features
- **Removed**: Deleted features

### Documentation Discipline

**CRITICAL**: Whenever you make changes to the codebase, you MUST also update relevant documentation in the `Obsidian/docs/` folder:

| Document | Update When |
|----------|-------------|
| **Nexus** (`hyperspace tasks`) | Tasks completed, new tasks discovered, priorities changed |
| **CHANGELOG.md** | **ALWAYS** - every change needs a record |
| **ADR.md** | Architectural decisions made (new patterns, libraries, approaches) |
| **STRUCTURE.md** | New components, modules, or significant refactoring |
| **PRD.md** | Requirements clarified or changed during implementation |
| **WORKFLOW.md** | Development process refined or changed |

This discipline is required even in normal (non-Memento) sessions. The `Obsidian/docs/` folder is the project's memory - it enables:
- Future sessions to understand context
- Memento Loop Mode to operate effectively
- Team members to stay in sync
- AI agents to make informed decisions

### Memento Loop Mode

This project supports **Memento Loop Mode** - an autonomous build/verify loop. Files are in `memento/`:
- `BUILD_PROMPT.md` - Instructions for builder sessions
- `VERIFY_PROMPT.md` - Instructions for verification sessions
- `PROGRESS.md` - Tracks incomplete work between sessions

To start Memento Loop Mode: `hyperspace start --memento` or select "Memento Loop Mode" at launch.
