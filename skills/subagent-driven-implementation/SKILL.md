---
name: subagent-driven-implementation
description: >-
  Uses fresh bounded implementation context for each approved task.
compatibility: opencode
---

# Subagent-Driven Implementation

## Overview

Fresh implementation roles prevent assumption bleed. Fresh does not mean re-send the whole project.

## When to Use

For each approved implementation task.

## Process

1. Build a compact context package from the active Development Contract.
2. Include objective, scope/exclusions, criterion IDs, required tests, relevant source sections and repository findings.
3. Spawn the implementation specialist with no previous-task narrative.
4. Implementation returns structured evidence: changed files, commands/tests, criterion assertions, dependency/architecture delta and open concerns.
5. Independent verification/review follows; the implementer never accepts its own work.
6. Do not start the next task until runtime gates permit it.

## Verification

- [ ] Fresh task-bounded context
- [ ] No irrelevant previous-task context
- [ ] Structured evidence returned
- [ ] Independent gates preserved
