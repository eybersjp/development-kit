---
name: minimal-diff
description: >-
  Keeps implementation changes limited to the smallest approved surface.
compatibility: opencode
---

# Minimal Diff

## Overview

Change only what the active task requires. Small diffs reduce risk, review cost and context/token load.

## When to Use

During implementation and correction.

## Process

1. Start from Development Contract scope and allowed files/resources.
2. Modify only code required by acceptance criteria.
3. Avoid opportunistic refactors, unrelated formatting, renames and cleanup.
4. Reuse existing patterns instead of spreading new conventions.
5. During correction, obey the exact correction scope.
6. Report any required out-of-scope change instead of silently expanding the diff.

## Verification

- [ ] Every changed file supports current scope
- [ ] No unrelated cleanup/refactor
- [ ] No hidden scope expansion
