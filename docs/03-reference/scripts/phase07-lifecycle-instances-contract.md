# phase07-lifecycle-instances-contract.mjs

## Purpose

`scripts/phase07-lifecycle-instances-contract.mjs` creates or reuses the Development Contract for **DKF120-T05 — Lifecycle Instances**.

The contract is persisted through normal DKF runtime contract storage under:

```text
.development-kit/contracts/INC-DKF120-T05/
```

The runtime contract directory remains git-ignored. The generator is committed so the contract can be reconstructed and validated from authoritative sources.

## Dependency

T05 depends on accepted **DKF120-T04 — State Engine V2**.

The contract binds the T04 acceptance evidence and uses the target-aware Workspace Target Engine binding:

```text
primary:      dkf-framework
affected:     dkf-framework
verification: dkf-framework
```

## Authoritative sources

The contract binds:

- the v0.12 Scale, Context & Iteration specification;
- the v0.12 technical design;
- the validated implementation PLAN;
- the accepted T04 State Engine V2 validation evidence.

## Acceptance criteria

T05 owns:

- `DKF-120-AC-016`
- `DKF-120-AC-017`
- `DKF-120-AC-018`

## Required gates

T05 is risk level 3.

Expected derived gates are:

- verification: specification + tests;
- reviewers: architecture-reviewer, code-reviewer, security-reviewer;
- control domain: security;
- no automatic human approval.

## Usage

```bash
node scripts/phase07-lifecycle-instances-contract.mjs
```

The script validates:

- Development Contract schema;
- target binding;
- derived reviewer/control gates;
- source/target staleness.

## Boundary

The contract authorises only Lifecycle Instances and generic project-state namespace separation.

It does not authorise:

- controlled re-entry;
- discovery events;
- Gate Profiles;
- Verification Extension SDK;
- Complexity Delta Guard;
- Control Center integration;
- application-specific lifecycle types;
- business-status-driven lifecycle completion.

Backward lifecycle movement remains outside T05 and belongs to T06.
