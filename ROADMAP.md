# DKF Roadmap

## From disciplined workflow to reliability runtime

**Strategic position:** DKF is evolving into **the reliability control plane for agentic software development**.

**Product promise:** **AI can write it. DKF proves it.**

This roadmap is directional. It distinguishes current capability from planned work and should not be read as a claim that unreleased features already exist.

---

## Current baseline — v0.10.0

The current release provides the reliability foundation:

- Development Contracts with source fingerprints;
- independent verification and review isolation;
- deterministic acceptance states;
- required-control and reviewer coverage;
- architecture-drift detection;
- source staleness protection;
- execution-safety and blast-radius controls;
- bounded correction;
- DKF Design Authority;
- DK Intelligence and Memory;
- DK Control Center;
- Numbered Decision Interface;
- structured idea-suggestion promotion;
- adversarial regression testing;
- cross-platform agent integrations.

The remaining roadmap is about making this reliability model **adaptive, portable, enforceable, scalable, and externally provable**.

---

## v0.11 — Adaptive Reliability

### Objective

Replace the universal fixed lifecycle with a **policy-driven Lifecycle Compiler** that chooses the minimum sufficient workflow and mandatory controls for a change.

### Planned capabilities

- validated change classification;
- scope, risk, novelty, security, architecture, UI/design, data/migration, external-system, destructive, and consequential-action signals;
- declarative Policy Engine foundation;
- deterministic Lifecycle Compiler;
- persisted compiled lifecycle state;
- explicit reasons for required and omitted stages;
- stale-policy and stale-classification invalidation;
- Development Contract integration;
- Acceptance Engine integration;
- Autopilot routing from compiled lifecycle state;
- Control Center visibility for policy and lifecycle decisions;
- adversarial tests proving controls cannot be escaped through under-classification.

### Principle

> **Safety by proving which controls are required, not by forcing identical ceremony on every change.**

---

## v0.12 — DKF Proof

### Objective

Make DKF acceptance portable and inspectable outside the live agent session.

### Planned capabilities

- machine-readable Acceptance Certificate;
- human-readable proof report;
- evidence manifest;
- Authority Graph export;
- binding to code commit SHA;
- binding to specification/design/contract fingerprints;
- binding to policy and DKF versions;
- invalidation when relevant authoritative inputs change;
- `/dk-prove` or equivalent proof-generation capability.

### Target output

A completed change should be able to produce an evidence bundle that explains why it is `ACCEPTED` without relying on the implementation agent's narrative.

---

## v0.13 — Repository Enforcement

### Objective

Move DKF from optional local discipline into repository-level engineering governance.

### Planned capabilities

- generated GitHub Actions integration;
- PR-level DKF acceptance checks;
- required status-check support;
- proof-bundle publication as CI artifacts;
- stale-proof detection after new commits;
- merge prevention when required DKF acceptance is absent or invalid.

### Target status

```text
DKF / Acceptance
```

becomes eligible to act as a protected merge requirement.

---

## v0.14 — DKF Reliability Benchmark

### Objective

Publish external evidence that DKF reduces agentic-development failure modes.

### Planned benchmark scenarios

- agent claims tests passed when they did not;
- requirement never implemented;
- partial security-control coverage;
- task-count or dependency inconsistency;
- specification changed after implementation;
- silent architecture drift;
- command exceeds project blast radius;
- missing regression coverage;
- Design Authority violation;
- implementation self-certification;
- stale verification reuse;
- code modified after verification.

### Planned metrics

- false completion accepted;
- missing requirements detected;
- stale evidence detected;
- security/control gaps detected;
- unauthorized architecture drift detected;
- scope violations detected;
- regression escape rate;
- human interventions;
- token usage;
- time to verified completion.

The benchmark must distinguish **code produced** from **work proven acceptable**.

---

## v0.15 — Isolated Execution

### Objective

Make task execution and verification environment isolation a first-class DKF capability.

### Planned capabilities

- Git worktree-backed task execution;
- separate verifier worktrees or reconstructed verification environments;
- Execution Provider contract;
- future adapters for Docker, dev containers, remote sandboxes, and cloud agents;
- environment provenance in verification evidence;
- safe cleanup and lifecycle handling.

Execution safety and execution isolation remain separate concerns and must both be enforced.

---

## v0.16 — Safe Parallelism

### Objective

Increase throughput without sacrificing determinism or isolation.

### Planned capabilities

- task dependency DAG;
- file/resource ownership analysis;
- schema/API/shared-state overlap detection;
- execution waves for provably independent tasks;
- worktree isolation per parallel task;
- deterministic integration order;
- post-merge re-verification;
- conflict and stale-evidence invalidation.

Parallelism must be a **computed safe property**, not a blanket speed setting.

---

## v0.17 — Multi-Repository Change Contracts

### Objective

Govern one product change across multiple repositories.

### Planned model

```text
CHANGE CONTRACT
│
├── frontend repository contract
├── API repository contract
├── database repository contract
├── service repository contract
└── aggregate acceptance
```

### Planned capabilities

- parent Change Contract;
- repository-specific Development Contracts;
- cross-repository dependency graph;
- coordinated verification;
- coordinated pull requests;
- aggregate acceptance;
- cross-repo source and policy fingerprints.

The overall change remains incomplete while any required repository contract is unresolved.

---

## v0.18 — Evidence Intelligence

### Objective

Make DKF aware of **evidence strength**, not merely evidence presence.

### Planned evidence model

Illustrative hierarchy:

1. implementation narrative — non-authoritative;
2. independent code review;
3. static analysis;
4. executed automated test;
5. observed runtime/browser/API behavior;
6. independent reproduction;
7. deterministic external control.

Policy should be able to require stronger evidence for higher-risk criteria.

### Verifier diversity

DKF should also reduce correlated reasoning failure by supporting evidence from different verification mechanisms and, where useful, different model/provider contexts.

---

## v0.19 — Control Center Flight Recorder

### Objective

Make the Control Center the best place to understand why DKF believes a change is safe or blocked.

### Planned high-value views

- Change Graph;
- Authority Graph;
- Evidence Graph;
- task DAG;
- contract diff;
- policy evaluation;
- lifecycle compilation;
- risk timeline;
- agent/run timeline;
- source staleness;
- Acceptance Certificate.

The Control Center remains an interface to DKF Core. It does not become an independent trust authority.

---

## v1.0 — Proven Reliability Release

### Release threshold

DKF should reach v1.0 only when the framework has moved beyond feature accumulation and can demonstrate its core reliability claim.

The intended v1.0 threshold includes:

- adaptive lifecycle operational;
- deterministic policy-driven controls;
- proof certificates operational;
- repository enforcement operational;
- isolated execution foundation operational;
- safe task parallelism operational;
- multi-repository orchestration operational;
- evidence-strength governance operational;
- public reliability benchmark published;
- measurable reduction in false AI completion compared with an unguided coding-agent baseline.

---

## What is deliberately not a roadmap priority

DKF will not optimize for feature count.

The following are not strategic goals by themselves:

- increasing the number of agents;
- increasing the number of commands;
- increasing the number of skills;
- building a generic project-management suite;
- adding a large marketplace before the extension contracts are stable;
- adding parallel execution before dependency and isolation safety are proven.

Each new capability must strengthen one or more of DKF's core responsibilities:

**authority · contracts · execution · evidence · verification · risk · provenance · acceptance**

---

See [STRATEGY.md](STRATEGY.md) for the locked strategic direction.