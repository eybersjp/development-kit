# DKF v0.12 T04 — State Engine V2 Hardening Validation

**Date:** 9 October 2026
**Status:** Engineering remediation implemented; updated CI and independent risk-3 review must pass before acceptance.
**Branch:** fix/v0.12-t04-state-engine-hardening
**Stacked PR:** https://github.com/eybersjp/development-kit/pull/70
**Cumulative CI PR:** https://github.com/eybersjp/development-kit/pull/69 (draft; do not merge as replacement for the approved sequence)
**Confirmed cross-platform CI baseline:** https://github.com/eybersjp/development-kit/actions/runs/37965890821 (H01–H19; final H20/H21 revalidation at branch checks)

## Corrected engineering risks

- **AUD-05 — event storage:** Canonical events are now physically appended rather than rewriting all prior bytes. An fsynced pending-commit journal records the expected prefix hash and complete suffix before appending. Verified incomplete suffixes can be repaired; conflicting suffixes fail closed. On POSIX, relevant rename/unlink directory metadata is also fsynced.
- **AUD-06 — multi-process coordination:** The project-local lock spans current-state reads, sequence allocation, event construction and write. Owners are recorded by PID and hostname. A live local lock is not stolen merely because it is aged; a provably dead local owner is recoverable. Remote/unknown ownership fails closed. This is not a distributed multi-host lock.
- **AUD-07 — backup restore:** Read-only target preflight rejects symlinks, junctions and multiply-linked files. Full restore is assembled in a private sibling staging directory, fingerprint-verified, then promoted by renaming the destination root. No restored content is opened through mutable pre-existing target parents or final hard links. Original target tree is moved aside and rolled back on a failed promotion where possible; retained legacy source and backups are never removed.
- **Additional protection:** Canonical State Engine internal files may not be symlinks, multiply-linked inodes or nonregular files. Lock reclamation is serialized under an exclusive .reclaim directory; a stopped process during reclamation can leave a guard that must be inspected before manual recovery. The pending journal is cleared only after snapshot and index have been reconstructed and fsynced; stale materialized views are replayed under the State Engine writer lock. Existing Autopilot same-revision transition behavior was preserved after an initial regression was corrected.

## Reproduction and verification

Twenty-three T04-H01..H23 regression cases verify on Ubuntu and Windows: physical append file identity, aged live lock, four-process/48-event contention, interrupted append recovery, restore directory and file symlinks, conflicting pending suffix, dead-owner recovery and canonical-file symlink rejection.

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
