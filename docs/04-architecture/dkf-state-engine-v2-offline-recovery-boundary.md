# DKF v0.12 T04 — Offline recovery boundary and crash protocol

**Status:** Candidate architecture contract; subject to independent code, architecture and security review.
**Scope:** `restoreLegacyBackup`, `recoverLegacyRestore`, `recoverAbandonedStateLock`.
**Owner:** DKF State Engine V2 (T04); no T05 or release scope.

## 1. Explicit environment and trust boundary

A backup restore changes an entire project directory, including its files and operating-system metadata. Node.js 18+ cannot guarantee descriptor-relative `openat2`/equivalent anti-swap semantics on every supported Windows and Unix filesystem. The framework must **not** claim that path validation, a random staging name, `0700` permissions, or `confirmOffline: true` defeats another malicious process running under the **same OS identity**.

Similarly, runtime atomic publication (`atomicWrite` and `pinnedUnlinkAndSync` for journals, snapshots, and indexes) pins directory descriptors via `/proc/self/fd` on Linux. On supported non-Linux hosts (e.g. Windows and macOS), portable Node.js does not provide kernel-level descriptor-relative pathname resolution; publication revalidates directory device/inode identity immediately before publication and unlink, but cannot guarantee protection against concurrent, hostile same-UID processes manipulating paths. The framework explicitly acknowledges that protection from hostile co-tenant processes sharing the local OS account is not supported on non-Linux platforms without native OS handle primitives.

**Supported T04 restore mode:** an operator-initiated, offline maintenance session with exclusive control of the target project and its parent directory. The operator must stop DKF writers, processes with access to the directory, and any untrusted process sharing the OS account before invocation. Backup bytes are validated, but the local host, operator and offline execution identity are trusted. This is a deliberate environmental scope, **not** an automatic protection enforced by a boolean option. If exclusivity cannot be established, **do not invoke the restore**. Production runtime should remain on the existing canonical state, and no provider should invoke restore autonomously.

The `confirmOffline: true` parameter is a mandatory explicit caller attestation, not proof of isolation. Missing confirmation fails closed before any restore mutation. The restore operation is *not* a security sandbox for attacker-controlled local filesystem writers.

A future capability supporting actively hostile same-UID processes across all platforms requires a separately reviewed process/OS security boundary and handle-relative filesystem APIs. That capability is excluded from the T04 public contract.

## 2. Journaled promotion transaction

- Validate the backup's source fingerprint and all destination relative paths before modifying the target tree.
- Assemble the candidate restore in a private sibling staging directory. Preserve the existing root's POSIX mode, ownership and timestamps when supported, without silently claiming Windows custom ACL preservation.
- Persist and fsync a deterministic sibling promotion journal before renaming directories. The journal includes the target path and transaction ID plus original and candidate directory device/inode witnesses serialized as decimal strings (Node BigInt to avoid unsafe-number rounding).
- Rename the original target to a transaction-specific displaced path; fsync the parent on POSIX. Rename the candidate into place, fsync the parent, then delete the journal and sync the parent.
- Cleanup a displaced old tree only after promotion is durably acknowledged. No retained original recovery bundle inside the new root is deleted by the migration itself.

**Recovery:** If a crash interrupts promotion, new `restoreLegacyBackup` calls refuse to run while the journal exists. A trusted operator explicitly calls `recoverLegacyRestore({targetRoot, confirmOffline:true})`. Recovery verifies the exact same target, transaction name, and persisted inode witnesses; restores a displaced original if the target is absent; or acknowledges an already promoted candidate. Ambiguous, swapped or malformed states fail closed without guessing.

## 3. State lock guard failure recovery

Normal State Engine writers never discard an uncertain `state.lock.reclaim` guard. The guard contains local PID, hostname, unique owner token and creation timestamp. A guard can be left behind by a crash or host termination.

`recoverAbandonedStateLock({rootDir, confirmOffline:true})` is an **offline operator action**. It requires an aged (at least 60 seconds) guard, checks the guard's local owner process is gone where owner metadata exists, checks any remaining local state lock owner is gone, and uses conservative directory cleanup. A live owner, malformed state or recent guard refuses recovery. The call cannot prove no unauthorized same-UID process exists; the offline boundary is mandatory.

## 4. Compatibility and failure discipline

- Node.js >=18; no OS-specific native module required for the scoped offline contract.
- Existing State Engine runtime operations remain available; migration cutover remains conditional on semantic-equivalence checks.
- Backup restoration now requires explicit `confirmOffline: true` — a safety-related API tightening for operator callers, not a silent fallback.
- Replays and restoration never publish partial snapshots or claim successful acceptance on a failed integrity witness.
- An inability to preserve required platform-specific ACLs is an operational blocker, not permission to misrepresent equivalence.
- No T04 change here authorizes a package release, pruning legacy state, or bypassing Design Authority and human approval gates.

## 5. Verification and remaining decision

Automated tests H24–H28 validate offline confirmation, journal recovery after an injected failure and a real child-process termination, and operator-recoverable orphan guards. Earlier H01–H23 cover ledger integrity, concurrent writers, symlinks/hardlinks, snapshot recovery and permission preservation.

**Formal acceptance decision must record:** whether the explicitly narrower *trusted offline operator* boundary is acceptable to the product owner/security authority for the T04 legacy restore capability. Automated tests cannot confer that authorization; independent risk-3 review must confirm that the code matches this scope, no in-scope Critical/Major findings remain, and the deterministic DKF governance evidence is persisted.


## Supported runtime threat model (T04 scoped Product Owner decision)

State Engine V2 automatic append and recovery support a **trusted, exclusive local runtime**. The Product Owner explicitly deferred stronger same-account OS isolation to a future revision (tracked in [Issue #72](https://github.com/eybersjp/development-kit/issues/72), with the decision recorded on [PR #70](https://github.com/eybersjp/development-kit/pull/70#issuecomment-6134158112)); this scoped operating limitation still requires independent risk-3 security and architecture review before T04 acceptance. Hostile concurrent mutation by a process holding the same OS credentials (same-UID write authority) is **out of scope**: Node.js `lstat`/`fstat`/`rename`/`unlink`, `/proc/self/fd` and cooperative project locks cannot atomically protect two directory entries against such an actor, and `0700` modes or `confirmOffline` flags do not isolate it. This supported operating scope is separate from, and does not extend, the offline-only restore exception above.

Guarantees that remain:

- The canonical ledger (`events.jsonl`) is the sole authority. Snapshot and index are derived and verified against ledger contents on every load; a snapshot ahead of, or hash-divergent from, the ledger fails closed (`loadStateSnapshot`, `verifyStateEngineIntegrity`).
- An append is acknowledged only after the ledger append is fsynced, derived state is published and the pending journal is removed.
- A commit that cannot be proven (for example the ledger entry was replaced mid-commit) is *ambiguous*: it is detected as ledger/derived inconsistency on the next load rather than prevented. No after-the-fact check claims to prevent a concurrent authorized adversary.
- Directory/descriptor pinning, symlink/hardlink/inode checks and held ledger descriptors remain as defence-in-depth against accidental and non-concurrent tampering.

Supporting hostile same-UID mutation would require an OS-enforced boundary (separate credentials/ACLs or a native helper service) proven on every supported platform and is not part of v0.12.

Regression evidence: `T04-H43` (append) and `T04-H44` (recovery) replace the ledger entry between the final check and the journal `unlink`, capture ledger/journal/snapshot witnesses and assert fail-closed detection on next load. The Windows fixture is skipped when the host denies renaming an open file; Ubuntu CI provides the inode-swap evidence and the skip is not claimed as cross-platform resistance.
