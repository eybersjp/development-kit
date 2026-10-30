# windows-durable-rename.ps1

## Purpose and actual integration status

**Status: Unused native-API candidate; not connected to the T04 runtime.** The source-controlled Windows PowerShell script wraps Unicode `MoveFileExW` with `MOVEFILE_WRITE_THROUGH`. It is available for independent evaluation but is **not** called by `restoreLegacyBackup`, `recoverLegacyRestore`, or any other path in `runtime/orchestration/state-engine-migration.mjs` at the reviewed PR #70 source `a203ab9280a3d5cd726019499f8900e3610ee8de`.

The runtime's actual `durableRestoreRollbackRename(from, to)` calls `fs.renameSync(from, to)`, followed by `syncRestoreParent(path.dirname(to))`. On Windows, the latter attempts to open the parent directory in `r+` mode and call Node.js `fs.fsyncSync`. This is the **only implemented rollback rename/flush path** in that source. The helper's existence must not be cited as evidence that native `MoveFileExW` executes in production.

## Candidate invocation (not performed by the runtime)

The script accepts literal `-From` and `-To` arguments and calls `MoveFileExW` through a compiled .NET P/Invoke declaration. Any future integration would require explicit source changes, reviewed path and ACL handling, an audited PowerShell/.NET dependency and error propagation, plus Windows-specific tests proving the helper is actually invoked. Do not claim that the runtime currently invokes this script or uses `execFileSync` for rollback.

## Verification and limitations

`T04-H47` and Windows-specific `T04-H48` verify Node `fs.renameSync` followed by a successful parent-directory `fs.fsyncSync` barrier **before** the journal is deleted. They do **not** exercise this PowerShell helper or establish physical power-loss persistence. The later real child-process termination fixtures also leave the operating system and storage caches running.

Microsoft's `MOVEFILE_WRITE_THROUGH` documentation does not independently establish a durable, crash-atomic same-volume NTFS directory rename followed by journal unlink. The supported directory-handle flush contract, filesystem matrix, storage cache behavior and controlled host power-loss/recovery evidence remain unresolved under [Issue #73](https://github.com/eybersjp/development-kit/issues/73).

**Release boundary:** T04 is a v0.13.0 P0 candidate, deferred from the released v0.12.0 scope by [Issue #82](https://github.com/eybersjp/development-kit/issues/82). The full Windows legacy restore requirement remains mandatory. This document, the unused helper and successful hosted CI do not authorize T04 acceptance, merge or release.

Official references: [MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw), [CreateFileW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), and [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).
