# windows-durable-rename.ps1

## Purpose

Windows-only, source-controlled offline restore recovery helper for the T04 State Engine V2 legacy migration. It uses the native Unicode `MoveFileExW` API with `MOVEFILE_WRITE_THROUGH` to move a displaced recovery directory back into the intended target path. Node.js `fs.renameSync` does not expose this flag, and Node's portable directory `fsync` operation cannot establish the corresponding Windows namespace durability.

## Execution

The helper is **not** a user-facing command. `runtime/orchestration/state-engine-migration.mjs` calls it with `execFileSync` using an explicitly located, bundled Windows PowerShell executable and literal `-From` / `-To` arguments. There is no shell string interpolation or remotely downloaded script.

The script invokes Win32 `MoveFileExW` and propagates native error codes. If PowerShell, `Add-Type`, the helper, or the native rename fails, the caller raises a `StateMigrationError` and **retains the restore journal** rather than treating an uncertain recovery as acknowledged.

## Verification and limitations

`T04-H48` exercises a real Windows child-process death after root displacement, ensures recovery does not use Node's ordinary rename, and verifies that the journal is removed only after the restored original becomes visible. `T04-H47` separately proves parent-directory `fsync` ordering on POSIX hosts.

The Microsoft `MOVEFILE_WRITE_THROUGH` documentation says the move does not return until the file is moved on disk, while expressly describing a copy/delete flush guarantee. This is the selected **candidate native mechanism**, not independent proof of same-volume NTFS crash durability on every supported filesystem. Security/architecture reviewers must verify the supported Windows storage and transaction guarantees; this helper must not be represented as a universal power-loss guarantee based solely on a functional CI test.

Official API references: [MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw) and [Moving Directories](https://learn.microsoft.com/en-us/windows/win32/fileio/moving-directories).

This helper does not authorize T04 acceptance, broader same-account process isolation, T05, merging or a v0.12.0 release.
