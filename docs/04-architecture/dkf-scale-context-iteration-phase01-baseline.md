# DKF Scale, Context & Iteration — Phase 0/1 Baseline

**Status:** Completed baseline evidence  
**Date:** 7 October 2026  
**Repository:** `eybersjp/development-kit`  
**Authoritative main baseline:** `62badbf7d0abee3344b1f5db2b2fbc876cf004e2`  
**Analysis branch:** `analysis/scale-context-iteration-phase01`  
**Baseline CI run:** GitHub Actions run `37618731275`  
**Current framework version:** `0.11.2`

## 1. Purpose

This document records Phase 0 repository reconnaissance and Phase 1 measurements for the Scale, Context & Iteration initiative.

No DKF production runtime behaviour, package version, release tag, publication path, safety gate, acceptance rule, or verification rule was changed to obtain this baseline.

The baseline runner is `scripts/phase01-scale-context-baseline.mjs`.

## 2. Phase 0 findings

### 2.1 Release/version finding

The approved working specification originally proposed `v0.11.0`.

The live repository is already `0.11.2`, and `v0.11.0`, `v0.11.1`, and `v0.11.2` already exist in release history.

The repository versioning policy defines backwards-compatible new runtime capabilities as a MINOR increment.

**Recommended feature release target: `v0.12.0`.**

No version change is made during Phase 0/1.

### 2.2 Current repository baseline

The authoritative main commit contained:

| Measure | Main baseline |
|---|---:|
| Repository files | 793 |
| Repository bytes | 4,643,607 |
| Runtime files | 73 |
| Script files | 74 |
| Test files (`*.test.mjs`) | 62 |
| Agent files | 18 |
| Command files | 16 |
| Skill files | 64 |
| Schema files | 11 |
| Documentation files | 313 |

The analysis branch adds only diagnostic/reference material required to execute this baseline.

### 2.3 Existing token/context work is substantial

The current framework already contains:

- section-aware authoritative-source materialisation;
- whole-file fingerprint/staleness protection;
- role-specific context packages;
- advisory role context budgets;
- static instruction token budgets;
- fail-safe full-source fallback when a requested selector cannot be resolved;
- independent verification contexts;
- policy guidance for cache-first repository orientation.

Therefore the new initiative must extend this implementation rather than recreate it.

### 2.4 Current state persistence confirms the micro-file scaling concern

Autopilot currently persists immutable workflow snapshots as:

```text
.development-kit/autopilot/state/
  revision-000001.json
  revision-000002.json
  ...
  current.json
```

Orchestration runs separately persist:

```text
runs/<contract>/<run>/
  manifest.json
  state-revisions/00000001.json
  state-revisions/00000002.json
  ...
  current-state.json
  final-state.json
```

This gives strong auditability and recovery, but state-file count grows with state transitions at both workflow and run level.

### 2.5 Context rehydration is already safe but remains expensive by design

`buildContextPackage()`:

- validates Development Contract staleness;
- verifies authoritative source fingerprints;
- materialises requested source sections;
- creates fresh/rehydrated role context;
- prevents implementation output from becoming authority.

However, the current context metadata still declares `repositoryReRead: true`, and no first-class workspace-target/context-cache engine exists.

### 2.6 Current gate selection is risk-aware but not domain-aware

The gate selector currently understands:

- specification verification;
- required verification declared by the contract;
- code review;
- architecture sensitivity;
- security sensitivity;
- UI/design sensitivity;
- configuration dependencies;
- human approvals.

It does not yet provide first-class numerical/engineering/financial/domain verification profiles.

### 2.7 Current lifecycle remains one canonical global sequence

The current Autopilot state machine still governs:

```text
UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE
```

There is no first-class parent/child Lifecycle Instance or formal discovery-driven minimum re-entry model.

## 3. Phase 1 execution evidence

The baseline was executed through the repository's normal CI matrix using Node `v22.23.3`.

Both platforms passed the complete CI matrix:

| Platform | Result |
|---|---|
| Ubuntu | PASS |
| Windows | PASS |

The same run also passed all existing validation before and after the new baseline step, including orchestration, evidence/control coverage, v0.9 reliability regressions, Live UI Preview, token/context efficiency, Design Authority, Autopilot, and exact release-command validation.

## 4. Existing static token baseline

The current estimator is `chars-div-4-v1`. These values are deterministic local approximations, not provider billing-token measurements.

### Ubuntu

| Measure | Current | Historical baseline | Reduction | Budget |
|---|---:|---:|---:|---:|
| Priority runtime skills | ~2,820 | 10,436 | 72.98% | <=3,300 |
| Implementation hot path | ~7,587 | 19,994 | 62.05% | <=9,000 |

### Windows

| Measure | Current | Historical baseline | Reduction | Budget |
|---|---:|---:|---:|---:|
| Priority runtime skills | ~2,901 | 10,436 | 72.20% | <=3,300 |
| Implementation hot path | ~7,747 | 19,994 | 61.25% | <=9,000 |

Both platforms are inside the existing budgets.

### Measurement-quality finding

The Windows checkout contains CRLF line endings while Ubuntu uses LF. Because the current estimator counts raw characters, the same logical instruction set reports different values:

- priority-runtime difference: 81 estimated tokens (~2.87%);
- implementation-hot-path difference: 160 estimated tokens (~2.11%);
- analysis-branch repository-byte difference: 86,297 bytes (~1.85%).

This is not evidence of actual model-token drift.

The future Cost Observatory should normalise line endings for cross-platform deterministic context-size comparisons while preserving the existing estimator's historical regression compatibility where required.

## 5. Representative context fixtures

### 5.1 Single-package fixture

Synthetic workspace files: **32**

| Measure | Result |
|---|---:|
| Raw authoritative-source tokens | 359 |
| Delivered authoritative-source tokens | 65 |
| Source reduction | 81.89% |
| Estimated complete context package | 1,166 |
| Role budget exceeded | No |
| Source delivery | Scoped |
| Selected verification | specification + tests |
| Selected reviewer | code-reviewer |

### 5.2 Multi-package fixture

Synthetic workspace files: **265**

Represented topology:

```text
apps/web
apps/mobile
packages/shared
packages/calculations
supabase/migrations
```

| Measure | Result |
|---|---:|
| Raw authoritative-source tokens | 1,405 |
| Delivered authoritative-source tokens | 76 |
| Source reduction | 94.59% |
| Estimated complete context package | 3,190 |
| Role budget exceeded | No |
| Source delivery | Scoped |
| Selected verification | specification + tests |
| Selected reviewer | code-reviewer |

The source materialisation is efficient, but the current runtime has no first-class concept of `@web`, `@mobile`, `@database`, `@calculations`, target-specific command routing, or target dependency closure.

### 5.3 Calculation-heavy fixture

Synthetic workspace files: **150**

| Measure | Result |
|---|---:|
| Raw authoritative-source tokens | 2,410 |
| Delivered authoritative-source tokens | 180 |
| Source reduction | 92.53% |
| Estimated complete context package | 2,129 |
| Role budget exceeded | No |
| Source delivery | Scoped |
| Selected verification | specification + tests |
| Selected reviewer | code-reviewer |

This is the key domain-verification baseline.

Despite the fixture being explicitly calculation-heavy, current gate selection still resolves only generic specification/tests plus code review. There is no automatic numerical tolerance, invariant, unit, golden-dataset, replay, or engineering sanity gate.

## 6. Legacy state-growth fixture

A real `saveStateRevision()` loop was executed for **26 revisions**.

Measured result on both platforms:

| Measure | Result |
|---|---:|
| Requested revisions | 26 |
| Immutable revision files | 26 |
| Pointer files | 1 |
| Total workflow state files | 27 |
| Total state bytes | 17,537 |
| Files per revision (including pointer amortisation) | ~1.038 |

This fixture measures only the Autopilot workflow-level state store.

It does **not** include the additional per-run orchestration revision chains, contracts, evidence records, IDEA journals/receipts, memory data, UI-preview state, or other project-local runtime state.

Therefore it confirms the linear micro-file behaviour but should not be interpreted as the total state cost of a complex project.

## 7. Observability gaps

The current DKF runtime cannot centrally report the following as measured orchestration costs:

| Metric | Current status |
|---|---|
| Provider billing/input/output tokens | Unavailable |
| Repository file-read count per run | Unavailable |
| Repository-orientation scan count per run | Unavailable |
| Host agent invocation count per run | Unavailable |
| Host tool-call count per run | Unavailable |

The framework already measures estimated context size and static instruction size.

It does **not** yet have the end-to-end Cost Observatory needed to prove file-read, reorientation, agent-call, tool-call, and provider-token improvements.

These values must remain `null/unavailable` until instrumented. They must not be inferred.

## 8. Baseline conclusions

### Confirmed strengths

1. Source section scoping is already highly effective in all three fixtures.
2. Whole-file source authority and independent verification remain intact.
3. Existing token budgets are comfortably green.
4. Existing control-plane regression coverage remains green on Ubuntu and Windows.
5. Documentation governance correctly blocked an undocumented diagnostic script during the first baseline attempt; the analysis work had to comply with the documentation contract rather than bypass it.

### Confirmed gaps

1. **State micro-file growth is real.**
2. **Workspace targets are not first-class.**
3. **Calculation/domain verification is not first-class.**
4. **Lifecycle nesting/re-entry is not first-class.**
5. **Runtime context costs beyond estimated package size are not centrally observable.**
6. **Repository context reuse is policy-level rather than a complete target-aware cache/invalidation engine.**
7. **Cross-platform static token measurements need newline normalisation for exact comparability.**

## 9. Impact on the approved initiative

The implementation sequence remains valid, but the repository evidence changes the emphasis.

### Keep

- Cost Observatory first;
- Workspace Target Engine;
- Execution Capsules/context cache;
- State Engine V2;
- Lifecycle Instances;
- Discovery/re-entry;
- Gate Profiles;
- Domain Verification SDK;
- Complexity Delta Guard;
- Control Center integration.

### Do not duplicate

Do not rebuild:

- source section materialisation;
- token-profile generation;
- current static token audit;
- whole-file fingerprint protection;
- independent verification context;
- current risk/reviewer selection.

Extend these components.

## 10. Recommended release identity

Subject to Product Owner approval and final PLAN validation:

```text
Development Kit v0.12.0
Scale, Context & Iteration
```

This is a backwards-compatible feature release under the repository's Semantic Versioning policy.

## 11. Phase 0/1 verdict

**PHASE 0: COMPLETE**

Repository architecture, current version, state persistence, context packaging, gate selection, existing token hardening, CI/test surface, and relevant constraints have been inspected.

**PHASE 1: COMPLETE**

A reproducible analysis runner has executed against representative single-package, multi-package, calculation-heavy, and legacy-state fixtures on Ubuntu and Windows. Existing release validation remains green.

The next permitted specification step is to reconcile the approved Scale, Context & Iteration specification against these findings and enter DEFINE/DESIGN/PLAN for the implementation release. Production implementation has not started.
