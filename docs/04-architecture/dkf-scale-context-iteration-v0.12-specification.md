# Development Kit v0.12.0 — Scale, Context & Iteration Specification

**Status:** Phase 2 reconciled specification  
**Date:** 7 October 2026  
**Target release:** v0.12.0  
**Baseline:** v0.11.2 at `62badbf7d0abee3344b1f5db2b2fbc876cf004e2`  
**Evidence:** `dkf-scale-context-iteration-phase01-baseline.md`

## 1. Product decision

Development Kit will remain a **general-purpose, host-independent software-development reliability and orchestration framework**.

v0.12.0 must improve large-project scale, iterative engineering, multi-target workspaces, context economy, state efficiency, and extensible verification without making DKF specific to any application, industry, programming stack, repository shape, or business domain.

The governing rule is:

> **DKF core provides generic mechanisms. Projects and adapters provide domain-specific policy.**

Examples such as web/mobile/database/calculation targets or engineering/numerical verification are test cases only. They are not privileged concepts in DKF core.

## 2. Existing capabilities that must be extended, not rebuilt

Phase 0/1 proved that v0.11.2 already provides:

- Development Contracts and source fingerprints;
- independent verification contexts;
- section-aware authoritative-source materialisation;
- context token profiles and static token budgets;
- fail-safe full-source fallback;
- deterministic acceptance;
- risk/reviewer gate selection;
- Design Authority;
- configuration readiness;
- Live UI Preview;
- immutable Autopilot and orchestration-run state revisions.

v0.12.0 must reuse these mechanisms wherever possible.

## 3. Non-negotiable invariants

### INV-120-001 — General-purpose core
No DKF core module may contain application-specific business rules or assume a particular industry.

### INV-120-002 — Arbitrary project targets
Workspace target IDs are project-defined. Names such as `web`, `mobile`, `database`, or `calculations` are examples only.

### INV-120-003 — Extensible verification
DKF may supply generic verification primitives and profile contracts, but project/domain rules are supplied through configuration, adapters, fixtures, or project-owned extensions.

### INV-120-004 — Reliability preserved
Efficiency changes may not weaken Development Contracts, source staleness, independent verification, deterministic acceptance, Design Authority, security controls, or human approval gates.

### INV-120-005 — Host independence
The design may not require one AI provider, model, IDE, operating system, package manager, or execution host.

### INV-120-006 — Backward compatibility
Existing supported projects and public `/dk-*` commands must continue to work, subject only to documented migration where persistent-state format changes.

### INV-120-007 — Evidence over claims
Measured cost/performance fields must remain unavailable when the host cannot supply them. DKF must not fabricate provider-token or tool-call counts.

### INV-120-008 — Transparent state authority
A binary index may accelerate state queries but may not become the sole source of truth.

## 4. Capability scope

### 4.1 Cost Observatory

Add orchestration-cost telemetry that can record, when observable:

- context bytes and deterministic estimated tokens;
- provider-reported input/output/cached tokens;
- repository file reads;
- repository orientation/scans;
- agent invocations;
- tool calls;
- verification commands;
- cache hits/misses;
- elapsed operation timing.

New cross-platform comparisons must normalise line endings for logical text-size metrics.

Existing static token regression metrics remain available for historical compatibility.

### 4.2 Workspace Target Engine

Introduce a generic project target registry.

A target describes a bounded execution unit such as a package, application, service, library, database area, infrastructure component, firmware module, documentation site, or project-defined unit.

A target may declare:

- arbitrary target ID;
- path/root;
- optional descriptive kind;
- dependencies on other targets;
- commands/capabilities;
- test/verification entry points;
- optional adapter metadata.

Core routing must depend on target capabilities and configuration, not hard-coded target names.

### 4.3 Execution Capsules and context cache

Build on the current `buildContextPackage()` and section-aware materialisation.

An Execution Capsule contains deterministic references to:

- Development Contract;
- authoritative sources and fingerprints;
- relevant target(s);
- direct dependency state;
- relevant repository files/tests;
- runtime facts with provenance;
- recent relevant deltas;
- required gate/profile information.

Repository/context knowledge may be cached only where deterministic invalidation exists.

### 4.4 State Engine V2

Replace transition-proportional snapshot chains as the future canonical runtime-state model with:

```text
events.jsonl   — append-only canonical event history
snapshot.json  — materialised current state
index.db       — rebuildable acceleration index
```

Existing immutable state must migrate safely.

The index is disposable.

The event history and authoritative artifacts remain inspectable.

### 4.5 Lifecycle Instances

Retain the user-facing lifecycle:

```text
UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE
```

Internally, allow bounded Lifecycle Instances with optional parent/child relationships.

`COMPLETE` means the current Lifecycle Instance is accepted. It does not implicitly mark parent lifecycles or project/domain state complete.

### 4.6 Discovery and controlled re-entry

Introduce first-class discovery events for evidence that invalidates an approved assumption, specification element, architecture decision, plan element, or implementation expectation.

The runtime determines the minimum safe re-entry stage.

Only affected downstream work is invalidated.

Implementation agents may not silently rewrite upstream authority.

### 4.7 Generic Gate Profiles

Extend existing gate selection with reusable profiles resolved from:

- Development Contract;
- risk;
- target capabilities;
- explicit project configuration;
- required controls;
- project-owned verification extensions.

Profiles must not encode application-specific business rules in DKF core.

### 4.8 Verification Extension SDK

The previous working label “Domain Verification SDK” is refined to **Verification Extension SDK** to preserve DKF generality.

DKF core may supply generic primitives such as:

- absolute/relative numeric tolerance;
- range checks;
- generic invariant evaluation;
- unit/dimension adapters;
- reference/golden datasets;
- replay verification;
- deterministic custom validators.

Projects provide the actual rules, units, formulas, thresholds, datasets, and policy.

A solar project may supply energy constraints. A financial project may supply accounting constraints. A CAD project may supply geometry constraints. DKF core remains unchanged.

### 4.9 Complexity Delta Guard

Add an inexpensive deterministic complexity delta using repository/diff facts such as:

- files added/removed;
- dependencies added;
- exported abstractions;
- single-use abstractions where deterministically detectable;
- duplicated implementation indicators;
- changed lines/size.

It may trigger the full simplicity reviewer according to policy.

It does not replace the simplicity reviewer.

### 4.10 Control Center integration

Expose:

- Lifecycle Instances;
- workspace targets;
- context/capsule state;
- Cost Observatory;
- discoveries;
- gate/profile resolution;
- State Engine health.

The Control Center remains observational/control-plane UI rather than a second source of truth.

## 5. Explicit non-goals

v0.12.0 will not:

- hard-code solar, energy, finance, healthcare, legal, CAD, ecommerce, or other domain rules;
- hard-code `@web`, `@mobile`, `@db`, or any target name as mandatory;
- require monorepos;
- require multiple AI providers;
- replace Development Contracts;
- replace current source-section materialisation;
- allow implementation self-certification;
- remove human approval gates;
- require SQLite as canonical state;
- introduce unrestricted concurrent writes;
- automatically infer business truth from source-code shape;
- hide migration or performance misses.

## 6. State and schema direction

Proposed versioned contracts:

- State Engine schema v2;
- Workspace Target Registry schema v1;
- Execution Capsule schema v1;
- Lifecycle Instance schema v1;
- Discovery Event schema v1;
- Gate Profile schema v1;
- Verification Extension contract v1;
- Cost Record schema v1.

Exact files and module boundaries are decided during implementation by reuse-first repository inspection.

## 7. Migration requirements

Migration from current state must:

1. detect legacy Autopilot and orchestration state;
2. validate legacy state before conversion;
3. preserve a recoverable legacy backup until cutover is accepted;
4. generate canonical events/snapshot/index;
5. verify semantic equivalence;
6. be idempotent;
7. fail closed on mismatch;
8. permit index rebuild from canonical state;
9. not require users to manually reconstruct projects.

## 8. Performance objectives

These are engineering objectives, not release claims.

Against representative repeated workflows, v0.12.0 should target:

- >=40% reduction in repeated context volume where the same project knowledge would otherwise be re-supplied;
- >=60% reduction in redundant repository reads where telemetry can measure them;
- >=70% reduction in repeated full repository orientation where telemetry can measure it;
- >=80% reduction in transition-generated state micro-file count after State Engine V2 migration;
- zero reduction in mandatory verification/control coverage;
- zero increase in false `ACCEPTED` regression cases;
- 100% rebuild recovery after deleting the disposable state index;
- 100% supported migration-fixture success.

Actual results must be reported even if objectives are missed.

## 9. Acceptance criteria

### Cost Observatory
- **DKF-120-AC-001:** Every instrumented orchestration operation can emit a cost record containing only measured or deterministic-estimate fields.
- **DKF-120-AC-002:** Provider token fields remain null/unavailable unless supplied by the host/provider.
- **DKF-120-AC-003:** New cross-platform logical text/context comparisons normalise newline representation while preserving historical audit compatibility.
- **DKF-120-AC-033:** Release evidence includes baseline-versus-v0.12 cost comparison.

### Workspace targets
- **DKF-120-AC-004:** A project can register arbitrary target IDs without changing DKF core.
- **DKF-120-AC-005:** Target discovery/configuration does not assume a specific application domain or fixed repository topology.
- **DKF-120-AC-006:** Tasks/contracts can bind primary, affected, and verification targets.
- **DKF-120-AC-007:** Target-specific commands/capabilities resolve without hard-coded target names.
- **DKF-120-AC-039:** Core routing is capability/configuration-driven rather than technology-name driven.

### Context economy
- **DKF-120-AC-008:** Fresh implementation/review contexts can receive deterministic Execution Capsules.
- **DKF-120-AC-009:** Capsule fingerprints invalidate stale capsules when relevant authority/repository state changes.
- **DKF-120-AC-010:** Repository/context caching has deterministic invalidation.
- **DKF-120-AC-011:** Existing section-aware source materialisation and source-fingerprint protections remain green.
- **DKF-120-AC-035:** Comparative evidence reports measured context/orientation improvement where observable.

### State Engine V2
- **DKF-120-AC-012:** Canonical runtime history is append-only and reconstructable.
- **DKF-120-AC-013:** Current snapshot can be rebuilt from canonical history.
- **DKF-120-AC-014:** Disposable index deletion/rebuild produces semantically equivalent query state.
- **DKF-120-AC-015:** Supported legacy migration is idempotent, fail-closed, and recoverable before cutover acceptance.
- **DKF-120-AC-034:** Representative migrated runtime state achieves the state micro-file reduction objective or reports the miss explicitly.

### Lifecycle Instances
- **DKF-120-AC-016:** Lifecycle Instances support optional parent/child relationships.
- **DKF-120-AC-017:** `COMPLETE` applies only to the active Lifecycle Instance.
- **DKF-120-AC-018:** Domain/application state cannot implicitly change DKF lifecycle acceptance/completion state.

### Discovery and re-entry
- **DKF-120-AC-019:** Discovery events persist evidence and affected-authority references.
- **DKF-120-AC-020:** The runtime computes the minimum safe re-entry stage from affected authority.
- **DKF-120-AC-021:** Selective invalidation preserves unrelated accepted work.

### Gate profiles
- **DKF-120-AC-022:** Gate profiles resolve generically from contract/risk/target capabilities/project configuration.
- **DKF-120-AC-023:** Profiles cannot downgrade existing mandatory verification, control, or human-approval gates.

### Verification Extension SDK
- **DKF-120-AC-024:** Project-owned verification extensions can be added without modifying DKF core.
- **DKF-120-AC-025:** Generic numeric checks support absolute and relative tolerances.
- **DKF-120-AC-026:** Project-supplied invariants/custom validators can block acceptance through normal evidence/gate semantics.
- **DKF-120-AC-027:** Reference/golden dataset fingerprints participate in evidence freshness.
- **DKF-120-AC-037:** DKF core contains no application-specific domain verification rules.
- **DKF-120-AC-038:** At least two materially different example verification extensions can use the same SDK without core changes.

### Complexity
- **DKF-120-AC-028:** Complexity Delta is deterministic from repository/diff facts used by the implementation.
- **DKF-120-AC-029:** Complexity policy may trigger, but may not remove, the full simplicity review where existing policy requires it.

### Integration and release
- **DKF-120-AC-030:** Control Center exposes the new state without becoming canonical authority.
- **DKF-120-AC-031:** Existing supported public commands remain compatible.
- **DKF-120-AC-032:** Existing control-plane and release-validation regression suites remain green.
- **DKF-120-AC-036:** No new false-`ACCEPTED` regression scenario is introduced.
- **DKF-120-AC-040:** Release documentation includes migration, compatibility, measurement results, and known limitations.

## 10. Release gate

v0.12.0 is releasable only when:

- all required acceptance criteria have evidence;
- the deterministic PLAN remains valid;
- migration tests pass;
- current release-validation suites remain green on supported CI platforms;
- no critical security or architecture finding remains unresolved;
- no app-specific logic has entered DKF core;
- comparative efficiency evidence is published honestly;
- Product Owner release approval is recorded.

## 11. Phase 2 specification decision

This specification supersedes the earlier provisional v0.11.0 label and the domain-specific wording “Domain Verification SDK”.

The architectural intent remains the same, but it is now explicitly constrained to a **general-purpose core with project-defined targets, profiles, adapters, and verification rules**.
