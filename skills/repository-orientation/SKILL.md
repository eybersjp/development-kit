---
name: repository-orientation
description: >-
  Inspects a new or unfamiliar repository before changes begin. Understands
  project structure, conventions, and architecture before any work starts.
---

# Repository Orientation

## Overview

Inspects a new or unfamiliar repository before changes begin. Understands the project structure, file organisation, conventions, dependencies, architecture patterns, testing approach, and deployment model before any work starts.

## When to Use

- When starting work on an unfamiliar repository
- When the repository-scout is gathering task context
- Before making any changes to a project you haven't worked on before
- At the start of a new session in an existing project

## Process

### 1. Analyse Project Structure

Read the top-level directory listing. Identify:
- Configuration files (package.json, tsconfig, Dockerfile, etc.)
- Source directory organisation
- Test directory organisation
- Documentation location

### 2. Understand the Stack

From configuration files, determine:
- **Language**: TypeScript, Python, Go, Rust, etc.
- **Framework**: React, Next.js, Express, Django, etc.
- **Database**: PostgreSQL, SQLite, MongoDB, etc.
- **Testing**: Jest, pytest, Playwright, etc.
- **Build tools**: Webpack, Vite, esbuild, etc.

### 3. Identify Architecture Patterns

Review existing source code to understand:
- Module/component organisation
- Data flow patterns
- State management approach
- Routing and navigation
- API patterns
- Error handling conventions
- Testing patterns and locations

### 4. Find Conventions

Identify implicit project conventions:
- Naming conventions (camelCase, kebab-case, PascalCase)
- File organisation (feature-based, type-based)
- Import/export patterns
- Code style
- Commit message format
- Branch naming

### 5. Produce Orientation Report

Provide a structured report covering:
- **Stack**: Languages, frameworks, databases, tools
- **Architecture**: High-level architecture overview
- **Entry Points**: Where to start reading
- **Testing**: Where tests live, what testing framework is used
- **Key Files**: Important configuration and source files
- **Conventions**: Patterns to follow
- **Risks**: Common pitfalls or areas of complexity

## Orientation Report Template

```
## Repository Orientation

### Stack
[Languages, frameworks, databases, tools]

### Architecture
[High-level overview]

### Entry Points
[Where to start reading]

### Testing
[Testing framework, test locations, patterns]

### Key Files
- `path/to/file` — What it does

### Conventions
[Patterns to follow]

### Risks
[Areas of complexity or common pitfalls]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I've worked on this repo before, I know it" | Even familiar repos change. Re-orient to catch new patterns. |
| "I'll learn as I go" | That leads to inconsistent code and missed conventions. |
| "The repo is simple, I don't need orientation" | Simple repos still have conventions. 5 minutes of orientation prevents 30 minutes of rework. |

## Red Flags

- Changes are made without reading existing code
- New code doesn't match existing patterns
- The project structure is misunderstood
- Dependencies are added when the project already has them
- Test patterns are violated

## Verification

- [ ] Project stack is identified
- [ ] Architecture patterns are understood
- [ ] Key configuration files are read
- [ ] Testing conventions are identified
- [ ] Orientation report is produced before changes begin
