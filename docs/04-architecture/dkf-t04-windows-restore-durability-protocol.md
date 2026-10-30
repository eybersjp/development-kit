# DKF120-T04 — Windows restore and State Engine durability protocol

**Status:** Proposed engineering protocol; **not** an independently approved Windows power-loss guarantee.
**Decision authority:** The Product Owner retains full Windows legacy-backup restore/recovery support as mandatory for the **v0.13.0 P0** T04 feature (Issues #82/#84); v0.12.0 was released without T04. The unrelated hostile same-account process-isolation enhancement remains deferred (Issue #72). Windows durability Issue #73 is not waived.

## Exact persistence dependencies

The canonical `events.jsonl` ledger is authoritative; `snapshot.json` and `index.db` are derived. The pending commit journal must be durably published **before** an in-place event-ledger write. Recovery must not delete it until the ledger suffix, derived materializations and relevant directory entries are safely persisted.

The offline legacy restore transaction is separate and requires explicit `confirmOffline:true` and an exclusive, trusted local runtime:

1. Validate backup fingerprint, target path, root inode and trust boundary; do not mutate the existing target.
2. Create stage as a sibling of the target, copy and verify all candidate bytes, fsync files and descendant directories.
3. Persist recovery journal file contents and flush the *parent-directory namespace* before moving either root. A journal file fsync alone is insufficient evidence of its durable directory entry.
4. Move existing root to a distinct displaced-original sibling; flush the parent namespace before moving the candidate.
5. Move staged candidate to root; flush parent namespace before acknowledging success.
6. Delete recovery journal only after durable promotion/verification, then flush parent namespace. Preserve the displaced original until this acknowledgement is complete.
7. **Retain the displaced original after acknowledgement**, expose its exact path in the restore result, and require a separate offline, independently reviewed retention/cleanup decision. Do not automatically delete the only original-tree witness while Windows journal-unlink persistence remains unproven. This is a risk-reduction measure, **not** evidence of a power-loss-durable transaction; retained trees consume disk space and require access-control and retention management.
8. On interruption, operator-recovery verifies path/transaction identity and inode witnesses. Recovery either restores displaced original when root is absent, retains displaced original if promotion completed, or fails closed on ambiguous evidence. Never delete the sole recovery evidence before a successful barrier.
9. Any unsupported namespace flush or failed barrier fails closed. Preserve the original root, displaced original, stage and journal to the maximum safe extent. The API must never claim a successful restore after an ambiguous outcome.
10. Distinguish fresh initialization, ordinary State Engine append/migration and offline restore; none may silently substitute for another.

## OS primitives and evidence boundary

**Implementation currently under review:** Node.js `fs.fsyncSync` on a directory descriptor opened `r+` on Windows, `r` on POSIX. `state-engine-v2.mjs` also flushes the State Engine parent after publishing `pending-commit.json` and before any in-place canonical append. The migration module currently uses **Node `fs.renameSync` followed by `syncRestoreParent`** for rollback, promotion and journal cleanup ordering. The source-controlled `scripts/windows-durable-rename.ps1` wrapper for `MoveFileExW` is **not invoked by the runtime**; it is an unused candidate, not native Windows durability evidence. See `docs/03-reference/scripts/windows-durable-rename.md`.

**Primary Microsoft documentation:**

- `FlushFileBuffers`: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers — writes buffers for the provided write-capable handle; notes hardware cache and file handle limitations.
- `CreateFileW`: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew — a directory handle requires `FILE_FLAG_BACKUP_SEMANTICS`; NTFS metadata persistence is discussed in relation to `FILE_FLAG_WRITE_THROUGH`.
- `MoveFileExW`: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw — the explicit `MOVEFILE_WRITE_THROUGH` flush guarantee is described for copy/delete moves; a successful move does not alone prove every same-volume directory rename/journal boundary.
- `NtFlushBuffersFileEx` (kernel documentation): https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntflushbuffersfileex — normal flag 0 concerns file data and metadata + storage sync, while FILE_DATA_SYNC_ONLY is not valid for directory handles. This is **context**, not proof that every user-mode Node/libuv filesystem combination has identical semantics.

**Supported guarantee not yet independently established:** Passing `fs.fsyncSync(fd)` in GitHub-hosted Windows CI shows the syscall path returned without error and proves the observed software call ordering. It does not simulate power interruption, certify drive write-cache behavior, establish power-loss atomicity across multiple entries, or guarantee remote SMB, ReFS, FAT/exFAT, removable media or every storage controller. Do not assert universal NTFS or all-filesystem power-loss durability from these references alone.

Production-support requirements include a documented local-volume/NTFS test environment, exact operating-system and filesystem identification, supported handle semantics, fault injection and independent architecture/security approval. Any inability to substantiate the required guarantee remains a **blocking Issue #73 risk**, not authorization to remove Windows restore support.

## Test evidence required

- **Runtime journal ordering:** T04-H49 injects a parent-directory flush failure and asserts no ledger bytes are appended and the pending marker is retained; T04-H50 verifies directory flush completes before physical canonical append.
- **Restore rollback ordering:** T04-H47/H48 observe Node rename followed by a successful parent-directory flush before journal deletion on applicable hosts. They **do not** invoke the unused PowerShell `MoveFileExW` helper or prove host power-loss durability.
- **Transaction fault injection:** before and after journal publication, original displacement, stage promotion, journal unlink, retained-original witness verification and separately approved offline cleanup, and explicit recovery. Validate original-file identity, fingerprint, canonical ledger history and recovery witnesses.
- **Hardware/OS durability:** dedicated power-loss/reboot test harness is still required to distinguish normal process termination from forced host power loss and to validate persistence on each claimed Windows filesystem.

For each test record OS build, filesystem, disk/cache environment, Node/libuv version, source SHA, exact fault boundary, directory witnesses and final hashes. Skips are not passes.

## Acceptance and release

T04 remains `BLOCKED` until Issue #73 is satisfactorily resolved with durable Windows functionality, the independent three-role reviews authenticate the **exact source**, all in-scope P1/P2 findings are dispositioned, and risk-3 acceptance produces `ACCEPTED`. CI passing and this document do not confer security signoff.

Related source: `runtime/orchestration/state-engine-migration.mjs`, `runtime/orchestration/state-engine-v2.mjs`, `scripts/state-engine-v2-migration.test.mjs`, `scripts/state-engine-v2-hardening.test.mjs`.
