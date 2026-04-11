# Development Workflow

<!--
AI INSTRUCTIONS: This document describes the development workflow and processes.
Update this as you establish patterns for how work gets done.

WHEN TO UPDATE:
- When establishing new development processes
- When adding CI/CD pipelines
- When defining review/merge procedures
- When creating testing protocols

WHAT TO INCLUDE:
- Development cycle steps
- Branch naming conventions
- PR/commit guidelines
- Testing requirements
- Deployment procedures
-->

## Overview

This project uses AI agents coordinated through HyperSpace. All development follows the **Archon-first workflow**.

## Development Cycle

### 1. Task Management (Archon)

```
┌─────────────────────────────────────────────────┐
│  todo → doing → review → done                   │
└─────────────────────────────────────────────────┘
```

- All work starts with an Archon task
- Update status as you progress
- Never code without a tracked task

### 2. Research Phase

Before implementing:
```
archon:rag_search_knowledge_base(query="[relevant topic]")
archon:rag_search_code_examples(query="[pattern needed]")
```

### 3. Implementation

> **AI**: Document specific implementation guidelines as they're established.

### 4. Documentation

**MANDATORY**: Update `docs/CHANGELOG.md` before every commit.

### 5. Review

- Mark task as "review" when implementation complete
- Verify against acceptance criteria
- Run tests before marking "done"

## Git Workflow

> **AI**: Document branch strategy, commit conventions, and PR process as established.

### Branch Naming
- *To be defined during development*

### Commit Messages
```
<type>(<scope>): <description>

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Testing

> **AI**: Document testing strategy, coverage requirements, and test patterns as established.

## Deployment

> **AI**: Document deployment process when established.

---

*Last updated: Project initialization*
