# Development Kit v0.12.0 — Phase 5 / DKF120-T03 Validation

**Status:** COMPLETE — ACCEPTED FOR PROGRESSION  
**Date:** 7 October 2026  
**Increment:** DKF120-T03 — Execution Capsules & Context Cache  
**Implementation branch:** `feature/v0.12-execution-capsules-context-cache`  
**Validated implementation head:** `765a64a577238d73169fc9ae91bb8697a76ded6d`  
**Validation PR:** #65  
**Implementation validation run:** `37672806212`

## 1. Development Contract

Observed T03 contract:

```text
Contract: INC-DKF120-T03
Task:     DKF120-T03
Schema:   1.3.0
Risk:     3
Stale:    false
```

Source fingerprint:

```text
sha256:db93ea4d721808aa351bfedffb17d5b65ad6defca34b8322089a18d742602baf
```

Workspace registry fingerprint:

```text
sha256:b5c3d286ab2b1b65c68e9ac17fbb6f45698986449ffb2129fa4666eff60f9c3e
```

Target binding:

```text
primary:      dkf-framework
affected:     dkf-framework
verification: dkf-framework
```

Acceptance criteria:

- `DKF-120-AC-008`
- `DKF-120-AC-009`
- `DKF-120-AC-010`
- `DKF-120-AC-011`
- `DKF-120-AC-035`

Derived gates:

```text
verification:
  specification
  tests

reviewers:
  architecture-reviewer
  code-reviewer
  security-reviewer

control domains:
  security

human approvals:
  none
```

## 2. Implemented capability

T03 adds:

- deterministic Execution Capsule schema/runtime;
- project-local repository context cache;
- target-scoped structural repository facts;
- relevant file fingerprints;
- relevant test fingerprints;
- target/dependency delta;
- upstream accepted-task references;
- verified runtime facts with explicit provenance;
- required future gate/profile references;
- deterministic cache-entry fingerprints;
- deterministic capsule fingerprints;
- cache/capsule staleness checks;
- target-aware invalidation;
- persisted configuration-state invalidation;
- capsule-aware `buildContextPackage()`;
- Cost Observatory comparison evidence.

Canonical acceleration storage:

```text
.development-kit/cache/context/
```

The cache is disposable and non-authoritative.

## 3. Acceptance criteria

### DKF-120-AC-008 — PASS

Fresh implementation and verification/review contexts can receive deterministic Execution Capsules.

Identical semantic inputs produce the same capsule identity across cache miss/hit and differing audit timestamps.

Verifier contexts remain independently rehydrated.

### DKF-120-AC-009 — PASS

Capsules become stale when relevant authority/repository state changes.

Covered invalidators include:

- Development Contract/source drift;
- workspace authority drift through normal contract staleness;
- relevant file content change;
- relevant test change through the same fingerprint mechanism;
- selected-target structure change;
- persisted configuration-registry change;
- missing or changed cache entry.

Stale capsules are rejected before role context construction.

### DKF-120-AC-010 — PASS

Repository/context caching has deterministic invalidation.

Verified behaviours:

- first use: MISS;
- same semantic inputs: HIT;
- relevant file change: MISS;
- selected target structural change: MISS;
- persisted configuration change: MISS;
- corrupted cache: safe MISS/rebuild;
- cache deletion: safe MISS/rebuild;
- unrelated unselected target change: existing target-scoped cache remains usable.

### DKF-120-AC-011 — PASS

Existing section-aware authoritative-source materialisation and source-fingerprint protections remain active.

With a capsule present:

- authoritative sources are still re-read;
- whole-file source fingerprints are still verified;
- only requested source sections are delivered where selectors resolve;
- stale Development Contracts continue to block context construction.

### DKF-120-AC-035 — PASS

Measured comparison evidence is available through the Cost Observatory.

Two-target fixture:

```text
logical context bytes:
  9,591 -> 7,053
  reduction: 26.46%

estimated context tokens:
  2,398 -> 1,764
  reduction: 26.44%

target-orientation scans:
  2 -> 1
  reduction: 50.00%

current cache:
  hits:   1
  misses: 0
```

These are focused T03 fixture results, not final release-wide v0.12 performance claims.

## 4. Authority model

Execution Capsules contain references and fingerprints rather than copied project history.

The capsule carries:

- contract/task/run/lifecycle references;
- authoritative source references/selectors/fingerprints;
- workspace target binding;
- repository cache reference/fingerprint;
- compact target facts;
- relevant file/test fingerprints;
- target/dependency delta;
- upstream accepted-task references;
- verified runtime facts with provenance;
- future gate/profile references.

Runtime facts are explicitly marked:

```text
non-authoritative-observation
```

The capsule cannot override specifications, architecture, Design Authority, Development Contracts, or acceptance evidence.

## 5. Context-package integration

`buildContextPackage()` remains the role-context constructor.

When a capsule is supplied it must pass freshness checks first.

Context isolation metadata can now distinguish:

```text
authoritativeSourcesReRead:    true
repositoryReRead:              false
repositoryContextFromCapsule:  true
capsuleFreshnessVerified:      true
```

This preserves independent source authority while avoiding repeated full repository reorientation.

## 6. Safety and cache failure behaviour

The cache is not canonical state.

If cache state is:

- absent -> rebuild;
- corrupt -> discard/rebuild;
- stale -> miss/rebuild;
- path-escaping -> reject;
- internally inconsistent -> reject.

An old capsule that references a missing/stale cache entry is itself stale.

The system does not silently fall back to trusting the old capsule.

## 7. Backward compatibility

Legacy non-target-aware Development Contracts remain supported.

They receive one generic project-root cache boundary rather than being forced to migrate to named targets before using T03.

Existing public commands remain unchanged.

Existing token/context efficiency and verification-isolation regressions remain green.

## 8. Verification

Focused T03 result:

```text
tests: 19
pass:  19
fail:  0
```

Implementation validation run `37672806212` passed on:

- Ubuntu;
- Windows.

It also passed the exact `release:validate` command on both operating systems.

## 9. Correction history

The T03 evidence trail preserves:

1. semantic cache identity originally included creation time;
2. absent Configuration Readiness state originally fingerprinted a synthetic timestamp, causing false cache misses;
3. cache I/O confinement was hardened;
4. changed files were made automatically relevant to invalidation;
5. cache-entry integrity is now validated directly during capsule creation;
6. explicit cost evidence was added.

See:

`dkf-execution-capsule-t03-review.md`

## 10. Performance interpretation

T03 proves that context and target-orientation reduction is measurable while preserving mandatory source rehydration and verification isolation.

The focused fixture does **not** yet meet or claim the final release objectives of:

- >=40% repeated context-volume reduction;
- >=60% redundant repository-read reduction;
- >=70% repeated full-repository orientation reduction.

Those remain release engineering objectives to be evaluated on representative workloads after the later v0.12 increments are integrated.

## 11. Acceptance decision

**DKF120-T03 — ACCEPTED FOR PROGRESSION**

This authorises only the next validated PLAN increment.

It does not:

- release v0.12.0;
- change package version 0.11.2;
- merge to `main`;
- create a release/tag;
- authorise later increments before their dependencies and Development Contracts are satisfied.

## 12. Next increment

```text
DKF120-T04 — State Engine V2
```

T04 must receive its own Development Contract before production implementation.
