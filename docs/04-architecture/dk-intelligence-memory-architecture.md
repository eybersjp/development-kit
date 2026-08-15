# DK Intelligence and Memory Architecture

> Status: Implemented in Development Kit v0.7.0.

## Purpose

Development Kit v0.7 introduces **DK Intelligence**, a built-in project intelligence layer that preserves engineering continuity across sessions and supported coding environments without turning Development Kit into a separate application.

DK Intelligence consists of:

- DK Memory: durable, typed engineering memory.
- DK Knowledge: indexed project and document knowledge.
- DK Code Intelligence: code relationships and impact-aware lookup.
- Context Assembly: selective, budgeted context retrieval for commands and agents.
- Provenance and Staleness: source authority, freshness, supersession, and invalidation.
- Provider Integration: optional adapters for richer memory, wiki, and code-graph backends.

The visual management surface is the separate **DK Control Center**, but both are part of the same Development Kit runtime and installation.

## Architectural Position

```text
Coding Environment
      |
      v
Development Kit
+-------------------------------+
| DK Core                       |
| - Lifecycle                   |
| - Autopilot                   |
| - Policy / approvals          |
| - Verification               |
| - Next-Step Guidance          |
|               |               |
|               v               |
| DK Intelligence               |
| - Memory                      |
| - Knowledge                   |
| - Code Intelligence           |
| - Context Assembly            |
| - Provenance / staleness      |
|               |               |
|               v               |
| Optional providers            |
+-------------------------------+
      |
      v
DK Control Center
```

DK Core remains the trusted control plane. DK Intelligence may inform decisions but may not expand authority.

## Non-Negotiable Invariants

1. **Memory is not approval.** A remembered preference, prior approval, historical action, or inferred user tendency can never authorize a consequential action.
2. **State is not memory.** Autopilot state answers what is happening now; memory answers what has been learned before. The existing immutable Autopilot state store remains authoritative for workflow progress.
3. **External or imported memory is untrusted data.** It cannot override user intent, `AGENTS.md`, DK policy, repository policy, approval gates, or system instructions.
4. **Project isolation is mandatory.** Project-scoped memory must not leak into another project unless explicitly promoted to a broader scope.
5. **No mandatory external backend.** DK Local Memory is the default provider and must work without Docker, a remote database, or an external memory service.
6. **No mandatory proxy.** Development Kit must not require model traffic to pass through a third-party proxy to gain memory functionality.
7. **Selective retrieval only.** The runtime must not inject the full memory store into model context.
8. **Stale information must be identifiable.** Superseded decisions, changed dependencies, invalidated artifacts, and expired facts must not silently rank as current truth.
9. **Human correction is supported.** Durable memory must be inspectable, editable, supersedable, archivable, and forgettable through controlled interfaces.
10. **Provider-neutral contract.** Optional providers extend storage or retrieval quality but do not become instruction authorities or hard dependencies.

## Memory Scopes

DK Memory supports three primary scopes.

### Project

Highest priority for project work. Examples:

- approved architecture decisions
- project constraints
- known regressions
- task lessons
- verified implementation facts
- project-specific conventions

### Workspace / Team

Reusable knowledge shared across related projects where explicitly enabled. Examples:

- organisational engineering conventions
- reusable release procedures
- shared lessons
- approved team skills

### User

Stable user-level preferences and durable working conventions. Examples:

- preferred workflow defaults
- documentation preferences
- durable development-environment preferences

Retrieval precedence is normally Project -> Workspace / Team -> User, with authority, relevance, freshness, and confidence applied within scope.

## Memory Types

Initial typed memory records include:

- `fact`
- `decision`
- `constraint`
- `preference`
- `architecture`
- `lesson`
- `incident`
- `verification`
- `research`
- `artifact`
- `relationship`
- `skill-reference`

The type system is extensible but unknown types must not silently gain higher authority.

## Authority Classes

Each record carries an authority classification independent of confidence.

- `user-approved`
- `repository-verified`
- `system-verified`
- `external-verified`
- `inferred`
- `imported-untrusted`

Authority determines how a record may be used. Confidence indicates certainty within that authority class.

An `inferred` memory with confidence `0.99` is still not equivalent to a `user-approved` decision.

## Record Model

A durable record should support at least:

```json
{
  "id": "mem_...",
  "schemaVersion": 1,
  "type": "decision",
  "scope": "project",
  "projectId": "...",
  "subject": "database",
  "content": "Use PostgreSQL as the primary relational database.",
  "authority": "user-approved",
  "confidence": 1,
  "status": "active",
  "lifecycleStages": ["DESIGN", "IMPLEMENT", "REVIEW"],
  "source": {
    "type": "artifact",
    "ref": "docs/architecture.md"
  },
  "createdAt": "...",
  "updatedAt": "...",
  "expiresAt": null,
  "supersedes": null,
  "supersededBy": null,
  "tags": ["architecture", "database"]
}
```

## Candidate Extraction

Meaningful DK operations may produce memory candidates after execution, including `/dk-spec`, `/dk-design`, `/dk-build`, `/dk-debug`, `/dk-review`, and `/dk-ship`.

Candidate handling follows risk and authority:

- repository-observed facts may be persisted automatically when deterministic and source-backed;
- inferred lessons may be stored as `inferred` with provenance;
- material product, architecture, policy, or safety decisions must not be promoted to `user-approved` without explicit evidence of user approval;
- secrets, credentials, tokens, cookies, private keys, and equivalent sensitive material are never memory candidates.

## Retrieval and Context Assembly

Retrieval is query-driven and lifecycle-aware. Ranking should consider:

```text
scope relevance
x lifecycle relevance
x task relevance
x authority
x freshness
x confidence
x lexical / semantic relevance
```

Context assembly is budgeted. The runtime should reserve context for current instructions, task state, repository evidence, and model reasoning rather than allowing historical memory to dominate the window.

Default retrieval should prefer concise records and source references. Raw historical material should be loaded only when needed for verification or disambiguation.

## Staleness and Supersession

DK Memory integrates with the existing staleness philosophy.

A record may become `stale` when its source artifact fingerprint changes, a relevant dependency/version changes, a newer decision supersedes it, or a configured expiry is reached.

Supersession preserves history:

```text
Decision A (superseded)
        |
        v
Decision B (active)
```

Deleted memory is distinct from superseded history. Where traceability matters, supersession is preferred over destructive deletion.

## Local Storage Baseline

V1 uses a local, human-readable provider without requiring an external database.

Recommended layout:

```text
.development-kit/
  intelligence/
    memory/
      manifest.json
      index.json
      records/
    knowledge/
    cache/
```

Local storage must remain Node 18 compatible unless a separately approved platform decision changes the framework baseline.

The implementation may later introduce SQLite or another indexed local format behind the same provider contract if benchmarks justify the dependency.

## Knowledge and Code Intelligence

DK Knowledge and DK Code Intelligence are related to memory but not identical to it.

- Memory stores learned, governed engineering context.
- Knowledge exposes documents and structured project information on demand.
- Code Intelligence exposes files, symbols, relationships, callers, callees, and impact paths on demand.

The initial provider contract should support optional advanced backends instead of rebuilding a full CodeGraph engine before the need is demonstrated.

## TencentDB Agent Memory Adapter

TencentDB Agent Memory is an optional provider candidate, not a DK dependency.

The adapter may expose supported capabilities such as:

- chat-memory retrieval
- skill assets
- wiki search/read
- code-graph search/explore
- callers/callees
- impact analysis

Development Kit must continue to work when the provider is missing, unavailable, incompatible, or disabled.

Provider installation is never silent. Authenticated or system-level provider setup remains subject to normal DK policy and approval rules.

## Lifecycle Integration

### UNDERSTAND
Restore relevant project constraints, prior discoveries, and known context.

### DEFINE
Surface approved decisions and constraints that affect requirements.

### DESIGN
Retrieve architecture decisions, compatibility constraints, and relevant prior lessons.

### PLAN
Use dependency and historical verification knowledge to order work.

### IMPLEMENT
Provide current-task context, relevant decisions, known regressions, and code relationships.

### VERIFY
Retrieve acceptance criteria, historical failures, and related verification evidence.

### REVIEW
Retrieve specification commitments, architecture decisions, security constraints, and prior findings.

### SIMPLIFY
Expose historical reasons for abstractions so simplification does not delete intentional design.

### COMPLETE
Persist verified lessons and final decisions, then mark invalidated intermediate memory appropriately.

## Acceptance Criteria for v0.7 Architecture

- Development Kit functions without an external memory provider.
- Memory cannot bypass any approval or policy gate.
- Project memory is isolated by default.
- User-approved and inferred records remain distinguishable.
- Superseded decisions do not rank as active truth.
- Stale records are surfaced and down-ranked or excluded according to policy.
- Context retrieval is budgeted and lifecycle-aware.
- Users can inspect and correct durable memory through DK Control Center.
- Optional provider failure degrades gracefully.
- No secret or credential material is deliberately persisted as memory.

## Related Planned Documents

- [DK Control Center Product Specification](dk-control-center-product-specification.md)
- [DK Runtime API](dk-runtime-api.md)
- [DK Memory Provider Contract](dk-memory-provider-contract.md)
- [v0.7 Threat Model](../07-testing-quality-security/v0.7-intelligence-control-center-threat-model.md)
- [v0.7 Implementation Plan](v0.7-intelligence-control-center-implementation-plan.md)
