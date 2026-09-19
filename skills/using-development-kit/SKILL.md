---
name: using-development-kit
description: >-
  Always-on Development Kit operating rules and lifecycle routing.
compatibility: opencode
---

# Using Development Kit

## Overview

Always-on runtime capsule for DKF. `AGENTS.md`, the active command, Development Contract, and runtime gate state are authoritative. Do not restate them unnecessarily.

## When to Use

Always. Load once per session.

## Process

1. Follow the lifecycle: `UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE`.
2. Inspect before editing; clarify material ambiguity; specify non-trivial work before implementation.
3. Reuse existing code first, then standard/native capability, then installed dependencies, then the smallest local addition.
4. Break work into bounded tasks with acceptance criteria and verification.
5. Use fresh implementation context; implementation never self-verifies or self-accepts.
6. Treat the active command and Development Contract as the task-specific authority.
7. Run required independent verification/review gates before completion.
8. Do not start the next task while blocking failures remain.

## Delegation

The development conductor coordinates. Delegate implementation, verification, review, security, accessibility, design, database and backend/frontend work to the relevant specialist only when required by scope/risk.

## Verification

- [ ] Active command and contract are authoritative
- [ ] Required gates are preserved
- [ ] No self-certification
- [ ] No unnecessary dependency or abstraction
- [ ] Completion comes from runtime gate state
