# DK Reliability Control-Plane Amendment

**Status:** Approved implementation amendment  
**Applies to:** DK contract-driven orchestration plan for the v0.9 architecture line  
**Evidence source:** Proposal Builder DKF field run, 23 August 2026  
**Purpose:** Convert newly observed framework failures into runtime-enforced controls and regression tests.

---

## 1. Decision

The existing contract-driven orchestration plan remains authoritative. This amendment strengthens it with controls that were proven necessary during a real enterprise application build.

The field run confirmed that Development Kit can produce strong product, architecture, task, and implementation work, but it also exposed a control-plane weakness:

> A stage or task may pass every test that the generating agent chose to run while still omitting controls that should have been part of the gate.

Therefore Development Kit must distinguish:

- implementation assertions;
- executed test results;
- required control coverage;
- independent verification;
- final acceptance.

No one of those may substitute for the others.

---

## 2. Field Failures That Become Regression Requirements

The following observed failures are now architecture inputs rather than one-off project lessons.

### REL-001 — Stale installation may appear successful

Observed behavior:

- a project-local install reported success;
- the available command set did not match the intended framework version;
- a forced explicit-version reinstall exposed additional commands;
- project/plugin runtime completeness could depend on files left behind by an earlier installation.

Required control:

- installer must verify the executing package version, installed manifest version, required directories, command registry, skill registry, runtime scripts, and schema assets;
- project/global plugin installation must be self-contained for runtime-backed commands;
- stale files must not be treated as proof of a successful upgrade.

### REL-002 — Autopilot amendment replayed stale stage content

Observed behavior:

- Product Owner PLAN corrections were supplied through Autopilot;
- the framework regenerated essentially the previous PLAN instead of applying the requested delta to the canonical repository artifact;
- the correction only succeeded after direct task-planner invocation with explicit open/edit/read-back instructions.

Required control:

- gate feedback must use an amendment mode, not an implicit full-stage regeneration;
- canonical artifact must be read before mutation;
- requested delta must be verified after write;
- unexpected changes must be surfaced;
- mutation must emit before/after fingerprints.

### REL-003 — Narrative consistency claims were false

Observed behavior:

- a plan claimed 20 tasks while containing 22;
- dependency visualization did not match declared dependencies;
- persistence resources were missing implementation owners;
- one approval persistence resource was later assigned to two tasks;
- the report nevertheless claimed complete traceability and no blockers.

Required control:

- task counts, unique IDs, dependency references, dependency cycles, ownership completeness, duplicate ownership, and acceptance-criteria mapping must be computed from machine-readable data;
- prose may render computed results but may not invent them.

### REL-004 — Security test execution was mistaken for security coverage

Observed behavior:

- TASK-04A reported 17/17 pgTAP tests PASS and a 100% security-gate result;
- follow-up review still found unverified least-privilege function access, private-schema privileges, SECURITY DEFINER ownership, RBAC uniqueness guarantees, migration-file integrity, and environment-safety concerns.

Required control:

- security gates must be defined by a control manifest;
- test count is evidence, not scope definition;
- every required control must be PASS, FAIL, PARTIAL, UNVERIFIED, or NOT_APPLICABLE;
- PASS is invalid when a required control is PARTIAL or UNVERIFIED.

### REL-005 — Global destructive Docker cleanup escaped project scope

Observed behavior:

- an implementation session executed the equivalent of removing every Docker container on the host;
- the task only required local Proposal Builder Supabase cleanup.

Required control:

- destructive command execution requires a blast-radius assessment;
- project ownership of affected resources must be demonstrable;
- operations affecting unrelated resources must be blocked unless a higher explicit approval authorizes that exact blast radius;
- project-local commands are preferred over daemon-wide cleanup.

### REL-006 — Task completion state was too coarse

Observed behavior:

- a task could be described as Done/Security PASS while still requiring a hardening closeout discovered during review.

Required control:

Task state must track at least:

- implementation status;
- test status;
- specification verification status;
- security review status where applicable;
- technical review status;
- acceptance status;
- Product Owner authorization state.

`Done` is a derived state, never an agent-authored assertion.

---

## 3. Reliability Control Planes

The v0.9 architecture is extended to five cooperating control planes.

### 3.1 Authority Plane

Owns:

- approved requirements;
- approved specification;
- architecture decisions;
- Design Authority;
- approved PLAN;
- stable decision IDs;
- stable acceptance-criterion IDs;
- canonical artifact registry and fingerprints.

### 3.2 Execution Contract Plane

Owns the immutable Development Contract for one bounded increment.

The contract must include:

- objective;
- in-scope work;
- out-of-scope work;
- authoritative source references and fingerprints;
- requirements;
- acceptance criteria;
- architecture/design/security constraints;
- risk classification;
- mandatory verification/review gates;
- execution-safety policy;
- correction policy;
- approval policy.

### 3.3 Execution Safety Plane

Before consequential execution, evaluate:

- environment identity;
- local versus remote mutation;
- resource ownership;
- destructive behavior;
- recoverability;
- blast radius;
- whether the action is authorized by the active Development Contract.

Default invariants:

- project-only resource scope;
- destructive operations require explicit approval;
- remote mutation requires explicit contract authorization;
- global destructive cleanup is blocked when the task is project-local.

### 3.4 Verification Plane

Owns:

- deterministic validators;
- control coverage manifests;
- independent specification verification;
- conditional security/accessibility/design review;
- plan consistency checks;
- architecture drift detection;
- evidence validation.

### 3.5 Evidence & State Plane

Persists:

- contract fingerprints;
- artifact fingerprints;
- Git commit references;
- migration ownership;
- task resource ownership;
- finding IDs;
- finding dispositions;
- approval provenance;
- control coverage;
- verification evidence;
- multidimensional lifecycle state.

---

## 4. Development Contract Safety Extension

ORCH-001 must include execution-safety policy in the contract schema from the start.

Minimum fields:

```json
{
  "executionSafety": {
    "resourceScope": "project-only",
    "destructiveOperations": "explicit-approval",
    "remoteMutation": "explicit-contract"
  }
}
```

These fields do not yet execute shell interception in ORCH-001. They establish the immutable policy boundary that the later execution-safety runtime will enforce.

A later execution role may not broaden these values by editing the contract.

---

## 5. Required Security Control Manifest Model

A future verification phase must support records equivalent to:

```text
SEC-TEN-001  Cross-tenant SELECT isolation         PASS
SEC-TEN-002  Cross-tenant FK integrity             PASS
SEC-RLS-001  RLS enabled                           PASS
SEC-GRT-001  anonymous grants                      PASS
SEC-GRT-002  authenticated mutation grants         PASS
SEC-GRT-003  service-role helper grants            UNVERIFIED
SEC-FUN-001  SECURITY DEFINER search_path          PASS
SEC-FUN-002  SECURITY DEFINER owner                UNVERIFIED
SEC-SCH-001  private schema privilege matrix       UNVERIFIED
SEC-RBAC-001 duplicate membership prevention       UNVERIFIED
```

A security test suite may be green while the security gate remains incomplete.

This distinction is mandatory.

---

## 6. Required Command Safety Model

A future execution-safety module must evaluate commands before destructive execution.

Example blocked command:

```text
docker rm -f $(docker ps -aq)
```

For a project-local task the expected decision is:

```text
Destructive: YES
Project ownership provable: NO
Potential unrelated resources: YES
Blast radius: HOST-WIDE DOCKER
Decision: BLOCK
```

The safety engine must not rely only on a string blacklist. It must support command classification plus declared resource ownership.

High-risk families include at minimum:

- host-wide Docker/container/volume cleanup;
- recursive filesystem deletion outside the project root;
- destructive Git history/worktree commands;
- production/remote database reset or drop;
- infrastructure destroy/delete commands;
- unscoped Kubernetes deletion;
- cloud-resource deletion;
- remote publication/deployment without contract authorization.

---

## 7. Canonical Artifact Mutation Rule

Every authoritative mutation must follow:

```text
READ CANONICAL ARTIFACT
  -> VERIFY CURRENT FINGERPRINT
  -> APPLY REQUESTED DELTA
  -> WRITE
  -> READ BACK
  -> VERIFY EXPECTED DELTA
  -> VERIFY NO UNEXPECTED DELTA
  -> RECORD NEW FINGERPRINT
```

Agent reports are never accepted as proof that the file changed.

---

## 8. Machine-Readable PLAN Requirement

Human-readable Markdown remains required, but PLAN validation must eventually operate on structured task data containing at least:

```json
{
  "id": "TASK-10",
  "dependsOn": ["TASK-06", "TASK-08", "TASK-09"],
  "acceptanceCriteria": ["AC-APP-01", "AC-APP-02", "AC-APP-03"],
  "owns": ["approval_policies", "proposal_approvals"],
  "status": "pending"
}
```

Required deterministic checks:

- task count;
- unique task IDs;
- missing dependency IDs;
- dependency cycles;
- orphan tasks;
- acceptance-criteria coverage;
- required-resource ownership;
- duplicate ownership;
- dependency diagram generation from authoritative dependency data.

---

## 9. Installer Integrity Requirement

Project/global plugin installation must be self-contained for runtime-backed commands.

At minimum verify installed presence and version consistency for:

- commands;
- skills;
- agents;
- hooks;
- runtime;
- scripts;
- schemas used at runtime;
- plugin manifest.

Installer tests must execute runtime-backed commands from an isolated installation without repository fallback.

A future `/dk-doctor` enhancement should report:

```text
Executing CLI version
Installed plugin version
Manifest version
Required command count
Required skill count
Runtime integrity
Schema integrity
Overall result
```

Version or integrity mismatch must fail closed.

---

## 10. Revised Increment Order

The contract-driven orchestration plan remains phased, but the Proposal Builder findings change priority inside the core release.

### ORCH-001 — Development Contract Foundation

Deliver:

- contract schema;
- contract builder;
- stable acceptance-criterion IDs;
- source fingerprinting;
- contract validation;
- persistence;
- deterministic Markdown rendering;
- stale detection;
- execution-safety policy fields;
- isolated packaging/installer availability.

### REL-001 — Execution Safety Foundation

Deliver:

- command risk classification;
- project-root boundary checks;
- resource-scope declarations;
- blast-radius model;
- blocked global destructive command regressions;
- environment identity contract.

### ORCH-002 — Evidence and Control Coverage

Deliver:

- evidence records;
- criterion statuses;
- control manifests;
- PASS-without-required-evidence rejection;
- PASS-with-unverified-required-control rejection.

### ORCH-003 — Independent Verification Rehydration

Deliver the already-approved independent context and no-self-certification model.

### ORCH-004 — Deterministic Acceptance Engine

Use multidimensional state and persisted verification inputs.

### ORCH-005 — Amendment/Reconciliation Engine

Before broad Autopilot integration, implement canonical artifact delta application and read-back verification.

The remaining phases continue from the existing orchestration plan after these reliability foundations are proven.

---

## 11. Mandatory Proposal Builder Regression Fixture

The v0.9 test suite must include a synthetic regression fixture that proves DK detects the following without human discovery:

1. declared task count differs from actual task count;
2. dependency visualization differs from task dependencies;
3. required persistence resource has no owner;
4. one persistence resource has multiple owners;
5. Autopilot amendment does not modify the canonical artifact;
6. authoritative source changes after contract creation;
7. security tests all pass but required security controls remain UNVERIFIED;
8. `service_role` receives an unnecessary helper grant;
9. SECURITY DEFINER owner is not verified;
10. duplicate migration ownership/history is detected;
11. a project-local task attempts host-wide Docker cleanup;
12. an implementation agent attempts to certify its own task accepted;
13. installed plugin lacks required runtime/schema assets;
14. framework/plugin version mismatch is detected.

These are release-regression cases, not optional evaluations.

---

## 12. Release Position

The v0.9 objective is not simply more autonomous coding.

The objective is:

> **Autonomous implementation inside a controlled, inspectable, fail-closed engineering system.**

The Proposal Builder run demonstrated that high-quality agent reasoning is not enough. Reliability comes from separating authority, execution, safety, verification, evidence, and acceptance, then enforcing those boundaries in software.
