# DKF v0.12 T04 — State Engine V2 Hardening Validation

**Date:** 9 October 2026
**Status:** Source implementation and cross-platform CI VERIFIED; deterministic T04 review/acceptance evidence still required for promotion.
**Branch:** fix/v0.12-t04-state-engine-hardening
**Stacked PR:** https://github.com/eybersjp/development-kit/pull/70
**Cumulative CI PR:** https://github.com/eybersjp/development-kit/pull/69 (draft; do not merge as replacement for the approved sequence)
**CI run:** https://github.com/eybersjp/development-kit/actions/runs/37963827500

## Corrected engineering risks

- **AUD-05 — event storage:** Canonical events are now physically appended rather than rewriting all prior bytes. An fsynced pending-commit journal records the expected prefix hash and complete suffix before appending. Verified incomplete suffixes can be repaired; conflicting suffixes fail closed. On POSIX, relevant rename/unlink directory metadata is also fsynced.
- **AUD-06 — multi-process coordination:** The project-local lock spans current-state reads, sequence allocation, event construction and write. Owners are recorded by PID and hostname. A live local lock is not stolen merely because it is aged; a provably dead local owner is recoverable. Remote/unknown ownership fails closed. This is not a distributed multi-host lock.
- **AUD-07 — backup restore:** Full destination preflight checks parent directories and final files, rejects symlinks and junctions, and uses exclusive/no-follow file opens where supported. Legacy backups and originals remain retained.
- **Additional protection:** Canonical State Engine internal files may not themselves be symlinks/nonregular files. Existing Autopilot same-revision transition behavior was preserved after an initial regression was corrected.

## Reproduction and verification

Thirteen new T04-H01..H13 regression tests pass on Ubuntu and Windows: physical append file identity, aged live lock, four-process/48-event contention, interrupted append recovery, restore directory and file symlinks, conflicting pending suffix, dead-owner recovery and canonical-file symlink rejection.

Additional test-driven cases are **H10** (missing terminal newline), **H11** (stale-lock recheck race), **H12** (legitimate concurrent snapshot advance) and **H13** (hard-linked restore destination). The unfixed earlier heads failed as expected: CI runs `37963478049` (H10/H11) and `37963732490` (H12/H13). All four new cases subsequently passed on both platforms.

**Independent-review status:** the initial GitHub Codex review on commit `949ec8c` identified H10/H11. Both are corrected with reproducing tests. A fresh independent code/security review of the updated source was requested on PR #70. Successful CI is not a deterministic DKF `ACCEPTED` verdict; formal review and acceptance must still be recorded before merge.
The cumulative full CI run 37963827500 passed every required step on Ubuntu and Windows, including T04 focused tests and the exact npm run release:validate command. No skipped test was reported.

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
