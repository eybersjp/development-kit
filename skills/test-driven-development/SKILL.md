---
name: test-driven-development
description: >-
  Applies Red-Green-Refactor for behavioural changes using project-native tests.
compatibility: opencode
---

# Test-Driven Development

## Overview

Use tests to define changed behaviour before implementation where practical and required by the task.

## When to Use

Behaviour changes, bug fixes and refactors that require regression protection.

## Process

1. RED: write/identify the smallest test that expresses the required behaviour; confirm the new behaviour is not already passing for the wrong reason.
2. GREEN: implement the minimum change that makes it pass.
3. Run relevant existing tests.
4. REFACTOR: simplify while keeping tests green.
5. Add edge/error/integration coverage required by risk and acceptance criteria.
6. Use browser/runtime tests for UI behaviour when required.

## Verification

- [ ] Changed behaviour has meaningful test evidence
- [ ] Relevant regressions pass
- [ ] Edge/error paths required by scope are covered
- [ ] Refactor did not introduce new behaviour
