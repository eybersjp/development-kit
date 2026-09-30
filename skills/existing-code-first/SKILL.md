---
name: existing-code-first
description: >-
  Requires searching for reusable project code before creating new implementation.
compatibility: opencode
---

# Existing Code First

## Overview

Prefer extension/reuse over duplicate implementation.

## When to Use

Before creating a new module, component, helper, service, abstraction or pattern.

## Process

1. Search the task-relevant code paths and repository orientation findings.
2. Identify existing behaviour, utilities, components, tests and conventions that overlap the requirement.
3. Reuse directly when behaviour already exists; extend locally when a small compatible change is sufficient.
4. Create new code only when reuse/extension would be incorrect or more complex.
5. Record the reuse decision when a new abstraction is introduced.

## Verification

- [ ] Relevant existing code was inspected
- [ ] Duplicate behaviour was not introduced
- [ ] New abstraction has a concrete current need
