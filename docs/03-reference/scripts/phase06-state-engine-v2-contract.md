# phase06-state-engine-v2-contract.mjs

## Purpose

`scripts/phase06-state-engine-v2-contract.mjs` creates or reuses the Development Contract for **DKF120-T04 — State Engine V2**.

The contract is persisted through the normal DKF contract store under:

```text
.development-kit/contracts/INC-DKF120-T04/
```

The runtime contract directory remains git-ignored.

## Target binding

T04 binds to the accepted Workspace Target Engine registry:

```text
primary:      dkf-framework
affected:     dkf-framework
verification: dkf-framework
```

The exact `.development-kit/workspace.json` fingerprint is bound into the contract. Registry drift therefore makes the contract stale through normal DKF contract-staleness enforcement.

## Risk and derived gates

The validated PLAN classifies T04 as **High risk** because persistent-state migration and recovery are control-plane critical.

The contract uses risk level 3 and derives:

- specification verification;
- tests;
- migration verification;
- code review;
- architecture review;
- security review;
- security control-domain review.

No consequential-action human approval is derived at risk level 3.

## Acceptance criteria

The T04 contract owns:

- `DKF-120-AC-012`
- `DKF-120-AC-013`
- `DKF-120-AC-014`
- `DKF-120-AC-015`
- `DKF-120-AC-034`

## Canonical authority rule

T04 must preserve:

```text
events.jsonl   = canonical runtime history
snapshot.json  = derived current state
index.db       = disposable acceleration index
```

A binary or portable index can accelerate queries but may never become the only source of truth.

## Migration rule

Supported legacy migration must:

1. validate legacy state before conversion;
2. preserve a recoverable legacy backup;
3. preserve legacy files until verified cutover;
4. reconstruct semantic state through canonical events;
5. verify semantic equivalence;
6. be idempotent;
7. fail closed on corruption or mismatch.

T04 does not authorise deletion of legacy state.

## Usage

```bash
node scripts/phase06-state-engine-v2-contract.mjs
```

The script validates:

- the Development Contract;
- target binding;
- derived gates;
- contract staleness.

## Boundary

This script authorises only T04.

It does not authorise Lifecycle Instances, discovery/re-entry, Gate Profiles, the Verification Extension SDK, Complexity Delta Guard, Control Center v0.12 integration, release publication, or a package-version change.
