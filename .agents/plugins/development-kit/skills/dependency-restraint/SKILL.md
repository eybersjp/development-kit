---
name: dependency-restraint
description: >-
  Prevents unnecessary third-party dependencies and requires explicit justification for additions.
compatibility: opencode
---

# Dependency Restraint

## Overview

A dependency is architecture surface. Add one only when current project/native options do not meet the approved need.

## When to Use

Whenever implementation proposes a new package, service, SDK or framework.

## Process

1. Check existing project code, standard/native APIs and installed dependencies first.
2. Compare the proposed dependency against the smallest local implementation.
3. Consider maintenance, security, bundle/runtime cost, licensing and lock-in where relevant.
4. Add only when the benefit clearly exceeds those costs and contract/architecture policy permits it.
5. Record dependency/architecture delta for review.

## Verification

- [ ] No existing/native option satisfies the need
- [ ] Addition is inside contract scope
- [ ] Security/maintenance impact considered
- [ ] Dependency delta is reported
