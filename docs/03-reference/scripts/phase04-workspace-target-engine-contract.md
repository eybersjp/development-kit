# phase04-workspace-target-engine-contract.mjs

## Purpose

`scripts/phase04-workspace-target-engine-contract.mjs` creates or reuses the Development Contract for **DKF120-T02 — Workspace Target Engine**.

The contract is persisted through the normal DKF runtime contract store under:

```text
.development-kit/contracts/INC-DKF120-T02/
```

That runtime directory remains git-ignored.

## Bootstrap note

T02 introduces Workspace Target Engine support itself.

Therefore the T02 Development Contract is created **without** a workspace target binding. This is intentional bootstrap behaviour: target binding cannot be mandatory for the increment that first creates the target engine.

After T02 acceptance, target-aware Development Contracts may bind:

- primary target;
- affected targets;
- verification targets;
- the exact workspace-registry fingerprint.

A later change to that registry then makes the target-aware contract stale.

## Authoritative sources

The contract binds:

- the v0.12 Scale, Context & Iteration specification;
- the v0.12 technical design;
- the validated v0.12 implementation PLAN;
- accepted T01 evidence;
- the Phase 0/1 multi-package baseline.

## Acceptance criteria

The T02 contract owns:

- `DKF-120-AC-004`
- `DKF-120-AC-005`
- `DKF-120-AC-006`
- `DKF-120-AC-007`
- `DKF-120-AC-039`

## Usage

```bash
node scripts/phase04-workspace-target-engine-contract.mjs
```

The script validates the contract, confirms its derived gates, and verifies that it is not stale.

## Boundary

This script authorises only T02 Workspace Target Engine work. It does not authorise T03 or later v0.12 increments.
