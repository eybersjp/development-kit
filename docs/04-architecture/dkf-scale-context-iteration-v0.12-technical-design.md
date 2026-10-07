# Development Kit v0.12.0 — Scale, Context & Iteration Technical Design

**Status:** Phase 2 technical design  
**Specification:** `dkf-scale-context-iteration-v0.12-specification.md`  
**Baseline evidence:** `dkf-scale-context-iteration-phase01-baseline.md`

## 1. Design objective

Implement v0.12.0 by extending the existing DKF control plane with generic scale/iteration primitives while preserving current command behaviour and reliability contracts.

The design follows three rules:

1. **Reuse existing runtime modules before creating parallel systems.**
2. **Core mechanisms remain domain/application neutral.**
3. **New persistence and orchestration features must fail closed when authority, migration, or evidence is ambiguous.**

## 2. Existing components to extend

| Existing component | v0.12 role |
|---|---|
| `runtime/orchestration/context-package.mjs` | Base for Execution Capsules and bounded context assembly |
| `runtime/orchestration/token-efficiency.mjs` | Base for deterministic logical context sizing |
| `scripts/token-audit.mjs` | Historical/static regression audit retained |
| `runtime/orchestration/gate-selector.mjs` | Base for generic Gate Profile resolution |
| `runtime/autopilot/state-store.mjs` | Legacy state source and migration input |
| `runtime/orchestration/orchestration-run.mjs` | Legacy run-state source and migration/integration input |
| `runtime/orchestration/evidence-store.mjs` | Existing evidence/trust semantics remain authoritative |
| Development Contract runtime | Target/capsule/gate binding authority |
| Control Center/runtime API | Observability surface for new state |
| Repository Scout | Target discovery, repository-map maintenance, invalidation hints |

No new subsystem should duplicate these responsibilities.

## 3. Logical architecture

```text
                       DKF command surface
                              |
                     Development Conductor
                              |
                 +------------+------------+
                 |                         |
          Lifecycle Engine           Contract Control
                 |                         |
        +--------+--------+        +-------+-------+
        |                 |        |               |
 Discovery/Re-entry   Target Engine |         Gate Resolver
        |                 |        |               |
        +--------+--------+--------+-------+-------+
                         |
                    Context Engine
                         |
                 Execution Capsule
                         |
              fresh isolated role context
                         |
                  implementation/review
                         |
              evidence + acceptance engine
                         |
                    State Engine V2
                         |
      events.jsonl + snapshot.json + rebuildable index
```

Cost telemetry observes orchestration boundaries without changing acceptance authority.

## 4. Workspace Target Engine

### 4.1 Registry

Recommended project-local authority:

```text
.development-kit/workspace.json
```

Conceptual schema:

```json
{
  "schemaVersion": 1,
  "targets": {
    "arbitrary-project-id": {
      "path": "relative/path",
      "kind": "optional-descriptive-string",
      "dependencies": ["another-target"],
      "commands": {
        "test": "project-defined command"
      },
      "capabilities": ["project-defined-capability"],
      "adapter": null
    }
  }
}
```

### 4.2 Generality rules

- Target IDs are arbitrary.
- `kind` is descriptive metadata, not a hard-coded DKF dispatch enum.
- Core routing uses declared commands/capabilities and adapter contracts.
- Built-in discovery may recognise common repository conventions, but recognition produces generic target records.
- A project can override or add targets.
- A single-root repository is represented as one target; monorepo use is optional.

### 4.3 Dependency closure

The Target Engine provides:

- direct dependencies;
- reverse dependants;
- affected-target closure;
- verification-target closure;
- command resolution.

It must reject cycles where target dependencies require acyclic execution semantics.

## 5. Execution Capsules and Context Engine

### 5.1 Relationship to current context package

Do not replace `buildContextPackage()`.

Add a deterministic capsule layer that selects repository/target/runtime facts before current role-context materialisation.

Conceptual flow:

```text
Development Contract
      +
Target binding
      +
repository map/index
      +
direct dependency deltas
      +
runtime facts
      |
      v
Execution Capsule
      |
      v
buildContextPackage()
      |
      v
fresh/rehydrated role context
```

### 5.2 Capsule contents

A capsule contains references/fingerprints, not copied project history, wherever possible:

- lifecycle ID;
- contract/task/run IDs;
- target binding;
- authoritative source refs and selectors;
- relevant repository file refs/fingerprints;
- relevant tests;
- direct upstream accepted tasks;
- changed-file delta;
- verified runtime facts with provenance;
- required gate profile IDs;
- cache/invalidation fingerprint.

### 5.3 Cache design

Repository-map/context caches are acceleration artifacts only.

Invalidation inputs should include, as applicable:

- target registry fingerprint;
- relevant file fingerprints;
- dependency target fingerprints;
- contract/source fingerprint;
- configuration revision;
- development-mode snapshot;
- gate/profile revision.

A cache miss is safe and may cost more work.

A stale cache hit is unsafe and must be prevented deterministically.

## 6. Cost Observatory

### 6.1 Measurement boundary

Add a generic cost-record interface around DKF-controlled orchestration operations.

Conceptual record:

```ts
interface CostRecord {
  operationId: string;
  lifecycleId?: string;
  contractId?: string;
  taskId?: string;
  role?: string;

  contextBytes?: number;
  estimatedContextTokens?: number;

  providerInputTokens?: number | null;
  providerOutputTokens?: number | null;
  providerCachedTokens?: number | null;

  repositoryReads?: number | null;
  repositoryScans?: number | null;
  agentInvocations?: number | null;
  toolCalls?: number | null;
  verificationCommands?: number | null;

  cacheHits?: number;
  cacheMisses?: number;

  startedAt: string;
  completedAt: string;
}
```

### 6.2 Measurement truth

- Deterministic DKF-controlled counts may be recorded directly.
- Host/provider values are recorded only when actually exposed.
- Missing host metrics remain null.
- New logical text-size metrics normalise `CRLF`/ `LF` before comparison.
- Existing `token:audit` historical values remain unchanged for regression continuity.

## 7. State Engine V2

### 7.1 Canonical layout

Recommended project-local state area:

```text
.development-kit/state/
  events.jsonl
  snapshot.json
  index.db
  schema.json
```

Existing artifact/evidence/contract storage may remain in current locations initially.

### 7.2 Event model

Each canonical state mutation emits an event with:

- monotonic sequence;
- stable event ID;
- timestamp;
- actor class;
- lifecycle/task/contract/run refs;
- event type;
- payload;
- optional previous event hash;
- event hash.

Hash chaining is an integrity check, not a blockchain or distributed-consensus feature.

### 7.3 Snapshot

`snapshot.json` is a materialised view derived from canonical events.

It may contain:

- active lifecycle;
- active task/contract/run;
- stage;
- current source fingerprint;
- acceptance state;
- last event sequence/hash.

### 7.4 Index

`index.db` is rebuildable.

It may index relationships needed for:

- lifecycle lookup;
- task/criterion ownership;
- source dependency/invalidation;
- evidence lookup;
- target lookup;
- telemetry querying.

Deleting it must not destroy canonical state.

### 7.5 Migration

Legacy Autopilot and run-state revisions remain migration inputs.

Migration should:

1. read/validate current state chains;
2. convert semantic transitions into canonical events;
3. derive snapshot;
4. build index;
5. compare reconstructed current state to legacy current state;
6. preserve legacy backup before cutover;
7. mark migration complete only after equivalence verification.

## 8. Lifecycle Engine

### 8.1 Lifecycle Instance

Generic model:

```ts
interface LifecycleInstance {
  lifecycleId: string;
  parentLifecycleId: string | null;
  type: string;
  name: string;
  stage: CanonicalStage;
  status: string;
  targets: string[];
  sourceRevision: number;
  sourceFingerprint: string;
}
```

`type` remains extensible. DKF may provide common defaults but must not make project-specific types mandatory.

### 8.2 Completion semantics

- `COMPLETE` is scoped to one Lifecycle Instance.
- Parent completion is separately evaluated.
- Application/business/domain status remains an external/project namespace.
- No business status string may implicitly drive DKF acceptance.

## 9. Discovery and controlled re-entry

A Discovery Event references:

- evidence;
- affected source/authority;
- current lifecycle/task/contract;
- classification;
- affected criteria/tasks;
- proposed minimum re-entry stage.

The re-entry resolver applies generic authority rules:

- implementation-only defect -> IMPLEMENT;
- plan decomposition invalid -> PLAN;
- architecture authority invalid -> DESIGN;
- requirement/spec authority invalid -> DEFINE.

Project policy may require human approval for particular discovery classes or risk levels.

Affected downstream work is calculated from persisted dependency relationships.

## 10. Gate Profiles

Gate Profiles extend current gate selection rather than replace it.

A profile describes generic required/conditional verification classes.

Resolution inputs include:

- Development Contract;
- risk;
- target capabilities;
- explicit project configuration;
- security/design/configuration constraints;
- Verification Extension requirements.

Profiles may add gates.

They may not suppress mandatory gates already selected by current safety/control policy.

## 11. Verification Extension SDK

### 11.1 Core primitives

Generic SDK primitives may include:

```text
numeric tolerance
range assertion
generic invariant callback/DSL
reference dataset comparison
replay fixture
unit/dimension adapter interface
custom deterministic verifier adapter
```

### 11.2 Project-owned policy

Project extensions define:

- formulas;
- domain units;
- invariants;
- thresholds;
- datasets;
- replay cases;
- custom verification code.

DKF core stores/validates results through existing evidence and gate semantics.

### 11.3 Generality proof

Release tests must include at least two materially different extension fixtures, for example:

- a numeric/scientific-style extension;
- a non-numeric state/business-rule extension.

Their purpose is to prove the SDK is generic. Neither becomes built-in DKF domain policy.

## 12. Complexity Delta Guard

Implement the smallest deterministic signal set supported by repository facts.

A policy layer decides when to invoke the existing full simplicity reviewer.

The guard must never convert a required simplicity review into an optional one where current policy already requires it.

## 13. Control Center

Extend the existing Control Center/runtime API.

New views/data should be read from canonical runtime APIs:

- lifecycle graph;
- target graph;
- capsule/context state;
- cost records;
- discovery queue;
- gate/profile resolution;
- state health/migration status.

The UI is not an authority source.

## 14. Compatibility strategy

### Commands
Keep existing public command names and normal workflow.

### Existing projects
Projects without target registry or State Engine V2 are detected and upgraded/initialised safely.

### Single-package projects
One-target operation remains simple and should require no unnecessary configuration.

### Hosts
If host telemetry is unavailable, cost fields remain null and orchestration proceeds with existing controls.

### Existing context hardening
Section-aware source delivery, staleness checks, fresh verification isolation, and role budgets remain intact.

## 15. Expected implementation change surface

Exact file creation remains subject to reuse-first inspection, but likely areas include:

```text
runtime/orchestration/
runtime/autopilot/
runtime/bootstrap/
runtime/control-center or equivalent runtime API
schemas/
scripts/*tests*
agents/
commands/
skills/
docs/
```

Likely new logical responsibilities:

```text
cost observability
workspace target registry/resolution
execution capsule/cache
event ledger/snapshot/index
lifecycle instances
discovery/re-entry
gate profiles
verification extension contracts
complexity delta
```

Where an existing module can own the responsibility cleanly, extend it instead of creating a new file.

## 16. Security and failure model

Fail closed for:

- invalid/stale target registry;
- stale capsule;
- migration semantic mismatch;
- corrupted canonical ledger;
- unresolved required gate profile;
- extension attempting to bypass mandatory control;
- project extension returning unverifiable PASS;
- discovery requiring unapproved upstream-authority change.

Degrade safely for:

- missing disposable index;
- absent optional telemetry;
- unavailable cache;
- unavailable host provider-token data.

## 17. Design decision

The implementation architecture is approved for planning with one terminology correction:

> **Verification Extension SDK** is the canonical v0.12 term. “Domain Verification SDK” may be used only when describing the original feedback that motivated it.

This prevents DKF from becoming specialised while retaining the ability for any project to add rigorous domain-specific verification outside core.
