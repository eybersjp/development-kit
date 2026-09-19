---
name: verification-before-completion
description: >-
  Requires fresh evidence for required criteria before work can be represented complete.
compatibility: opencode
---

# Verification Before Completion

## Overview

Claims are not evidence. Completion comes from the runtime acceptance state after required independent verification/reviews.

## When to Use

Before any task, increment or release is represented as complete.

## Process

1. Rehydrate the current Development Contract/source fingerprint independently.
2. Verify each required criterion/control using its required evidence type.
3. Record PASS, FAIL, PARTIAL, UNVERIFIED or NOT_APPLICABLE with concrete evidence/reason.
4. Run required reviewers and control manifests.
5. Reverify after corrective/simplifying code changes.
6. Represent completion only when deterministic acceptance is `ACCEPTED`.

## Verification

- [ ] Evidence is current
- [ ] Required criteria/controls covered
- [ ] No implementation self-certification
- [ ] Required reviews complete
- [ ] Acceptance state is authoritative
