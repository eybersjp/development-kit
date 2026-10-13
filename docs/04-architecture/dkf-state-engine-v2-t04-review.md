# DKF120-T04 — State Engine V2 Review

**Review status:** PASS  
**Date:** 7 October 2026  
**Increment:** DKF120-T04 — State Engine V2  
**Branch:** `feature/v0.12-state-engine-v2`  
**Reviewed implementation head:** `e3e4b16e372b40042398cfcf210f471e4f762b1b`  
**Implementation validation run:** `37678375215`

## 1. Review gates

T04 is risk level 3 because persistent-state migration and recovery affect DKF control-plane authority.

Derived gates:

- specification verification;
- tests;
- migration verification;
- code-reviewer;
- architecture-reviewer;
- security-reviewer;
- security control domain.

No consequential-action human approval is derived at risk level 3.

## 2. Code review

**Verdict: PASS**

The implementation adds a generic State Engine core and keeps legacy-format knowledge in a separate migration adapter.

Primary production changes:

- `runtime/orchestration/state-engine-v2.mjs`;
- `runtime/orchestration/state-engine-migration.mjs`;
- Autopilot state-store cutover integration;
- orchestration-run state cutover integration;
- State Engine event/snapshot/index schemas;
- T04 migration and integrity tests.

No T05+ capability is implemented.

### Correction history

#### REV-T04-001 — Fresh-state regressions still asserted legacy pointer files

**Status:** Corrected

The v0.7.1 and Autopilot regression suites contained storage-shape assertions that a fresh project must create the legacy `autopilot/state/current.json` pointer.

T04 intentionally changes the persistence implementation while preserving the behavioral invariant: lifecycle state must be durably persisted before progress is reported.

The regressions now verify durable State Engine V2 history/snapshot for fresh projects while migration tests separately preserve legacy compatibility.

#### REV-T04-002 — Historical Phase 1 baseline accidentally followed the new live backend

**Status:** Corrected

The Phase 1 baseline originally recreated the legacy 26-revision fixture by calling today's `saveStateRevision()`.

After T04, that API correctly uses V2 for fresh projects, making the historical baseline self-modifying.

The baseline now constructs the historical legacy file layout directly, preserving the pre-v0.12 measurement of 26 revision files plus one current pointer.

#### REV-T04-003 — Canonical tail truncation could be silently rebuilt downward

**Severity:** Major integrity risk  
**Status:** Corrected

A valid previously materialized snapshot can witness that canonical history once reached a later sequence/hash.

If `events.jsonl` is later truncated behind that witness, `loadStateSnapshot()` now fails closed rather than replacing the later snapshot with older reconstructed state.

Interior mutation, insertion, deletion, and reordering remain protected by sequence/hash-chain validation.

#### REV-T04-004 — State-root realpath escape

**Severity:** Security hardening  
**Status:** Corrected

Lexical path checks alone did not prevent `.development-kit/state` from being a symlink/junction to a directory outside the project.

State Engine read/write paths now realpath-check the State Engine root and reject escape outside the project boundary.

#### REV-T04-005 — Partial migration could have triggered premature V2 cutover

**Severity:** Critical control-plane risk during review  
**Status:** Corrected

Imported V2 entities are not sufficient to switch an existing legacy project.

Legacy state remains canonical until a verified `MIGRATION_COMPLETED` event records semantic equivalence.

This rule is enforced for Autopilot reads/recovery/writes and orchestration-run reads/writes.

Interrupted migration can therefore leave resumable imported events without changing active state authority.

#### REV-T04-006 — Re-running migration after legitimate V2 progress

**Severity:** Major idempotence issue  
**Status:** Corrected

After migration, V2 state may legitimately advance beyond the old legacy endpoint.

Repeated migration now recognizes the recorded completed source fingerprint, validates State Engine integrity and the retained backup, and returns an idempotent no-op without demanding that current V2 state still equal the historical legacy endpoint.

#### REV-T04-007 — Legacy chain gaps and anchor mismatch

**Severity:** Major auditability hardening  
**Status:** Corrected

Migration now rejects missing Autopilot revisions, workflow identity changes inside an Autopilot revision chain, missing orchestration revisions, and orchestration revision 1 that differs from its immutable run manifest.

Legacy audit history cannot silently compress around missing source revisions.

#### REV-T04-008 — Same-version schema tampering could be under-detected

**Severity:** Security hardening  
**Status:** Corrected

`schema.json` must now exactly match the runtime State Engine schema contract.

An incomplete V2 layout or a same-version tampered schema fails closed on read.

## 3. Architecture review

**Verdict: PASS**

### 3.1 Canonical authority

T04 implements the project-local State Engine area:

- `events.jsonl` — canonical runtime history;
- `snapshot.json` — derived current-state view;
- `index.db` — disposable/rebuildable acceleration index;
- `schema.json` — State Engine schema/authority descriptor;
- `legacy-backup.json` — migration recovery bundle when legacy migration occurs.

The snapshot and index can be reconstructed from canonical history.

The index cannot authorize state changes or replace the event ledger.

### 3.2 Portable index choice

The current `index.db` implementation is a deterministic portable JSON-encoded acceleration artifact, not SQLite.

This is deliberate for T04: DKF's public Node >=18 compatibility is preserved, no Node-22-only SQLite runtime dependency is introduced, and the index remains disposable.

A later index adapter may use SQLite without changing canonical state authority.

### 3.3 Generic entity model

State Engine core understands generic entity type, entity ID, state revision, lifecycle/task/contract/run references, state patch operations, and generic metadata events.

It contains no application or industry business-state semantics.

Autopilot and orchestration formats are integration/migration adapters around the generic core.

### 3.4 Event-backed state

Initial entity state is stored once.

Subsequent changes are represented as deterministic path-based set/delete operations rather than another full canonical snapshot file.

Events carry monotonic sequence, deterministic event ID, timestamp, actor class, entity references, event type, payload, previous-event hash, and event hash.

### 3.5 Crash/recovery model

Canonical event writes use temporary file -> fsync -> atomic rename.

A short State Engine lock prevents overlapping local commits.

If failure occurs before canonical rename, the existing ledger remains authoritative. If failure occurs after ledger commit but before snapshot/index completion, derived state rebuilds from events. Orphan temporary files do not advance canonical state.

## 4. Migration review

**Verdict: PASS**

Migration validates all detected supported legacy inputs before State Engine creation/cutover.

Supported legacy inputs include Autopilot revision chains/current pointer and orchestration manifest/revisions/current pointer/final state where present.

Migration then creates a fingerprinted recoverable backup bundle, imports validated history, reconstructs V2 current state, verifies semantic equivalence, appends `MIGRATION_COMPLETED` only after equivalence, and verifies State Engine integrity.

Repeated execution is idempotent. Partial execution remains recoverable and does not trigger cutover. Legacy state is not deleted by T04.

## 5. Acceptance-semantics review

**Verdict: PASS**

The orchestration migration fixture begins with `state=ACCEPTED`, `acceptanceState=ACCEPTED`, and `verificationVerdict=PASS`.

After migration, V2 reproduces those same values.

T04 changes persistence, not acceptance authority.

## 6. Security review

**Verdict: PASS**

Reviewed threats include event mutation/insertion/reordering/deletion, canonical-tail loss, path escape, schema tampering, partial migration, corrupt legacy input, backup mismatch, index authority confusion, and premature cutover.

Controls include monotonic sequence, chained SHA-256 hashes, snapshot sequence/hash integrity witness, exact schema contract, project-root realpath confinement, short write lock, atomic canonical replacement, derived-state rebuild, fail-closed legacy validation, fingerprinted recovery bundle, verified migration-completion cutover, and semantic-equivalence verification.

Unresolved security findings: none.

## 7. Security control-domain review

**Verdict: PASS**

State authority cannot move from legacy to V2 merely because V2 files or partially imported entities exist.

The cutover condition is a completed migration record produced only after semantic-equivalence verification.

Corrupt or incomplete source state blocks migration. Corrupt or tampered State Engine authority blocks reads/integrity verification instead of silently falling back.

## 8. State micro-file result

Representative Phase 1 legacy transition shape is 27 files: 26 revision snapshots plus one current pointer.

T04 active canonical/recovery representation is 5 State Engine files: `events.jsonl`, `snapshot.json`, `index.db`, `schema.json`, and `legacy-backup.json`.

Measured active canonical/recovery file-count reduction:

**27 -> 5 = 81.48%**

This exceeds the >=80% v0.12 engineering objective for transition-generated state micro-file count.

### Recovery-retention caveat

T04 deliberately retains all 27 legacy source files until a later explicitly governed cleanup/cutover decision.

Therefore, during the recovery-retention window, physical disk file count is 27 retained legacy files + 5 State Engine files = 32 files.

The 81.48% result describes the new active canonical/recovery state representation, not total temporary on-disk file count while recovery originals are retained.

## 9. Verification evidence

Implementation validation run `37678375215`:

- Ubuntu: PASS;
- Windows: PASS;
- focused T04 gate: PASS on both;
- exact `release:validate`: PASS on both.

Focused T04 suite:

- tests: 22;
- pass: 22;
- fail: 0.

## 10. General-purpose framework check

**PASS**

State Engine V2 is project-local, host-neutral, provider-neutral, repository-topology-neutral, and application-domain-neutral.

No application-specific state type is required by core.

## 11. Outstanding findings

Critical: **0**  
Major: **0**  
Unresolved minor: **0**

## 12. Review decision

**PASS**

DKF120-T04 is technically suitable for acceptance and progression to DKF120-T05.
