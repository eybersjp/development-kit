# phase05-execution-capsule-contract.mjs

## Purpose

`scripts/phase05-execution-capsule-contract.mjs` creates or reuses the Development Contract for **DKF120-T03 — Execution Capsules & Context Cache**.

The contract is persisted through the normal DKF contract store under:

```text
.development-kit/contracts/INC-DKF120-T03/
```

The runtime contract directory remains git-ignored.

## Target binding

T03 is the first Scale, Context & Iteration increment that is created after the Workspace Target Engine is available.

Its Development Contract therefore binds:

```text
primary:      dkf-framework
affected:     dkf-framework
verification: dkf-framework
```

and stores the exact fingerprint of:

```text
.development-kit/workspace.json
```

If that registry changes after contract creation, the T03 contract becomes stale.

## Risk and derived gates

The validated PLAN classifies T03 as **High risk** because an incorrect cache hit could feed stale repository context into implementation or independent verification.

Under the current DKF gate selector, risk level 3 derives:

- specification verification;
- tests;
- code review;
- architecture review;
- security review;
- security control-domain review.

No human consequential-action approval is derived at risk level 3.

## Acceptance criteria

The T03 contract owns:

- `DKF-120-AC-008`
- `DKF-120-AC-009`
- `DKF-120-AC-010`
- `DKF-120-AC-011`
- `DKF-120-AC-035`

## Usage

```bash
node scripts/phase05-execution-capsule-contract.mjs
```

The script validates:

- the Development Contract;
- target binding;
- derived gates;
- contract staleness.

## Boundary

This script authorises only T03.

It does not authorise State Engine V2, Lifecycle Instances, discovery/re-entry, Gate Profiles, the Verification Extension SDK, Complexity Delta Guard, Control Center v0.12 integration, release publication, or a package-version change.
