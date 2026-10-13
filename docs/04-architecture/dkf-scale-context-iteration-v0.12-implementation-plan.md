# Development Kit v0.12.0 — Scale, Context & Iteration Implementation PLAN

**Status:** Phase 2 implementation PLAN  
**Specification:** `dkf-scale-context-iteration-v0.12-specification.md`  
**Technical design:** `dkf-scale-context-iteration-v0.12-technical-design.md`  
**Deterministic model:** `dkf-scale-context-iteration-v0.12-plan-model.json`

## 1. Execution rule

Implementation proceeds in the following order:

```text
DKF120-T01 Cost Observatory
  -> DKF120-T02 Workspace Target Engine
  -> DKF120-T03 Execution Capsules & Context Cache
  -> DKF120-T04 State Engine V2
  -> DKF120-T05 Lifecycle Instances
  -> DKF120-T06 Discovery & Controlled Re-entry
  -> DKF120-T07 Generic Gate Profiles
  -> DKF120-T08 Verification Extension SDK
  -> DKF120-T09 Complexity Delta Guard
  -> DKF120-T10 Control Center + Comparative Release Validation
```

Every task receives its own Development Contract during implementation.

No task may begin before its dependency reaches deterministic acceptance unless the PLAN is explicitly revalidated after an approved amendment.

## 2. Global implementation constraints

All tasks must comply with:

- general-purpose DKF core;
- no application-specific or industry-specific business logic;
- arbitrary project-defined target IDs;
- host/provider independence;
- reuse-before-create;
- existing `/dk-*` command compatibility;
- independent verification;
- source fingerprint/staleness protection;
- deterministic acceptance;
- human approval preservation;
- Design Authority preservation;
- no fabricated telemetry;
- no SQLite-only canonical state.

## 3. Task DKF120-T01 — Cost Observatory

### Objective

Add generic, truthful orchestration-cost measurement before optimising later components.

### Dependencies

None.

### Risk

Medium. Instrumentation crosses orchestration boundaries but must not alter acceptance decisions.

### Owned resources

- `cost-observatory-runtime`
- `cost-telemetry-schema`
- `cost-baseline-comparison`

### Reuse targets

Inspect and extend, where appropriate:

- `runtime/orchestration/token-efficiency.mjs`
- context-package token profiles;
- current run/contract identifiers;
- existing evidence/runtime APIs;
- Phase 0/1 baseline runner.

### Requirements

- record DKF-controlled measurable counts;
- accept optional provider/host token telemetry;
- keep unavailable metrics null;
- add canonical newline-normalised logical text/context comparison;
- preserve the existing historical static token audit;
- enable before/after workload comparison.

### Exclusions

- no context caching yet;
- no target engine;
- no provider-specific mandatory SDK;
- no optimisation claims before measurement.

### Acceptance criteria

- DKF-120-AC-001
- DKF-120-AC-002
- DKF-120-AC-003
- DKF-120-AC-033

### Required verification

- unit tests for measurement record validation;
- cross-platform newline-normalisation test;
- unavailable-provider-metric test;
- regression test proving acceptance semantics are unchanged.

---

## 4. Task DKF120-T02 — Workspace Target Engine

### Objective

Introduce generic project-defined target boundaries and capability-driven target routing.

### Dependencies

DKF120-T01.

### Risk

Medium.

### Owned resources

- `workspace-target-registry`
- `target-resolution`
- `target-routing`

### Requirements

- support arbitrary target IDs;
- support single-target and multi-target repositories;
- discover common repository boundaries without privileging them in core;
- support target dependency relationships;
- bind tasks/contracts to primary, affected, and verification targets;
- resolve target commands/capabilities from project configuration/adapters.

### Exclusions

- no hard-coded `web`, `mobile`, `database`, `calculations`, or other mandatory target names;
- no requirement for monorepos;
- no domain/business inference from target names.

### Acceptance criteria

- DKF-120-AC-004
- DKF-120-AC-005
- DKF-120-AC-006
- DKF-120-AC-007
- DKF-120-AC-039

### Required verification

- single-root repository fixture;
- arbitrary-name multi-target fixture;
- target dependency closure tests;
- target cycle/error tests;
- capability-driven command routing tests.

---

## 5. Task DKF120-T03 — Execution Capsules & Context Cache

### Objective

Reduce repeated repository/runtime reorientation while preserving current source authority and fresh-role isolation.

### Dependencies

DKF120-T02.

### Risk

High. Incorrect caching could feed stale context into verification.

### Owned resources

- `execution-capsule`
- `repository-context-cache`
- `context-invalidation`

### Requirements

- build deterministic Execution Capsules;
- reuse current source section materialisation;
- reference source/file fingerprints rather than duplicate whole history;
- persist/cache repository structural facts only with deterministic invalidation;
- include target/dependency delta and verified runtime facts;
- reject stale capsules.

### Exclusions

- do not replace `buildContextPackage()`;
- do not weaken whole-file fingerprint checks;
- do not treat summaries as authority.

### Acceptance criteria

- DKF-120-AC-008
- DKF-120-AC-009
- DKF-120-AC-010
- DKF-120-AC-011
- DKF-120-AC-035

### Required verification

- stale source invalidates capsule;
- relevant file change invalidates capsule;
- irrelevant target change does not force unrelated full rescan when safe;
- full cache miss still produces correct context;
- current token-efficiency and verification-isolation tests remain green.

---

## 6. Task DKF120-T04 — State Engine V2

### Objective

Replace transition-proportional canonical snapshot chains with compact event-backed state while preserving auditability and recovery.

### Dependencies

DKF120-T03.

### Risk

High. Persistent-state migration and recovery are control-plane critical.

### Owned resources

- `canonical-event-ledger`
- `state-snapshot`
- `state-index`
- `legacy-state-migration`

### Requirements

- append-only canonical event history;
- materialised current snapshot;
- rebuildable acceleration index;
- atomic state mutation;
- semantic-equivalence migration from supported legacy state;
- migration idempotence;
- legacy recovery retained until verified cutover;
- index/snapshot rebuild tests.

### Exclusions

- no binary-only source of truth;
- no deletion of legacy state before verified migration;
- no migration that changes acceptance meaning.

### Acceptance criteria

- DKF-120-AC-012
- DKF-120-AC-013
- DKF-120-AC-014
- DKF-120-AC-015
- DKF-120-AC-034

### Required verification

- event ordering/integrity;
- interrupted write;
- snapshot rebuild;
- index deletion/rebuild;
- migration/repeated migration;
- corrupted legacy input;
- semantic equivalence;
- baseline state-file-count comparison.

---

## 7. Task DKF120-T05 — Lifecycle Instances

### Objective

Make bounded/nested development lifecycles first-class without changing the familiar nine-stage user workflow.

### Dependencies

DKF120-T04.

### Risk

High. Lifecycle completion semantics affect orchestration authority.

### Owned resources

- `lifecycle-instance-model`
- `lifecycle-completion-semantics`
- `state-namespaces`

### Requirements

- optional parent/child lifecycle relationships;
- each lifecycle retains canonical nine stages;
- `COMPLETE` scoped to one lifecycle;
- separate application/domain/release/deployment state from development lifecycle state;
- existing simple projects behave as one lifecycle.

### Exclusions

- no app-specific lifecycle types;
- no automatic business-status-to-DKF-completion mapping.

### Acceptance criteria

- DKF-120-AC-016
- DKF-120-AC-017
- DKF-120-AC-018

### Required verification

- child complete while parent remains active;
- parent acceptance independently evaluated;
- arbitrary domain state cannot complete lifecycle;
- legacy single-lifecycle compatibility.

---

## 8. Task DKF120-T06 — Discovery & Controlled Re-entry

### Objective

Turn technical discovery into a controlled, evidence-backed feedback loop.

### Dependencies

DKF120-T05.

### Risk

High. Re-entry changes previously accepted planning/authority state.

### Owned resources

- `discovery-event-model`
- `reentry-resolver`
- `selective-invalidation`

### Requirements

- persist discovery evidence and affected authority;
- classify the type/scope of invalidation;
- determine minimum safe re-entry stage;
- calculate dependent affected work;
- preserve unrelated accepted work;
- invoke existing human approval when upstream authority changes require it.

### Exclusions

- no silent specification rewrite from IMPLEMENT;
- no automatic global lifecycle restart unless dependency evidence requires it.

### Acceptance criteria

- DKF-120-AC-019
- DKF-120-AC-020
- DKF-120-AC-021

### Required verification

- implementation-only defect -> IMPLEMENT;
- plan invalidation -> PLAN;
- architecture invalidation -> DESIGN;
- specification invalidation -> DEFINE;
- selective invalidation fixture;
- human-gated upstream amendment fixture.

---

## 9. Task DKF120-T07 — Generic Gate Profiles

### Objective

Extend current gate selection into composable, project-neutral verification profiles.

### Dependencies

DKF120-T06.

### Risk

High. Gate resolution must never reduce mandatory control coverage.

### Owned resources

- `gate-profile-contract`
- `gate-profile-resolver`

### Requirements

- extend current `gate-selector` behaviour;
- resolve profiles from contract, risk, target capabilities, and project configuration;
- permit project extensions to add verification classes;
- preserve mandatory security/design/configuration/human gates;
- fail closed on unresolved required profiles.

### Exclusions

- no application-specific gate names or business rules in core;
- no profile that suppresses existing mandatory gates.

### Acceptance criteria

- DKF-120-AC-022
- DKF-120-AC-023

### Required verification

- low/high risk resolution;
- target capability resolution;
- attempted mandatory-gate downgrade rejected;
- unknown required profile fails closed.

---

## 10. Task DKF120-T08 — Verification Extension SDK

### Objective

Provide generic primitives through which any project can add rigorous project/domain verification without modifying DKF core.

### Dependencies

DKF120-T07.

### Risk

High. Extensions may participate in acceptance and therefore require strict evidence semantics.

### Owned resources

- `verification-extension-contract`
- `generic-verification-primitives`
- `extension-fixtures`

### Requirements

- project-owned extension registration/contract;
- generic absolute/relative tolerance primitive;
- generic ranges/invariants/custom deterministic verifier support;
- reference/golden dataset fingerprinting;
- optional unit/dimension adapter interface;
- replay/reference verification;
- results flow through existing evidence/trust/gate semantics;
- at least two materially different example extensions prove generality.

### Exclusions

- no solar/energy formulas in DKF core;
- no financial/accounting rules in DKF core;
- no healthcare/legal/CAD/ecommerce rules in DKF core;
- example fixtures are not built-in policy.

### Acceptance criteria

- DKF-120-AC-024
- DKF-120-AC-025
- DKF-120-AC-026
- DKF-120-AC-027
- DKF-120-AC-037
- DKF-120-AC-038

### Required verification

- tolerance boundary tests;
- invariant fail blocks normal gate;
- stale reference dataset invalidates evidence;
- two different extension fixtures run without core changes;
- adversarial extension cannot self-certify or bypass mandatory gates.

---

## 11. Task DKF120-T09 — Complexity Delta Guard

### Objective

Add cheap deterministic complexity signals to avoid unnecessary heavy review while retaining full simplicity governance.

### Dependencies

DKF120-T08.

### Risk

Medium.

### Owned resources

- `complexity-delta`
- `simplicity-trigger-policy`

### Requirements

- derive deterministic complexity facts from repository/diff information;
- define policy threshold/conditions;
- trigger existing simplicity review where required;
- never remove a currently mandatory simplicity review.

### Exclusions

- no LLM-only complexity score represented as deterministic fact;
- no replacement of simplicity reviewer.

### Acceptance criteria

- DKF-120-AC-028
- DKF-120-AC-029

### Required verification

- identical diff produces identical delta;
- low-complexity case avoids optional heavy invocation;
- policy/risk case still invokes required simplicity review.

---

## 12. Task DKF120-T10 — Control Center + Comparative Release Validation

### Objective

Expose the new control-plane state, replay the Phase 1 workloads, and prepare evidence for the v0.12.0 release gate.

### Dependencies

DKF120-T09.

### Risk

High because it closes the release and compatibility loop.

### Owned resources

- `control-center-integration`
- `comparative-replay`
- `release-docs-evidence`

### Requirements

- extend existing Control Center/runtime API;
- expose lifecycle/targets/capsules/cost/discoveries/gates/state health;
- keep UI non-authoritative;
- replay Phase 1 single-package, multi-target, calculation-heavy/general verification, and legacy-state workloads;
- compare actual results against v0.12 objectives;
- run complete regression/release suites;
- document migration, compatibility, limitations, and measured outcomes.

### Exclusions

- no new competing Control Center;
- no release/publish action without explicit release approval.

### Acceptance criteria

- DKF-120-AC-030
- DKF-120-AC-031
- DKF-120-AC-032
- DKF-120-AC-036
- DKF-120-AC-040

### Required verification

- Control Center reads canonical APIs;
- all existing supported commands remain discoverable/functional;
- full release validation on supported CI;
- false-acceptance adversarial suite;
- before/after Phase 1 replay;
- generic-core review proving no project-specific logic entered core.

## 13. Deterministic PLAN invariants

The machine-readable plan must prove:

- exactly 10 stable task IDs;
- every dependency points to a declared task;
- no dependency cycle;
- declared dependency diagram equals computed dependency graph;
- every required logical resource has exactly one owner;
- every `DKF-120-AC-001` through `DKF-120-AC-040` criterion has at least one task owner;
- no unknown configuration dependencies are introduced at planning time.

The authoritative deterministic model is:

`docs/04-architecture/dkf-scale-context-iteration-v0.12-plan-model.json`

## 14. Implementation boundary

Phase 2 authorises planning only.

Production implementation begins only after:

1. the deterministic PLAN validator returns `valid: true`;
2. repository CI remains green;
3. the specification, design, PLAN, and project memory are updated consistently.

The first production Development Contract will then be **DKF120-T01 — Cost Observatory**.
