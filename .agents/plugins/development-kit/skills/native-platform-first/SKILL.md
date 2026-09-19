---
name: native-platform-first
description: >-
  Prefers standard library, browser/runtime and framework-native capabilities before custom or third-party solutions.
compatibility: opencode
---

# Native Platform First

## Overview

Use the lowest-complexity capability already available to the project.

## When to Use

Before adding custom infrastructure or a dependency.

## Process

Evaluate in order:
1. existing project capability;
2. language standard library;
3. browser/OS/runtime native API;
4. framework built-in;
5. already-installed dependency;
6. small local implementation;
7. new dependency only with explicit justification.

Choose the first option that fully satisfies requirements, security, portability and maintainability.

## Verification

- [ ] Existing/native options were checked
- [ ] New dependency is necessary if added
- [ ] Portability/security constraints are preserved
