# phase03-cost-observatory-contract.mjs

## Purpose

`scripts/phase03-cost-observatory-contract.mjs` creates or reuses the Development Contract for **DKF120-T01 — Cost Observatory**.

The contract is normal DKF runtime state and is persisted under:

```text
.development-kit/contracts/INC-DKF120-T01/
```

That directory remains git-ignored. The script itself is committed so contract construction is reproducible from the authoritative v0.12 sources.

## Authoritative sources

The contract binds:

- the v0.12 Scale, Context & Iteration specification;
- the v0.12 technical design;
- the validated v0.12 implementation PLAN;
- the Phase 0/1 baseline evidence.

Whole-file fingerprints remain authoritative even when the contract requests selected sections for context delivery.

## Acceptance criteria

The T01 contract owns:

- `DKF-120-AC-001`
- `DKF-120-AC-002`
- `DKF-120-AC-003`
- `DKF-120-AC-033`

## Usage

```bash
node scripts/phase03-cost-observatory-contract.mjs
```

The script validates the resulting contract and immediately verifies that it is not stale.

If an existing contract has become stale, normal DKF stale-contract handling applies; the script does not silently overwrite it.

## Boundary

This script authorises only T01 Cost Observatory work. It does not authorise T02 or later v0.12 increments.
