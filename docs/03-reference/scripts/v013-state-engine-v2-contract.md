# v013-state-engine-v2-contract.mjs

## Purpose

`scripts/v013-state-engine-v2-contract.mjs` creates or reuses the Development Contract for **DKF130-T04 — State Engine V2**, the first v0.13 priority carried forward from deferred DKF120-T04.

The runtime contract is persisted under:

```text
.development-kit/contracts/INC-DKF130-T04/
```

The directory remains git-ignored. The committed generator makes contract construction reproducible from the exact v0.13 authority files.

## Bound authority

The contract fingerprints:

- `dkf-v0.13-state-engine-v2-specification.md`;
- `dkf-v0.13-t04-release-authority.md`;
- the released v0.12.1/v0.12.0 changelog baseline;
- the historical v0.12 State Engine technical design and PLAN as supporting context.

## Restored acceptance criteria

- `DKF-120-AC-012`
- `DKF-120-AC-013`
- `DKF-120-AC-014`
- `DKF-120-AC-015`
- `DKF-120-AC-034`

These retain their original IDs because v0.12 explicitly deferred rather than replaced them.

## High-assurance gates

The contract is risk level 3 and binds the high-assurance Gate Profile.

Expected effective gates:

```text
verification:
  architecture-verification
  security-audit
  specification
  tests

reviewers:
  architecture-reviewer
  code-reviewer
  security-reviewer

control domains:
  security
```

T04 cannot be accepted from tests alone.

## Target binding

```text
primary:      dkf-framework
affected:     dkf-framework
verification: dkf-framework
```

## Usage

```bash
node scripts/v013-state-engine-v2-contract.mjs
```

The generator validates source freshness, target freshness and effective gates immediately.

## Boundary

The contract does not authorize:

- application/domain-specific state policy;
- distributed locking;
- Issue #72 hostile same-account writer hardening;
- removal of v0.12.1 features;
- release publication;
- deletion of retained legacy recovery assets.
