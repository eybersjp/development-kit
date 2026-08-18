# DK Contract-Driven Agent Orchestration Implementation Plan

**Status:** Approved implementation direction  
**Baseline:** Development Kit v0.8.1  
**Proposed target:** Next minor architecture release, provisionally v0.9.0  
**Compatibility objective:** Existing Development Kit commands and existing projects continue to work without requiring users to change their normal workflow.

---

## 1. Executive Decision

Development Kit will evolve from a primarily prompt-orchestrated specialist-agent workflow into a **contract-driven, evidence-backed, host-independent software-development orchestration framework**.

The user-facing workflow remains familiar:

```text
/dk-autopilot
/dk-build-auto
/dk-build
/dk-test
/dk-review
/dk-ship
```

The major change occurs below the command surface.

Each implementation increment will be governed by a durable **Development Contract** derived from authoritative project sources. Implementation, verification, technical review, security review, design review, and acceptance will independently rehydrate their context from that contract and its referenced authoritative sources rather than relying on an upstream agent summary as truth.

The architecture must enforce two foundational principles:

> **Agent outputs are evidence, not authority.**

and:

> **No self-certification. An implementation execution context may report what it changed, but it may not certify its own work as accepted. Acceptance requires independently rehydrated verification.**

This change is intended to make Development Kit substantially more reliable while preserving the current user experience and allowing the framework to run inside whichever supported AI coding environment the user prefers.

---

## 2. Why This Upgrade Is Needed

Development Kit v0.8.1 already contains important foundations:

- a single `development-conductor` coordinator;
- specialist agents;
- fresh implementation sub-agents;
- specification review before code-quality review;
- task readiness and acceptance criteria before implementation;
- Autopilot workflow state and approval gates;
- persistent intelligence and memory;
- Design Authority through `design.md`;
- separate security, accessibility, design, code, specification, and simplicity reviewers;
- sequential task gating;
- explicit human approval for consequential operations.

These foundations should be retained.

The remaining architectural weakness is that key controls are still substantially **instruction-level conventions** rather than **runtime-enforced contracts**. The framework needs a deterministic way to answer:

1. What exactly was this agent authorized to build?
2. Which source documents were authoritative for that increment?
3. Which acceptance criteria apply?
4. What evidence proves each criterion?
5. Did the verifier independently reconstruct the requirement context?
6. Did the implementation introduce architectural, design, security, or scope drift?
7. If verification failed, may DK safely correct it automatically?
8. How many correction attempts have already occurred?
9. Why does DK currently believe the increment is complete?
10. Can that conclusion be reconstructed later from persisted evidence?

The proposed contract and evidence architecture answers those questions.

---

## 3. Non-Negotiable Architecture Principles

### 3.1 Authority Hierarchy

DK must use the following authority hierarchy unless a project defines a stricter compatible hierarchy:

1. Current explicit user intent and approvals
2. Repository-level DK/agent policy such as `AGENTS.md`
3. Approved product requirements
4. Approved feature specification
5. Approved architecture and architectural decisions
6. Authoritative `design.md` for frontend/UI work
7. Approved task plan
8. Generated Development Contract for the active increment
9. Actual repository state
10. Runtime/test evidence
11. Agent reports and summaries

Agent summaries are deliberately last. They may help navigation, but they never replace the sources above them.

### 3.2 Authoritative Source Rehydration

Every independent execution role must reconstruct its task context from authoritative project sources.

A reviewer must not be given only:

```text
The implementation agent says it implemented X, Y and Z.
```

Instead the reviewer receives or resolves:

```text
Development Contract
+ referenced specification sections
+ architecture constraints
+ applicable design rules
+ repository state
+ actual diff
+ test/runtime evidence
+ optional upstream report as non-authoritative evidence
```

### 3.3 No Self-Certification

An implementation agent may report criterion status, but that status is an assertion only.

A separate verification context must independently determine final criterion status.

### 3.4 Evidence Required for PASS

`PASS` without evidence is invalid.

Every criterion verdict must include one or more evidence references where applicable, for example:

- file and line/range;
- test identifier;
- command result;
- runtime observation;
- browser/visual observation;
- schema/migration evidence;
- architecture rule check;
- design rule check.

### 3.5 Bounded Autonomy

DK should automatically correct safe, reversible implementation defects, but it must not thrash indefinitely.

Default maximum correction cycles: **3**.

The project/runtime may lower this value for high-risk changes. Increasing it above the default should require explicit configuration.

### 3.6 Host Independence

DK methodology must not depend on Antigravity, Codex, Claude Code, Freebuff, OpenCode, or any single model/provider.

The host is an execution capability provider. DK owns the methodology, contracts, gates, evidence model, and lifecycle semantics.

### 3.7 Backward Compatibility

Existing commands remain available and recognizable.

Existing projects without Development Contracts must still work. DK should derive a contract from existing authoritative artifacts when a contract is required.

No user should be forced to understand multi-agent internals merely to run `/dk-autopilot` or `/dk-build-auto`.

---

## 4. Target Operating Model

### 4.1 User View

```text
User
  |
  v
/dk-autopilot or /dk-build-auto
  |
  v
Development Kit
  |
  +--> works inside the current supported host
  |
  +--> automatically chooses execution strategy
  |
  +--> presents only meaningful approvals, blockers and results
```

### 4.2 Internal View

```text
                    AUTHORITATIVE SOURCES
                           |
                           v
                  DEVELOPMENT CONTRACT
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        IMPLEMENTER    VERIFIER       REVIEWERS
             |             |             |
             |             |             +--> code quality
             |             |             +--> architecture
             |             |             +--> security
             |             |             +--> accessibility
             |             |             +--> design
             |             |
             +-------> EVIDENCE STORE <---+
                           |
                           v
                    ACCEPTANCE GATE
                           |
                 +---------+---------+
                 |                   |
               PASS                FAIL
                 |                   |
                 v                   v
             continue          correction/escalation
```

### 4.3 Communication Rule

Specialist agents do not pass authority to one another.

They coordinate through:

- authoritative artifacts;
- generated contracts;
- repository state;
- structured evidence;
- runtime state.

Their prose summaries remain useful, but summaries are not the control plane.

---

## 5. Development Contract

### 5.1 Purpose

A Development Contract is the machine-readable and human-readable execution boundary for one approved implementation increment.

It answers:

- what must be changed;
- why;
- where the requirement originates;
- what must not be changed;
- which acceptance criteria must pass;
- which architecture/design/security constraints apply;
- how risky the change is;
- which gates are mandatory;
- what evidence is required.

### 5.2 Proposed Storage

Project runtime state:

```text
.development-kit/
  contracts/
    INC-0001/
      contract.json
      contract.md
  runs/
    INC-0001/
      run-0001/
        manifest.json
        implementation.json
        changed-files.json
        commands.json
        test-results.json
        verification.json
        code-review.json
        architecture-review.json
        security-review.json
        accessibility-review.json
        design-review.json
        simplicity-review.json
        acceptance.json
        final-state.json
```

`contract.json` is canonical for runtime processing. `contract.md` is a deterministic human-readable rendering of the same data.

Runtime evidence belongs under `.development-kit/` and should follow the existing project-state persistence and ignore policy. It must not silently become committed product source unless a project explicitly chooses to commit selected records.

### 5.3 Proposed Contract Schema

Minimum fields:

```json
{
  "schemaVersion": "1.0.0",
  "contractId": "INC-0042",
  "projectId": "...",
  "createdAt": "...",
  "status": "approved",
  "objective": "Implement customer contact management",
  "scope": {
    "in": [],
    "out": []
  },
  "authoritativeSources": [],
  "requirements": [],
  "acceptanceCriteria": [],
  "architectureConstraints": [],
  "designConstraints": [],
  "securityConstraints": [],
  "risk": {
    "level": 2,
    "reasons": []
  },
  "requiredVerification": [],
  "requiredReviewers": [],
  "correctionPolicy": {
    "maxAttempts": 3
  },
  "approvalPolicy": {},
  "sourceFingerprint": "..."
}
```

### 5.4 Source References

A source reference should contain enough information to detect stale contracts:

```json
{
  "path": "docs/specifications/customer-management.md",
  "kind": "specification",
  "authority": "required",
  "sections": ["REQ-CUST-014", "REQ-CUST-015"],
  "fingerprint": "sha256:..."
}
```

If an authoritative source changes after contract creation, DK must mark the contract stale and re-evaluate it before implementation or verification continues.

### 5.5 Acceptance Criterion Model

Each criterion must have a stable ID.

Example:

```json
{
  "id": "AC-CUST-004",
  "statement": "Creating a customer with an existing email returns HTTP 409",
  "source": "REQ-CUST-015",
  "verificationType": ["test", "code"],
  "requiredEvidence": true
}
```

### 5.6 Contract Creation

Contracts should normally be generated when an approved task becomes ready for implementation.

Generation pipeline:

```text
approved task
   |
   v
resolve authoritative sources
   |
   v
extract requirements and exclusions
   |
   v
resolve architecture/design/security constraints
   |
   v
normalize acceptance criteria with stable IDs
   |
   v
classify risk
   |
   v
select mandatory verification/review gates
   |
   v
fingerprint sources
   |
   v
validate contract
   |
   v
persist contract
```

Contract generation itself must be deterministic enough that the runtime can validate completeness before execution.

---

## 6. Structured Verification and Evidence Model

### 6.1 Criterion Statuses

The runtime-recognized statuses should be:

```text
PASS
FAIL
PARTIAL
UNVERIFIED
NOT_APPLICABLE
```

`PASS` requires evidence unless the schema explicitly marks the criterion as evidence-exempt.

`PARTIAL` and `UNVERIFIED` are not acceptance states.

### 6.2 Verification Record

Example:

```json
{
  "contractId": "INC-0042",
  "runId": "run-0002",
  "role": "spec-verifier",
  "contextIsolation": "fresh",
  "sourceFingerprint": "sha256:...",
  "criteria": [
    {
      "id": "AC-CUST-004",
      "status": "PASS",
      "evidence": [
        {
          "type": "source",
          "path": "src/api/customers.ts",
          "range": "74-109"
        },
        {
          "type": "test",
          "id": "customers.duplicate-email.returns-409"
        }
      ]
    }
  ],
  "verdict": "PASS"
}
```

### 6.3 Evidence Types

Initial supported evidence types:

- `source`
- `diff`
- `test`
- `command`
- `runtime`
- `browser`
- `visual`
- `schema`
- `migration`
- `configuration`
- `manual`

Evidence parsers should be added incrementally. The first release does not need to automate every evidence type, but the schema should permit them without redesign.

### 6.4 Assertions vs Verified Evidence

The implementation agent may emit:

```json
{
  "assertedCriterionStatus": "PASS"
}
```

but the acceptance engine must ignore this assertion when determining final acceptance unless an independent verifier has produced a valid corresponding verification record.

---

## 7. Independent Context Rehydration

### 7.1 Context Package Builder

Add a runtime context-package builder that constructs role-specific packages from the contract.

Proposed module:

```text
runtime/orchestration/context-package.mjs
```

The package should include only what that role needs, but must always include the contract identity and source fingerprint.

### 7.2 Implementation Context

Contains:

- contract;
- relevant authoritative specification excerpts/references;
- applicable architecture rules;
- applicable `design.md` rules when UI is touched;
- repository scout evidence;
- current relevant code;
- required tests/acceptance criteria;
- allowed scope and exclusions;
- risk constraints.

### 7.3 Verification Context

Fresh context. Contains:

- same contract;
- independently resolved authoritative sources;
- repository state after implementation;
- actual Git diff;
- actual test/runtime evidence;
- optional implementation report clearly marked non-authoritative.

It must not inherit the implementation agent's chain of reasoning or rely on its prose summary.

### 7.4 Technical Review Context

Contains:

- contract for scope boundaries;
- repository conventions;
- actual diff;
- relevant surrounding code;
- test results;
- dependency changes;
- architecture delta.

### 7.5 Design Review Context

For UI-related increments:

- contract;
- authoritative `design.md`;
- relevant reference assets if governed by Design Authority;
- implementation diff;
- rendered/browser evidence when the host supports it.

---

## 8. Orchestration Runtime

### 8.1 Preserve the Single Conductor Model

The `development-conductor` remains the single coordinator. Specialist agents must not spawn one another.

The change is that orchestration decisions become increasingly backed by runtime state and structured contracts rather than being held only in prompts.

### 8.2 Proposed Runtime Modules

Add a new orchestration layer rather than overloading every concern into `runtime/autopilot/`:

```text
runtime/orchestration/
  contract-builder.mjs
  contract-validator.mjs
  contract-store.mjs
  source-resolver.mjs
  source-fingerprint.mjs
  context-package.mjs
  capability-detector.mjs
  execution-strategy.mjs
  evidence-store.mjs
  evidence-validator.mjs
  verification-engine.mjs
  correction-engine.mjs
  risk-classifier.mjs
  gate-selector.mjs
  acceptance-engine.mjs
```

The existing Autopilot runtime remains responsible for lifecycle transitions, approvals, leases, state revisions, pause/resume, and high-level next-action generation.

The orchestration layer becomes responsible for contract-driven task execution.

### 8.3 Integration Boundary

```text
Autopilot transition model
        |
        v
TASK_READY_FOR_IMPLEMENTATION
        |
        v
Orchestration runtime
        |
        +--> create/validate contract
        +--> select execution strategy
        +--> dispatch implementation
        +--> gather evidence
        +--> verify
        +--> correct if allowed
        +--> run required reviews
        +--> acceptance decision
        |
        v
structured result returned to Autopilot
```

This keeps the mature Autopilot control loop intact.

---

## 9. Host Capability Abstraction

### 9.1 Objective

DK must remain usable inside a single user-selected environment.

A user running Antigravity should not need to manually open Codex for review. A user running Codex should not need to manually open another tool. Multi-model routing can be supported later, but it is not a requirement for core correctness.

### 9.2 Capability Contract

Proposed capability shape:

```js
{
  fileRead: true,
  fileWrite: true,
  shell: true,
  git: true,
  freshContext: true,
  subagents: true,
  parallelAgents: false,
  browser: true,
  visualInspection: true,
  externalModelRouting: false
}
```

### 9.3 Execution Strategies

#### Strategy A: Sequential Fresh Context

For hosts without native sub-agents:

```text
implementation pass
   |
rehydrate fresh verification context
   |
verification pass
   |
rehydrate fresh review context
   |
review pass
```

The same underlying model may be used, but the context must be independently reconstructed.

#### Strategy B: Native Multi-Agent

For hosts that can spawn isolated sub-agents:

```text
DK conductor
  +--> fresh implementer
  +--> fresh verifier
  +--> fresh reviewer(s)
```

#### Strategy C: Multi-Model Routing

Optional later capability:

```text
DK
  +--> implementation provider/model
  +--> independent verification provider/model
  +--> visual provider/model
  +--> security provider/model
```

This is an optimization and independence enhancement, not a baseline dependency.

### 9.4 Host Adapter Rule

Host-specific logic must live in adapters/capability detection. Core contract and acceptance logic must not import or assume a particular host implementation.

---

## 10. Risk Classification

### 10.1 Proposed Levels

**Risk 0 - Informational**
- documentation only;
- comments;
- non-behavioural metadata.

**Risk 1 - Low**
- ordinary styling;
- copy;
- isolated UI components;
- reversible presentation changes.

**Risk 2 - Standard**
- application logic;
- ordinary API behaviour;
- non-sensitive persistence changes;
- feature behaviour.

**Risk 3 - High**
- authentication/authorization;
- tenant isolation;
- sensitive data handling;
- database migrations;
- permissions;
- dependency/infrastructure changes;
- financial/business-critical calculations.

**Risk 4 - Critical/Consequential**
- destructive data operations;
- irreversible migrations;
- production infrastructure;
- credential operations;
- public publishing/release/deployment;
- actions already covered by mandatory Autopilot human approval gates.

### 10.2 Risk Drives Gates

Example matrix:

| Risk | Verification | Code Review | Architecture | Security | Design | Human Gate |
|---|---|---|---|---|---|---|
| 0 | targeted | optional | no | no | no | normally no |
| 1 | required | required | conditional | conditional | UI conditional | normally no |
| 2 | required | required | conditional | conditional | conditional | policy dependent |
| 3 | required | required | required where relevant | required where relevant | conditional | often required |
| 4 | required | required | required | required | conditional | mandatory where consequential |

This matrix must augment, not weaken, the existing mandatory Autopilot approval gates.

---

## 11. Bounded Automatic Correction Loop

### 11.1 Current Behaviour to Change

The current `/dk-build-auto` philosophy pauses when tests or reviews fail.

The new model should distinguish:

- **correctable implementation failure**;
- **requirement ambiguity**;
- **architecture/design decision requiring approval**;
- **security/high-risk blocker**;
- **consequential action requiring human approval**.

Only the first category should automatically enter a correction loop.

### 11.2 Loop

```text
IMPLEMENT
   |
   v
VERIFY
   |
   +--> PASS --> REVIEW
   |
   +--> FAIL/PARTIAL
            |
            v
      classify failure
            |
     +------+-------+
     |              |
 safe correction   gated/blocking
     |              |
     v              v
 corrective      pause/escalate
 contract delta
     |
     v
 fresh implementer/fix context
     |
     v
 VERIFY AGAIN
```

### 11.3 Corrective Instruction Object

The correction engine should generate a narrow corrective object:

```json
{
  "contractId": "INC-0042",
  "attempt": 2,
  "failures": [
    {
      "criterionId": "AC-CUST-004",
      "expected": "Duplicate email returns HTTP 409",
      "observed": "HTTP 500",
      "evidence": ["..."]
    }
  ],
  "allowedScope": ["..."],
  "prohibitedChanges": ["..."]
}
```

The corrective agent must not receive permission to redesign the feature simply because verification failed.

### 11.4 Stop Conditions

Stop automatic correction when any of the following occurs:

- max attempts reached;
- identical failure repeats after correction;
- new high-risk finding appears;
- requirement ambiguity is detected;
- architectural deviation is required;
- security-sensitive decision is required;
- consequential operation needs approval;
- source fingerprint changes;
- failure scope expands beyond the contract.

---

## 12. Verification vs Review vs Acceptance

These must remain separate concepts.

### Verification

Question:

> Did the implementation satisfy the approved contract and specification?

Primary role: evolved `spec-reviewer`, potentially renamed internally to `spec-verifier` while preserving compatibility aliases initially.

### Technical Review

Question:

> Is the implementation technically sound, maintainable, secure, accessible, architecturally consistent, and appropriately simple?

Roles:

- `code-reviewer`
- `security-reviewer`
- `accessibility-reviewer`
- `design-reviewer`
- `simplicity-reviewer`
- new or expanded architecture review capability

### Acceptance

Question:

> Given verification evidence, required reviewer verdicts, risk policy, and human approvals, may DK mark this increment complete?

Acceptance must be a runtime decision, not an agent opinion.

---

## 13. Architecture Drift Detection

Add an explicit architecture delta check.

Detect at minimum:

- new dependencies;
- new external services;
- new storage technologies;
- new top-level directories/patterns;
- duplicated subsystems;
- layer-boundary violations;
- unauthorized API surface expansion;
- new environment/configuration requirements;
- migration strategy changes;
- new authentication/authorization patterns.

A detected change is not automatically wrong. It must be classified as:

```text
EXPECTED
AUTHORIZED
UNAUTHORIZED
REQUIRES_DECISION
```

Unauthorized or decision-requiring architecture changes block acceptance.

---

## 14. Design Authority Integration

For any contract touching frontend/UI work:

1. Resolve `design.md` as an authoritative source.
2. Fingerprint it into the contract.
3. Resolve applicable design sections/rules.
4. Supply them independently to implementation and design review contexts.
5. Require visual/runtime evidence where the host supports it.
6. Treat design drift as verification/review failure according to severity.

The implementation agent's statement that it followed `design.md` is not proof.

If `design.md` changes during the run, the contract becomes stale and must be revalidated.

---

## 15. Changes to Existing Agents

### `development-conductor`

Add responsibilities to:

- obtain runtime-generated contract actions;
- dispatch role-specific context packages;
- never substitute summaries for contract/source rehydration;
- submit structured evidence/results;
- respect correction-engine decisions;
- surface only true human gates and unresolved blockers.

### `implementation-agent`

Change output semantics:

- report changes and assertions;
- do not declare final acceptance;
- reference contract criterion IDs;
- emit structured implementation evidence where possible.

### `spec-reviewer`

Strengthen into independent verification:

- must load contract and authoritative sources independently;
- must inspect actual repository state/diff;
- must classify every criterion using runtime statuses;
- `PASS` requires evidence;
- upstream implementation summary is explicitly non-authoritative;
- context isolation must be recorded.

### `code-reviewer`

Add contract scope awareness and structured findings.

### `security-reviewer`, `design-reviewer`, `accessibility-reviewer`, `simplicity-reviewer`

Add structured result schema and evidence references.

### Architecture review

Prefer adding a focused `architecture-reviewer` only if repository inspection confirms that expanding the existing solution-architect/code-review roles would conflate responsibilities. Follow the existing reuse-before-creating rule.

---

## 16. Command Behaviour Changes

### `/dk-build`

New internal sequence:

```text
select task
resolve/create contract
validate contract
classify risk
build context
fresh implementation
run required technical verification
fresh specification verification
safe correction loop if needed
required reviews
acceptance engine
complete or pause
```

### `/dk-build-auto`

Retains its purpose of processing the approved plan automatically, but changes failure handling.

It should:

- automatically correct safe contract non-compliance;
- continue automatically after successful correction;
- pause only on non-correctable, ambiguous, high-risk, exhausted, or human-gated conditions;
- persist evidence for every attempt.

### `/dk-test`

Should be able to consume an active contract and attach test evidence to criterion IDs.

### `/dk-review`

Should rehydrate authoritative sources and use structured reviewer schemas.

### `/dk-autopilot`

Remains the top-level lifecycle controller. It should treat contract-driven implementation as the internal implementation mechanism once a task reaches readiness.

### `/dk-status`

Add optional visibility into:

- active contract;
- risk level;
- correction attempt;
- criterion pass/fail counts;
- outstanding required reviewer gates;
- stale contract status.

The default status output should remain concise.

---

## 17. Runtime State Integration

The existing Autopilot immutable revision/state model should be extended rather than replaced.

Proposed new state references:

```json
{
  "activeContractId": "INC-0042",
  "activeRunId": "run-0002",
  "contractFingerprint": "sha256:...",
  "riskLevel": 2,
  "correctionAttempt": 1,
  "verificationVerdict": "FAIL",
  "requiredGates": [],
  "completedGates": [],
  "acceptanceState": "pending"
}
```

Large evidence payloads should remain in evidence files and be referenced from Autopilot state rather than bloating every state snapshot.

---

## 18. Schemas

Add schemas under `schemas/` for at least:

```text
schemas/development-contract.schema.json
schemas/orchestration-run.schema.json
schemas/verification-result.schema.json
schemas/review-result.schema.json
schemas/evidence-record.schema.json
schemas/correction-request.schema.json
schemas/host-capabilities.schema.json
```

All persisted orchestration data must be versioned.

Schema migration policy must be defined before release.

---

## 19. Implementation Phases

### Phase 0 - Baseline and Acceptance Lock

Before implementation:

- record current v0.8.1 validation baseline;
- identify exact current tests and counts;
- verify plugin mirror state;
- capture current command behavior;
- identify files that are canonical vs generated mirrors;
- define feature branch and commit boundaries;
- confirm no unrelated working-tree changes.

Exit criteria:

- reproducible clean baseline;
- implementation plan approved;
- no unresolved scope ambiguity.

### Phase 1 - Contract Foundation

Implement:

- contract schema;
- source-reference schema;
- stable requirement/criterion ID handling;
- contract builder;
- contract validator;
- contract store;
- deterministic Markdown renderer;
- source fingerprinting;
- stale-contract detection.

Do not introduce multi-agent routing yet.

Exit criteria:

- an approved task can deterministically produce a valid contract;
- stale source changes are detected;
- old projects without contract files can generate one on demand;
- unit tests pass.

### Phase 2 - Evidence Foundation

Implement:

- evidence schema;
- evidence store;
- structured criterion statuses;
- evidence validation;
- run manifest;
- implementation assertion record;
- test result attachment to criteria.

Exit criteria:

- `PASS` without required evidence is rejected;
- evidence survives resume/restart;
- evidence can be traced to run and contract.

### Phase 3 - Independent Verification Rehydration

Implement:

- role-specific context package builder;
- source re-resolution;
- fresh verification context requirements;
- strengthened `spec-reviewer` output;
- verification engine;
- no-self-certification enforcement.

Exit criteria:

- implementation assertion alone cannot complete a task;
- verification context has a recorded independent rehydration marker;
- every acceptance criterion receives a structured verdict;
- mismatched source fingerprints invalidate verification.

### Phase 4 - Acceptance Engine

Implement runtime acceptance decision logic.

Inputs:

- contract;
- criterion verification;
- test evidence;
- required reviews;
- risk classification;
- approval status;
- stale-state status.

Exit criteria:

- agents cannot mark accepted directly;
- acceptance is deterministic from persisted inputs;
- incomplete or stale evidence blocks completion.

### Phase 5 - Bounded Correction Loop

Implement:

- failure classifier;
- correction request schema;
- correction engine;
- attempt counters;
- loop stop conditions;
- repeated-failure detection;
- `/dk-build-auto` correction behavior.

Exit criteria:

- safe implementation defects are corrected automatically;
- ambiguity/high-risk/consequential failures still pause;
- maximum attempts are enforced;
- correction scope cannot silently expand contract scope.

### Phase 6 - Structured Technical Review

Convert relevant reviewers to structured result contracts.

Add or extend architecture drift review.

Exit criteria:

- required reviewers are selected from risk/impact;
- findings carry severity, evidence, and disposition;
- critical unresolved findings block acceptance;
- review is separate from specification verification.

### Phase 7 - Design Authority Binding

Integrate `design.md` fingerprinting and UI contract constraints.

Exit criteria:

- UI work automatically binds Design Authority;
- design source changes invalidate stale verification;
- design reviewer uses actual authoritative design rules;
- rendered evidence is used when capability exists.

### Phase 8 - Host Capability Layer

Implement:

- host capability schema;
- capability detector;
- execution-strategy selector;
- sequential fresh-context fallback;
- native sub-agent strategy interface.

Do not require external multi-model providers.

Exit criteria:

- core orchestration runs without assuming one host;
- unsupported capabilities degrade safely;
- host capability absence cannot silently skip mandatory verification.

### Phase 9 - Autopilot and Command Integration

Integrate contract orchestration with:

- `/dk-build`
- `/dk-build-auto`
- `/dk-test`
- `/dk-review`
- `/dk-status`
- `/dk-autopilot`

Exit criteria:

- current command names remain valid;
- old workflows remain recognizable;
- new behavior is automatic;
- human approvals remain preserved.

### Phase 10 - Multi-Model Routing (Optional, After Core Release)

Only after the host-independent contract architecture is stable:

- provider/model role preferences;
- cross-model reviewer routing;
- fallback policy;
- cost/privacy policy;
- provider capability checks.

This phase must not block the core release.

---

## 20. Test Strategy

### 20.1 Unit Tests

Cover:

- contract creation;
- schema validation;
- source fingerprinting;
- stale detection;
- risk classification;
- gate selection;
- evidence validation;
- acceptance engine;
- correction classification;
- correction attempt limits;
- capability strategy selection.

### 20.2 Contract Tests

Prove:

- implementation summaries cannot satisfy verification;
- `PASS` without evidence fails validation;
- a changed authoritative source invalidates stale evidence;
- a reviewer with the wrong contract fingerprint is rejected;
- an implementation agent cannot set acceptance state;
- mandatory human gates cannot be bypassed by correction logic.

### 20.3 Integration Tests

Scenarios:

1. standard feature passes first attempt;
2. safe defect fails verification then is corrected;
3. same defect repeats until retry limit;
4. requirement ambiguity causes immediate human pause;
5. architecture deviation requires decision;
6. UI change binds `design.md`;
7. `design.md` changes mid-run and invalidates verification;
8. migration triggers elevated risk/review;
9. security finding blocks acceptance;
10. host lacks sub-agents and sequential rehydration fallback succeeds;
11. resume after process restart preserves contract/evidence state;
12. old project without contracts transparently generates one.

### 20.4 Adversarial Evals

Create evals specifically designed to test agent anchoring and false certification:

- implementation summary falsely claims a criterion passed;
- implementation tests assert wrong behavior that matches buggy code;
- reviewer is given tempting upstream summary contradictory to spec;
- implementation introduces out-of-scope feature;
- implementation adds unauthorized dependency;
- code passes tests but violates architecture;
- UI passes functionality but violates `design.md`;
- reviewer attempts to return PASS without evidence;
- correction agent attempts unrelated refactor;
- host capability claims visual support but no evidence exists.

### 20.5 Regression

The full current `release:validate` suite must pass, plus new orchestration tests.

Backward compatibility tests must cover existing command discovery and existing project bootstrap behavior.

---

## 21. Documentation Work

At implementation completion update, as applicable:

- `AGENTS.md`
- `README.md`
- `CHANGELOG.md`
- `docs/SUMMARY.md`
- `docs/01-overview/`
- `docs/02-user-guide/automated-guided-workflow.md`
- `docs/03-reference/commands/`
- `docs/03-reference/agents/`
- `docs/03-reference/skills/`
- `docs/04-architecture/agent-orchestration.md`
- `docs/04-architecture/lifecycle-orchestration.md`
- `docs/04-architecture/architecture-invariants.md`
- `docs/04-architecture/architecture-decisions.md`
- `docs/06-internals/implementation-agent-isolation.md`
- `docs/06-internals/review-pipeline-internals.md`
- `docs/06-internals/workflow-state-and-resume-specification.md`
- testing/evaluation reference pages;
- plugin mirror documentation where generated/synchronized.

Documentation must describe the conceptual model without forcing ordinary users to understand internal role routing.

---

## 22. Proposed Repository Change Surface

Expected new areas:

```text
runtime/orchestration/
schemas/development-contract.schema.json
schemas/orchestration-run.schema.json
schemas/verification-result.schema.json
schemas/review-result.schema.json
schemas/evidence-record.schema.json
schemas/correction-request.schema.json
schemas/host-capabilities.schema.json
scripts/orchestration*.test.mjs
evals/contract-orchestration/
```

Expected modified areas:

```text
runtime/autopilot/
commands/dk-build.md
commands/dk-build-auto.md
commands/dk-test.md
commands/dk-review.md
commands/dk-status.md
commands/dk-autopilot.md
agents/development-conductor.md
agents/implementation-agent.md
agents/spec-reviewer.md
agents/code-reviewer.md
agents/security-reviewer.md
agents/accessibility-reviewer.md
agents/design-reviewer.md
agents/simplicity-reviewer.md
skills/context-packing/
skills/subagent-driven-implementation/
skills/specification-compliance-review/
skills/verification-before-completion/
AGENTS.md
README.md
CHANGELOG.md
package.json
docs/
```

The exact file list must be re-derived during Phase 0. This plan does not authorize speculative file creation where an existing component should be extended instead.

---

## 23. Commit Strategy

Use small deterministic commits. Proposed sequence:

1. `feat(orchestration): add development contract foundation`
2. `feat(orchestration): add evidence and run records`
3. `feat(orchestration): enforce independent specification verification`
4. `feat(orchestration): add deterministic acceptance engine`
5. `feat(orchestration): add bounded correction loop`
6. `feat(orchestration): structure technical review and drift detection`
7. `feat(design): bind design authority to development contracts`
8. `feat(orchestration): add host capability abstraction`
9. `feat(commands): integrate contract orchestration into DK workflows`
10. `test(orchestration): add adversarial and compatibility evals`
11. `docs: document contract-driven orchestration`
12. `chore(release): prepare next minor release`

Commit boundaries may be adjusted if implementation dependencies require it, but each commit should remain independently understandable and validated.

---

## 24. Release Gates

The feature is not release-ready until all of the following pass:

### Functional

- Development Contract generation works on new and existing projects.
- Every accepted increment has independent verification.
- Every required criterion has evidence.
- Safe failures can self-correct within the configured bound.
- Unsafe/ambiguous/high-risk conditions pause correctly.
- Acceptance is runtime-driven.

### Safety

- Existing human approval gates are preserved.
- Correction loops cannot perform unauthorized consequential actions.
- Agents cannot change their own contract or approval policy.
- Contract/source staleness is detected.
- Secrets are not persisted in evidence.

### Compatibility

- Existing slash commands remain valid.
- Existing Antigravity integration remains valid.
- Existing OpenCode/platform adapter behavior is not regressed.
- Existing project state can be upgraded or interpreted safely.
- Users are not required to configure multiple AI providers.

### Quality

- all current release validation passes;
- all new orchestration unit/integration/eval suites pass;
- documentation validation passes;
- plugin mirror/synchronization validation passes;
- no unexplained architectural drift;
- no unnecessary new production dependency.

---

## 25. Explicit Non-Goals for the Core Upgrade

The initial release should **not** attempt to solve all future agent orchestration problems.

Out of scope for the first core release:

- requiring multiple commercial model subscriptions;
- mandatory external model routing;
- autonomous production deployment;
- removing existing human approval gates;
- unrestricted parallel agents writing simultaneously;
- agents rewriting approved requirements during implementation;
- replacing Autopilot's existing durable state architecture;
- replacing Design Authority;
- replacing DK Intelligence/Memory;
- creating a separate command for every internal orchestration role.

---

## 26. Key Failure Modes and Controls

### Failure: Bad specification is implemented perfectly

Control:
- specification integrity remains a pre-implementation gate;
- contracts trace criteria back to requirements;
- material ambiguity requires user resolution.

### Failure: Implementation and tests are both wrong in the same way

Control:
- verifier starts from original contract/specification;
- tests are evidence, not sole authority;
- criterion verification may require code/runtime evidence as well.

### Failure: Reviewer is anchored by implementer summary

Control:
- independent source rehydration;
- summary explicitly non-authoritative;
- fresh context marker required.

### Failure: Architecture slowly drifts

Control:
- architecture delta review;
- dependency/service/configuration detection;
- unauthorized drift blocks acceptance.

### Failure: Correction loop makes problem worse

Control:
- narrow corrective request;
- contract scope remains fixed;
- max attempts;
- failure expansion causes escalation.

### Failure: Same model reviews itself

Control:
- first priority is context independence, not provider diversity;
- fresh isolated context is mandatory where possible;
- later multi-model routing can increase independence further.

### Failure: Host does not support sub-agents

Control:
- sequential fresh-context strategy;
- mandatory verification cannot be silently skipped.

### Failure: Evidence becomes huge

Control:
- store evidence artifacts separately;
- state snapshots reference evidence rather than embedding all payloads;
- permit pruning/archive policy for completed historical runs.

---

## 27. Success Criteria for the Architecture Upgrade

The upgrade succeeds when a normal user can still type:

```text
/dk-build-auto
```

and DK can internally perform this sequence without the user manually coordinating agents:

```text
Task selected
Contract generated
Contract validated
Risk classified
Fresh implementation executed
Tests collected
Fresh specification verification executed
Failure found
Safe correction executed automatically
Specification verification re-run
All criteria passed with evidence
Code review passed
Conditional specialist reviews passed
Simplicity review passed
Regression tests passed
Acceptance engine marked increment accepted
Next approved task selected
```

The user should only be interrupted for a genuine ambiguity, exhausted correction loop, unsafe/high-risk decision, mandatory approval, or unrecoverable blocker.

---

## 28. Final Architecture Position

Development Kit should not aim for merely "autonomous coding."

Its target should be:

> **Autonomous implementation inside a controlled engineering system.**

The durable value of DK is the engineering methodology and control plane:

```text
Intent
  -> Requirements
  -> Specification
  -> Architecture
  -> Design Authority
  -> Task Plan
  -> Development Contract
  -> Implementation
  -> Independent Verification
  -> Technical Review
  -> Evidence-backed Acceptance
  -> Release
```

Implementation agents, hosts, and models should remain replaceable execution workers underneath that methodology.

This architecture allows DK to improve model independence, reduce broken-telephone summary propagation, make completion auditable, increase safe autonomy, and preserve the simple one-workspace experience expected by users.

---

## 29. Recommended Immediate Next Increment

The first implementation increment should be intentionally narrow:

**Increment ORCH-001: Development Contract Foundation**

Deliver only:

1. `development-contract` schema;
2. contract builder from an approved task and authoritative source references;
3. stable acceptance-criterion IDs;
4. source fingerprinting;
5. contract validation;
6. contract persistence under `.development-kit/contracts/`;
7. deterministic Markdown rendering;
8. stale-contract detection;
9. tests proving generation, validation, fingerprinting, staleness, and backward-compatible on-demand creation.

Do **not** add correction loops, host routing, multi-model support, or broad agent changes in ORCH-001.

The purpose of ORCH-001 is to establish the contract as a trustworthy execution boundary before any later orchestration capability depends on it.
