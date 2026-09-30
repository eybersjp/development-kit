---
name: repository-orientation
description: >-
  Establishes or refreshes only the repository context needed for the current work.
compatibility: opencode
---

# Repository Orientation

## Overview

Understand the repository before editing, but do not repeat a full scan when valid project context already exists.

## When to Use

Use a full orientation for a new repository, stale/missing project context, architecture-level change, or material repository restructuring. Otherwise perform task-specific delta inspection.

## Process

1. Ensure project-local `.development-kit/` state exists.
2. Reuse a valid prior orientation snapshot when stack/architecture/conventions remain current.
3. For the current task, inspect only relevant entry points, configuration, source files, tests and dependency boundaries.
4. Refresh the broader orientation only when fingerprints/structure indicate material change.
5. Record concise findings: stack, relevant architecture flow, reusable assets, conventions, test locations and risks.

## Output

Return paths and concise findings, not copied source files or a full repository tree.

## Verification

- [ ] Relevant stack/architecture is known
- [ ] Existing reusable code was checked
- [ ] Test/convention locations are known
- [ ] Full re-scan occurred only when justified
