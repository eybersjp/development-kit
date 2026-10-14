# Development Kit v0.13.0 — State Engine V2 Specification

**Status:** Implementation authority for v0.13 T04  
**Date:** 14 October 2026  
**Base release:** Development Kit v0.12.1  
**Priority:** P0 / first v0.13 increment  
**Deferred source:** DKF120-T04 from the v0.12 Scale, Context & Iteration PLAN  
**Binding release decision:** Issue #82  
**Blocking Windows recovery issue:** Issue #73

## 1. Objective

Complete and independently accept the State Engine V2 work deliberately deferred from v0.12.0, while preserving all released v0.12.1 public commands, lifecycle behavior, gate semantics, verification extensions, discovery/re-entry behavior, Control Center projections and stable-state compatibility.

State Engine V2 SHALL become the canonical persistent development-state authority after a verified migration/cutover.

It SHALL NOT become application, business or domain state.

## 2. General-purpose architecture rule

DKF core stores generic control-plane state only.

The implementation MUST NOT introduce:

- application-specific entities;
- industry-specific lifecycle policy;
- provider-specific state semantics;
- project business-status interpretation;
- target-name-based behavior.

Project/domain state remains outside canonical DKF development-state authority unless a generic extension explicitly persists opaque project-owned data under an approved contract.

## 3. Required canonical layout

State Engine V2 uses:

```text
.development-kit/state/
  events.jsonl
  snapshot.json
  index.db
  schema.json
  pending-commit.json       # recovery aid, not the sole durability witness
  state.lock
  migration-complete.json
  legacy-backup.json
```

Authority order:

1. `events.jsonl` — canonical append-only development-state history.
2. `snapshot.json` — materialized current view, rebuildable.
3. `index.db` — disposable/rebuildable acceleration index.
4. Legacy state — recovery authority only until verified migration/cutover.
5. `pending-commit.json` — recovery intent/witness; absence alone MUST NOT make a torn canonical ledger unrecoverable.

SQLite MUST NOT be the sole source of truth.

## 4. Acceptance criteria restored for v0.13

The v0.12 release explicitly deferred these criteria; v0.13 reactivates them unchanged in intent.

### DKF-120-AC-012
State history is append-only and canonical, with deterministic event ordering and integrity chaining.

### DKF-120-AC-013
Current state is materialized from canonical history and can be rebuilt deterministically.

### DKF-120-AC-014
The acceleration index can be deleted/corrupted and rebuilt without changing semantic state.

### DKF-120-AC-015
Supported legacy state migrates idempotently, fail-closed, recoverably and semantically equivalently before cutover.

### DKF-120-AC-034
Canonical transition-state file growth is bounded and no longer proportional to normal state-transition count.

## 5. v0.13 compatibility requirements

### INV-130-001 — v0.12.1 behavior preservation
All released v0.12.1 commands and included T01–T03/T05–T10 behavior remain supported.

### INV-130-002 — no silent cutover
A project with legacy state MUST NOT switch to V2 until migration has succeeded and a migration-complete witness exists.

### INV-130-003 — legacy recovery retained
Legacy state and backup material MUST remain recoverable until verified cutover and explicit later cleanup policy.

### INV-130-004 — fresh-project V2
A fresh project with no legacy persistent workflow state uses State Engine V2 directly.

### INV-130-005 — acceptance semantics unchanged
Changing persistence authority MUST NOT weaken Development Contracts, source staleness, gate profiles, verification isolation, reviewer requirements, human approval or deterministic acceptance.

### INV-130-006 — current feature integration
The v0.12.1 Lifecycle Instance, discovery/re-entry, gate-profile, verification-extension, complexity and Control Center code must continue to operate against their released interfaces. Persistence adapters may change underneath them; feature semantics may not silently change.

## 6. Runtime commit durability contract

### 6.1 Canonical event append

Normal mutation is:

```text
lock
  -> recover any prior interrupted commit
  -> validate canonical prefix
  -> create pending recovery intent
  -> append event suffix physically
  -> flush canonical ledger
  -> materialize snapshot/index
  -> verify derived state against canonical history
  -> acknowledge/retire pending intent
unlock
```

A normal append MUST NOT rewrite the entire historical ledger.

### 6.2 Pending journal is not the only witness

Issue #73 identified that a Windows namespace update for `pending-commit.json` cannot be treated as universally power-loss durable merely because a directory flush syscall returns successfully.

Therefore v0.13 SHALL additionally make the canonical ledger self-recovering for an unambiguous torn **trailing append** even when the pending journal is absent.

Allowed automatic repair:

- incomplete/invalid final byte suffix after the last complete newline;
- a complete final JSON event whose canonical bytes are present but final newline is missing, provided event schema/hash-chain validation succeeds;
- only the final append boundary.

Automatic repair MUST NOT:

- discard a complete but hash-invalid event;
- repair corruption in the middle of history;
- accept sequence gaps;
- accept previous-hash mismatch;
- rewrite an arbitrary historical prefix.

Any ambiguous corruption fails closed.

### 6.3 Windows persistence statement

DKF distinguishes:

1. documented OS/API semantics;
2. deterministic fault-injection behavior;
3. actual power-loss/hardware persistence evidence.

A successful `FlushFileBuffers`, `fsyncSync`, or `MoveFileExW(MOVEFILE_WRITE_THROUGH)` call MUST NOT be described as universal hardware power-loss proof.

Microsoft documents that:

- directory handles require `CreateFile(... FILE_FLAG_BACKUP_SEMANTICS ...)`;
- `FILE_FLAG_WRITE_THROUGH` requests persistent-media write-through and causes NTFS metadata changes such as rename processing to be flushed, subject to hardware support;
- `FlushFileBuffers` flushes buffered information for the supplied handle/device;
- `MOVEFILE_WRITE_THROUGH` explicitly guarantees flushing for copy/delete moves, and MUST NOT be over-generalized as proof of every same-volume directory rename transaction.

v0.13 tests and documentation must state these limits.

## 7. Windows legacy-backup restore/recovery contract

Full Windows restore/recovery support remains required by the Product Owner decision recorded under Issue #73.

A blanket Windows disable is prohibited.

### 7.1 Supported transaction model

Restore uses a stable sibling recovery anchor outside the directory being replaced.

The transaction is monotonic:

```text
PREPARED
ORIGINAL_DISPLACED
CANDIDATE_PUBLISHED
PROMOTION_ACKNOWLEDGED
CLEANUP_SAFE
```

Each phase has authenticated path/inode/content witnesses.

The durable recovery anchor MUST NOT be deleted as the indication that a restore succeeded.

Instead:

- append/replace the transaction state with an explicit terminal phase;
- retain enough witness material for restart reconciliation;
- cleanup of old transaction records is a separate bounded maintenance operation, not part of the critical promotion acknowledgement.

### 7.2 Crash ambiguity rule

After interruption, recovery inspects:

- recovery transaction state;
- target root identity;
- staged candidate identity;
- displaced original identity;
- fingerprints;
- filesystem/volume support information.

It then either:

- deterministically resumes;
- deterministically rolls back;
- reports completed;
- or fails closed with all recoverable assets preserved.

Absence of one directory entry is never sufficient evidence that no transaction existed.

### 7.3 Windows supported-storage contract

For v0.13 deterministic automatic restore, DKF SHALL positively identify a locally supported Windows persistence environment before destructive root mutation.

Initial supported Windows automatic durability profile:

- local Windows filesystem;
- NTFS;
- non-network path;
- native write-through/flush helper available and successfully probed.

Other Windows storage profiles MUST fail closed **for the attempted destructive transition**, preserve recovery assets and provide operator recovery evidence. This is not a blanket disable of Windows restore APIs.

Support may be broadened only with source-backed OS/filesystem evidence and tests.

### 7.4 Required Issue #73 fixtures

The final suite MUST include Windows-specific, non-skipped coverage equivalent to:

- W73-01 recovery-intent publication boundary;
- W73-02 original displacement boundary;
- W73-03 candidate publication boundary;
- W73-04 promotion acknowledgement boundary;
- W73-05 displaced-original cleanup boundary;
- W73-06 interrupted rollback and repeat recovery;
- W73-07 invalid/tampered witness;
- W73-08 unsupported persistence profile fails safely before destructive mutation;
- W73-09 pre-existing interrupted restore remains recoverable;
- W73-10 normal full Windows restore succeeds and preserves specified metadata/integrity.

Fault injection is evidence of ordering/error safety, not physical power-cut certification.

## 8. Migration contract

Migration MUST:

- inventory supported legacy state;
- fingerprint source state before mutation;
- create a complete backup bundle;
- import canonical V2 entities/events;
- verify semantic equivalence against legacy source;
- create migration-complete witness only after verification;
- be idempotent;
- refuse changed/corrupt source;
- preserve legacy source until verified cutover;
- support explicit offline backup restoration.

v0.12.1 feature state introduced after the original T04 design MUST be inventoried and classified before cutover. Evidence artifacts and disposable caches are not automatically promoted to canonical state.

## 9. Locking and concurrency

Within one local workspace:

- one writer lock protects event sequencing and commit publication;
- stale locks may be reclaimed only when ownership is provably dead;
- a live local PID lock is never stolen due to age alone;
- multiple concurrent writers serialize deterministically.

Distributed cross-host locking is not a v0.13 guarantee unless separately specified.

Same-account hostile concurrent mutation remains the separate threat-model issue recorded as Issue #72 and is not silently folded into this acceptance.

## 10. Security invariants

- no symlink/junction/path traversal may redirect state or restore writes outside declared boundaries;
- internal canonical files must be ordinary files with expected link/inode properties;
- restore destination aliases/case collisions fail closed;
- unexpected filesystem objects fail closed;
- recovery never destroys the last authenticated recoverable copy;
- no PowerShell string interpolation of untrusted path data;
- native helper failure propagates as a typed failure;
- no silent fallback from a required Windows durability primitive to plain `fs.renameSync`.

## 11. Required independent gates

T04 is risk level 3.

Required final gates:

- specification verification;
- complete automated tests;
- Ubuntu exact-head CI;
- Windows exact-head CI;
- independent code review;
- independent architecture review;
- independent security review;
- security control-domain PASS;
- all in-scope P1/P2 review threads resolved;
- deterministic acceptance receipt bound to the exact reviewed source SHA.

Test success alone is not acceptance.

## 12. Implementation strategy from v0.12.1

The old v0.12 T04 branches/PRs are evidence sources only.

v0.13 implementation MUST start from current `main` and selectively port/reconcile:

- State Engine V2 canonical ledger/snapshot/index;
- legacy migration/backup/restore;
- Autopilot state-store adapter;
- orchestration-run state adapter;
- schemas and tests;
- Windows durability helper/protocol;
- review/acceptance tooling.

It MUST preserve later v0.12.1 changes such as Gate Profiles and Verification Extension acceptance behavior.

No force merge or wholesale replacement of current main files with old T04 versions is permitted.

## 13. Release boundary

Completion of this T04 increment authorizes only progression toward v0.13.0 release integration.

It does not itself authorize:

- publishing v0.13.0;
- deleting legacy state;
- dropping Windows support;
- closing Issue #73 before exact-source independent acceptance;
- adding unrelated v0.13 features.
