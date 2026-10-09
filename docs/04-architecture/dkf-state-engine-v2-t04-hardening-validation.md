# DKF v0.12 T04 — State Engine V2 Hardening Validation

**Date:** 9 October 2026
**Status:** Engineering remediation implemented; updated CI and independent risk-3 review must pass before acceptance.
**Branch:** fix/v0.12-t04-state-engine-hardening
**Stacked PR:** https://github.com/eybersjp/development-kit/pull/70
**Cumulative CI PR:** https://github.com/eybersjp/development-kit/pull/69 (draft; do not merge as replacement for the approved sequence)
**Confirmed cross-platform code CI baseline:** https://github.com/eybersjp/development-kit/actions/runs/37972680014 (H01–H28; final stage-fsync/documentation review requires latest branch checks)

## Corrected engineering risks

- **AUD-05 — event storage:** Canonical events are now physically appended rather than rewriting all prior bytes. An fsynced pending-commit journal records the expected prefix hash and complete suffix before appending. Verified incomplete suffixes can be repaired; conflicting suffixes fail closed. On POSIX, relevant rename/unlink directory metadata is also fsynced.
- **AUD-06 — multi-process coordination:** The project-local lock spans current-state reads, sequence allocation, event construction and write. Owners are recorded by PID and hostname. A live local lock is not stolen merely because it is aged; a provably dead local owner is recoverable. Remote/unknown ownership fails closed. This is not a distributed multi-host lock.
- **AUD-07 — backup restore:** Read-only target preflight rejects symlinks, junctions and multiply-linked files. Full restore is assembled in a private sibling staging directory, fingerprint-verified, then promoted by renaming the destination root. No restored content is opened through mutable pre-existing target parents or final hard links. Original target tree is moved aside and rolled back on a failed promotion where possible; retained legacy source and backups are never removed.
- **Additional protection:** Canonical State Engine internal files may not be symlinks, multiply-linked inodes or nonregular files. Lock reclamation is serialized under an exclusive .reclaim directory; a stopped process during reclamation can leave a guard that must be inspected before manual recovery. The pending journal is cleared only after snapshot and index have been reconstructed and fsynced; stale materialized views are replayed under the State Engine writer lock. Existing Autopilot same-revision transition behavior was preserved after an initial regression was corrected.

## Reproduction and verification

Thirty-one T04-H01..H31 regression cases verify on Ubuntu and Windows: physical append file identity, aged live lock, four-process/48-event contention, interrupted append recovery, restore directory and file symlinks, conflicting pending suffix, dead-owner recovery and canonical-file symlink rejection.

Additional test-driven cases are **H10** (missing terminal newline), **H11** (stale-lock recheck race), **H12** (legitimate concurrent snapshot advance) and **H13** (hard-linked restore destination). The unfixed earlier heads failed as expected: CI runs `37963478049` (H10/H11) and `37963732490` (H12/H13). All four new cases subsequently passed on both platforms.

**Independent-review status:** the initial GitHub Codex review on commit `949ec8c` identified H10/H11. Both are corrected with reproducing tests. A fresh independent code/security review of the updated source was requested on PR #70. Successful CI is not a deterministic DKF `ACCEPTED` verdict; formal review and acceptance must still be recorded before merge.
The previous cumulative CI run 37965890821 passed every required step on Ubuntu and Windows, including T04 focused tests and the exact npm run release:validate command. No skipped test was reported.

## 300-transition endurance fixture

| Metric | Ubuntu / Node 22.23.3 | Windows / Node 22.23.3 |
|---|---:|---:|
| Canonical transitions | 300 | 300 |
| Write workload | 6,068 ms | 16,417 ms |
| Full read/integrity verify | 54 ms | 48 ms |
| Canonical ledger | 189,651 bytes | 189,651 bytes |
| Historical full-rewrite byte model | 28,479,948 bytes | 28,479,948 bytes |
| Modeled write traffic avoided | 99.33% | 99.33% |
| Integrity | PASS | PASS |

**Measurement limitation:** Historical full-rewrite traffic is modeled from observed event file lengths, not an experimentally timed legacy run. CPU parsing and full-history replay remain O(history) per read/verification; the 300-event fixture does not prove unlimited-scale latency.

## Authority and release boundaries

Original T04 contract and acceptance criteria remain unchanged; no T05+ scope, version bump, legacy file deletion, tag or release occurred. Main remains on published 0.11.2. Independently execute the existing risk-3 code/architecture/security review and capture persisted runtime acceptance evidence before promoting/merging the stacked T04 fix. Re-run final integration checks after any source change. T10 still owns release-wide performance objectives.

## Further P1/P2 review corrections — H14 to H21

- **H14:** Windows transient state.lock creation sharing violations retry within the lock timeout, without stealing a lock (Windows-only fixture).
- **H15:** four independent processes contend to recover one stale owner; exclusive reclamation guard prevents deletion of a subsequently acquired live lock.
- **H16:** replacing canonical events.jsonl with an external hard link is refused before append, preserving the outside inode.
- **H17:** interrupted journal recovery rebuilds and persists snapshot/index before deleting the commit marker; immediate strict integrity verification succeeds.
- **H18:** a writer interleaving with an older reader cannot have its derived snapshot/index rolled back by stale replay.
- **H19:** switching a legacy restore destination to an external hard link at the former open point cannot modify outside content; staged restore avoids target-path opens.
- **H20:** restore preflight does not create or mutate directories in the target tree before stage promotion.
- **H21:** staged restore preserves support for a previously nonexistent target root with an existing parent.

The review that identified H15–H19 was recorded on PR #70 against head `ffe49ffb60`. Its five associated threads must be resolved only after validating the revised code and obtaining an independent current-head review. Passing the CI suite does not supersede those risk-3 approval gates. Restore is an offline maintenance operation: protect target-parent access and avoid other writers to the recovery directory while staging and promoting. Staging relies on same-filesystem sibling directory renames. Source/workflow authority, the published version (0.11.2), and the prohibition on merging validation PR #69 remain unchanged.

## Third independent-review correction — H22 and H23

Code review of `cf504f7` identified two additional P1 issues, reproduced before repair:

- **H22 — event symlink substitution at append/open:** pre-fix run `37967267072` showed an external sentinel file receiving appended canonical JSON after a symlink was swapped into the event pathname. The fixed append opens with `O_NOFOLLOW` where supported, verifies `lstat()` and `fstat()` refer to the same one-link inode, and checks the opened descriptor against the exact canonical inode and byte length witnessed before the commit was prepared. The write is rejected before modifying external content.
- **H23 — root metadata preservation:** pre-fix run `37967284714` showed an existing `0755` restore root becoming `0700`. The corrected staged restore restores the original directory's mode and timestamps before promotion, and on POSIX preserves UID/GID or fails closed when ownership cannot be set. The existing-stage private mode is retained for previously absent roots.

**Verification authority:** previous H01–H21 source passed Ubuntu and Windows CI `37966537455`, including exact release:validate. The final H01–H23 implementation and documentation require CI at the latest branch head. This is correction evidence, not an independent final acceptance decision.

**Metadata limitation:** generic Node.js APIs cannot establish full equivalence of every filesystem ACL/security-descriptor property (especially custom Windows ACLs). Restoring into an existing root with nonstandard ACLs requires separately verified host-native permission preservation before declaring the backup operation complete. No claim of universal Windows ACL preservation is made.

## Fourth hardening increment — H24 to H28 and recovery trust boundary

- **H24:** `restoreLegacyBackup` rejects callers that have not explicitly attested a trusted exclusive offline workspace; no target mutation is permitted without `confirmOffline:true`.
- **H25:** a failed promotion leaves a durable transaction journal. A new restore is refused until `recoverLegacyRestore({targetRoot,confirmOffline:true})` validates original/candidate device/inode witnesses and resolves the transaction.
- **H26:** an abandoned `state.lock.reclaim` guard from a provably dead owner can be removed only by explicit offline recovery, after a 60-second inactivity threshold and local process liveness checks.
- **H27:** orphan recovery refuses a live guard owner even when the guard is old.
- **H28:** a child-process termination immediately after moving the target root leaves a journal permitting exact original-tree restoration without running the original process's `finally`.

The crash journal uses BigInt-backed decimal device/inode witnesses for portable Windows/Unix verification. The staged restore tree is fsynced before journal publication; POSIX directory entries are synced at transaction boundaries. The previous full cross-platform run `37972680014` passed at the journal-identity revision; latest fsync/documentation changes require current-head CI.

**Security boundary decision pending independent review:** see [Offline Recovery Boundary](dkf-state-engine-v2-offline-recovery-boundary.md). The restore capability is *operator-initiated offline maintenance only*. A malicious concurrent process with the same OS credentials cannot be isolated by cross-platform Node.js pathname guards and must be excluded operationally. The `confirmOffline` flag is an attestation, **not technical evidence** that the host is safe. If the environment is not exclusively controlled, restoration is unsupported and must not run. This scope must be independently accepted rather than silently dismissing security findings.

**Review status:** PR #70 remains unmerged; Issue #71 tracks the remaining recovery and isolation contract. Source implementation and targeted CI passing do not on their own create a valid risk-3 code/architecture/security review or persisted deterministic ACCEPTED state. Published version remains v0.11.2.

## Fifth independent-review corrections — H29 to H31

Independent review at source `c80dc253eadf6676fa195628aebd10cb3f82dae9` identified:

- **P1 runtime pending-commit path race:** after validating a canonical ledger prefix, pathname `truncateSync` could shorten an external hardlinked inode swapped into `events.jsonl`. H29 captured the external-file modification on the unfixed source (GitHub Actions `37974023511`, Windows and Ubuntu). The fixed recovery opens a no-follow, inode-verified and single-link FD; validates all bytes and performs `ftruncateSync`, positioned suffix writes and `fsyncSync` on that same descriptor.
- **P1 recursive staged ownership:** staging an existing root copied unrelated files under the maintenance identity, potentially losing access for service accounts. A metadata inventory is collected before copying, and post-order replay restores descendant UID/GID, modes and timestamps on POSIX (including symlink ownership without dereferencing symlink targets). H30 checks descendant identity; CI runs the same fixture with an alternate source owner under a restricted internal-branch Ubuntu job.
- **P2 timestamp drift:** scanning the stage after `utimesSync` advanced the restored root atime. The stage sync precedes post-order metadata replay. H31 uses a historical 2001 atime/mtime fixture.

**Security caveat:** The supported restoration trust boundary remains *explicit, operator-controlled offline maintenance* (see the separate recovery boundary contract). It does not claim immunity to a concurrently malicious same-UID process, and this environmental condition must be independently approved. The automatic runtime journal-recovery path does **not** rely on the offline attestation and must satisfy stronger descriptor-bound checks.

**Acceptance gate:** CI/review must be repeated on the final documented head. The H01–H31 implementation is not deemed ACCEPTED until risk-3 code, architecture and security review findings are closed by evidence, deterministic acceptance is persisted, and PR #70 is merged only into its approved T04 base. Do not merge cumulative PR #69 or publish v0.12.0.

## Sixth review cycle — H32–H35 and authenticated acceptance

Independent PR #70 reviews discovered that copying could rewrite unrelated relative symlinks, duplicate backup entries could overwrite one target, platform case sensitivity differed, and malformed UTF-16 surrogate strings could map to the same filesystem filename.

- **H32:** stage copy now uses verbatim symlink semantics to preserve unrelated relative targets.
- **H33:** duplicate normalized restore destinations are rejected before stage mutation.
- **H34:** normalized case/Unicode alias detection is conservative on every supported filesystem.
- **H35:** reject unpaired UTF-16 surrogate paths before filesystem encoding.
- **Authority Graph:** ten unchanged approved T04 requirements are explicitly mapped to the existing five acceptance criteria, with negative tests for missing or unknown edges.
- **Risk-3 review:** the former acceptance driver constructed synthetic reviewer PASS records and hardcoded an older commit. That verdict is invalid as independent approval. The new gate requires three separate, externally authenticated role-specific reviews, binds Git blob hashes and modes for the entire checked-out tree to the reviewed commit, and permits only the receipts document to change after review.
- **Platform gate:** the acceptance job depends on success of both Windows and Ubuntu validation jobs, not on one matrix leg.
- **Fail-closed behavior:** missing, stale, inauthentic or finding-bearing review evidence never grants T04 acceptance.

**Promotion boundary:** A persisted deterministic ACCEPTED result with zero runtime blockers, authenticated code/architecture/security reviewer roles and full matrix success is required. Earlier synthetic acceptance outputs are explicitly superseded. No main-branch merge, release or T05 authority is implied.
