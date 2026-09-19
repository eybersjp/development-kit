---
name: context-packing
description: >-
  Builds the smallest task-complete context package for a DKF role.
compatibility: opencode
---

# Context Packing

## Overview

Provide enough authority to perform the current role without repeating unrelated project material.

## When to Use

At every role handoff or fresh/rehydrated agent context.

## Process

1. Include task objective, scope/exclusions, criterion IDs, required verification and only relevant source sections.
2. Prefer paths, fingerprints, IDs, line ranges and evidence references over copied prose.
3. Use Development Contract `authoritativeSources[].sections`; do not send full files when scoped sections resolve.
4. Include repository findings only for files/patterns relevant to the current task.
5. Exclude unrelated docs, previous-task narrative, full project trees and duplicated methodology instructions.
6. If a required selector cannot resolve, fail safe to authoritative full-source fallback rather than silently omitting content.
7. Check `tokenProfile`; if over budget, remove duplication or improve section selectors before removing required authority.

## Verification

- [ ] Required authority is present
- [ ] Source fingerprints remain valid
- [ ] Scoped sections are used where available
- [ ] No avoidable full-file copies
- [ ] No repeated narrative where references suffice
