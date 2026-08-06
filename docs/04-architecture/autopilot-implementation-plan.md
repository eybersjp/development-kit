# Comprehensive Architectural Implementation Plan: 🚀 AUTOMATED GUIDED WORKFLOW (`/dk-autopilot`)

**Plan Verdict**: `READY WITH EXPLICIT PREREQUISITES`  
*(Target Release: Development Kit v0.4.0 — Minor Feature Release)*  
**State Schema Version**: `1.0.0`

---

## 1. Conductor–Runtime Handshake Control Loop Architecture

`development-conductor` and the Autopilot runtime maintain strict separation of responsibilities:

### Responsibility Boundaries
* **`development-conductor`**: Interacts with the user, displays menu boxes and approval prompts, invokes slash-command prompt specifications, selects and invokes agents/skills, executes shell tools, and submits structured action results to the runtime.
* **Autopilot Runtime (`runtime/autopilot/`)**: Manages persistent workflow state, validates lifecycle transitions, evaluates policies and approval gates, calculates artifact staleness, issues deterministic next actions, records action results, and prevents invalid, duplicate, stale, or unauthorized transitions.

### Control Loop Sequence
```text
User Request / Workflow Continuation
         │
         ▼
development-conductor calls Autopilot Runtime (`node scripts/autopilot.mjs --next`)
         │
         ▼
Autopilot Runtime evaluates state & returns one Structured Next Action
         │
         ▼
development-conductor performs the assigned Action (invokes agent, runs test, prompts user)
         │
         ▼
development-conductor submits Action Result (`node scripts/autopilot.mjs --record-result --input-file=<path>`)
         │
         ▼
Autopilot Runtime validates result, updates state revision, & issues next Action or Approval Request
```

---

## 2. Executable CLI Operations & Secure Input Handling

The CLI entry point `scripts/autopilot.mjs` delegates execution to `runtime/autopilot/engine.mjs`.

### Supported CLI Operations
```bash
node scripts/autopilot.mjs --init [--autonomy=guided-autopilot|high-autonomy|review-every-stage]
node scripts/autopilot.mjs --next [--workflow=<id>]
node scripts/autopilot.mjs --begin-action --action=<actionId> [--workflow=<id>]
node scripts/autopilot.mjs --record-result [--input-file=<path> | --input-json=<json>] [--workflow=<id>]
node scripts/autopilot.mjs --renew-action --action=<actionId> [--workflow=<id>]
node scripts/autopilot.mjs --approve --approval=<approvalId> --token=<token>
node scripts/autopilot.mjs --reject --approval=<approvalId> --token=<token>
node scripts/autopilot.mjs --pause [--workflow=<id>]
node scripts/autopilot.mjs --resume [--workflow=<id>]
node scripts/autopilot.mjs --status [--workflow=<id>]
node scripts/autopilot.mjs --cancel [--workflow=<id>]
node scripts/autopilot.mjs --cancel --confirm=<confirmationToken> [--workflow=<id>]
```

### Secure Input Protocol for `--record-result`
- **Modes**: `--input-file=<path>`, `--input-json=<json>`, or standard input (`stdin`).
- **File Validation**: Must be a repository-relative path inside project bounds; traversal attempts (`..`), absolute device paths, and network paths are rejected. File size capped at 10 MB, UTF-8 encoded.
- **Diagnostics Redaction**: Secret-like key patterns (passwords, tokens, keys) are automatically sanitized and redacted from diagnostics before persistence.

---

## 3. Security Token Architecture (Cryptographic Hashing & Constant-Time Verification)

> [!IMPORTANT]
> Usable plaintext tokens are **NEVER** stored in persistent state, logs, or diagnostics.

1. **Generation**: Plaintext token is generated using `crypto.randomBytes(32).toString('hex')`.
2. **One-Time Return**: Returned once to caller via stdout CLI JSON payload.
3. **Persisted Hashing**: Only the SHA-256 hash `crypto.createHash('sha256').update(token).digest('hex')` is stored in state under `pendingApproval` or `pendingConfirmation`.
4. **Verification**: When `--approve`, `--reject`, or `--cancel --confirm` is called, the input token is hashed and compared against stored hash using `crypto.timingSafeEqual(bufferA, bufferB)`.
5. **Consumption & Replay Prevention**: Tokens are marked `consumed: true` before executing the authorized transition. Expired, replayed, duplicated, or consumed tokens are strictly rejected.

---

## 4. Active-Action Lease & Retry Semantics

- **Default Lease Duration**: 30 minutes; **Maximum Total Lease Duration**: 2 hours.
- **Lease Renewal**: `node scripts/autopilot.mjs --renew-action --action=<actionId>` can be called by `development-conductor` during long-running tasks. Runtime verifies `stateRevision` and `actionId` before extending `leaseExpiresAt`.
- **Expired Lease Handling**: If a lease expires without a result, state transitions action status to `lease_expired`.
- **Late Result Handling**: Late results for expired leases are placed in `manual_review` and not automatically applied.
- **Non-Idempotent Action Retry Protection**: Reversible, idempotent operations generate deterministic retry IDs (`retry_<actionId>_<attempt>`). Non-idempotent operations (Git push, PR creation/merge, package publishing, DB migrations, deployments, destructive file ops) **MUST NEVER be retried automatically**; they require explicit user approval.

---

## 5. Control-Operation State Semantics Matrix

Covers `--next`, `--begin-action`, `--record-result`, `--renew-action`, and `--cancel --confirm` across workflow/action states:

| Workflow / Active Action State | `--next` | `--begin-action` | `--record-result` | `--renew-action` | `--cancel --confirm` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `absent` | Fails: `ERROR_NO_WORKFLOW` | Fails: `ERROR_NO_WORKFLOW` | Fails: `ERROR_NO_WORKFLOW` | Fails: `ERROR_NO_WORKFLOW` | Fails: `ERROR_NO_WORKFLOW` |
| `no_active_action` | Generates & issues next action (`ACTION_ISSUED`) | Fails: `ERROR_NO_PENDING_ACTION` | Fails: `ERROR_NO_ACTIVE_ACTION` | Fails: `ERROR_NO_ACTIVE_ACTION` | Fails: `ERROR_INVALID_TOKEN` (unless token provided) |
| `action_issued` | Returns active action (`ACTION_ALREADY_ISSUED`) | Marks action `in_progress` (`ACTION_BEGUN`) | Records result; updates revision | Renews lease (`ACTION_LEASE_RENEWED`) | Requires valid confirmation token |
| `lease_active` | Returns active action (`ACTION_IN_PROGRESS`) | Already begun (`ACTION_IN_PROGRESS`) | Validates & records result (`RESULT_RECORDED`) | Renews lease (`ACTION_LEASE_RENEWED`) | Requires valid confirmation token |
| `lease_expired` | Prompts user/conductor for action timeout resolution | Rejects stale action | Moves late result to `manual_review` | Fails: `ERROR_LEASE_EXPIRED` | Requires valid confirmation token |
| `result_recorded` | Generates next action in sequence | Fails: `ERROR_ACTION_COMPLETED` | Fails: `ERROR_DUPLICATE_RESULT` | Fails: `ERROR_ACTION_COMPLETED` | Requires valid confirmation token |
| `unknown_action_id` | N/A | Fails: `ERROR_UNKNOWN_ACTION` | Fails: `ERROR_UNKNOWN_ACTION` | Fails: `ERROR_UNKNOWN_ACTION` | Fails: `ERROR_INVALID_TOKEN` |
| `revision_mismatch` | Fails: `ERROR_STALE_REVISION` | Fails: `ERROR_STALE_REVISION` | Fails: `ERROR_STALE_REVISION` | Fails: `ERROR_STALE_REVISION` | Fails: `ERROR_STALE_REVISION` |
| `awaiting_approval` | Returns `APPROVAL_REQUIRED` | Fails: `ERROR_APPROVAL_REQUIRED` | Fails: `ERROR_APPROVAL_REQUIRED` | Fails: `ERROR_APPROVAL_REQUIRED` | Validates confirmation token & cancels |
| `paused` | Fails: `ERROR_WORKFLOW_PAUSED` | Fails: `ERROR_WORKFLOW_PAUSED` | Fails: `ERROR_WORKFLOW_PAUSED` | Fails: `ERROR_WORKFLOW_PAUSED` | Validates confirmation token & cancels |
| `cancelled` | Fails: `ERROR_WORKFLOW_CANCELLED` | Fails: `ERROR_WORKFLOW_CANCELLED` | Fails: `ERROR_WORKFLOW_CANCELLED` | Fails: `ERROR_WORKFLOW_CANCELLED` | Already cancelled |
| `completed` | Fails: `ERROR_WORKFLOW_COMPLETED` | Fails: `ERROR_WORKFLOW_COMPLETED` | Fails: `ERROR_WORKFLOW_COMPLETED` | Fails: `ERROR_WORKFLOW_COMPLETED` | Archives completed workflow |

---

## 6. Versioned Immutable Snapshot Storage

State is stored as versioned immutable revision files:
```text
.development-kit/autopilot/state/
├── revision-000001.json
├── revision-000002.json
└── current.json
```
- Increment `stateRevision`, write `.tmp` file, execute `fs.fsyncSync`, verify integrity, rename to `revision-XXXXXX.json`, update pointer in `current.json`.
- Crash-consistent & recoverable without overwriting previous valid states.

---

## 7. Approval-Gate Policies (4 Tables)

### Table 1: Mandatory Non-Bypassable Gates (14 Gates)
Must pause for explicit human approval in ALL autonomy modes:
1. Scope Acceptance
2. Destructive File Operations
3. Irreversible Database Schema/Data Drops
4. Authentication & Authorization Changes
5. Secret & Credential Handling (reading/writing/transmitting actual values)
6. Security Risk Acceptance (high/critical findings)
7. Package Publishing (npm/PyPI)
8. Production Release Tag Creation
9. Production Environment Deployment
10. Git Push to Remote Repositories
11. Any Pull-Request Creation (including draft pull requests)
12. Pull Request Merge into Primary Branch
13. Branch Deletion (local or remote)
14. Material Requirement Ambiguity Resolution

### Table 2: Mode-Dependent Review Gates
- `guided-autopilot`: Approval required for architecture design, task risk ordering, and stage-by-stage review.
- `high-autonomy`: Automatically executes reversible architecture, design, and task plan steps; pauses ONLY for Table 1 mandatory gates.
- `review-every-stage`: Pauses at EVERY lifecycle stage boundary (1 through 9).

### Table 3: Pre-Authorized Reversible Actions
Stored in `.development-kit/autopilot/preauthorized-targets.json` (added to `.gitignore`):
```json
{
  "targetId": "staging_dev_cluster",
  "environment": "staging",
  "scope": "integration_testing",
  "approvedOperations": ["deploy_staging"],
  "approvedAt": "2026-08-06T00:00:00.000Z",
  "expiresAt": "2026-08-07T00:00:00.000Z",
  "approvedBy": "lead_engineer"
}
```
*Pre-authorization can NEVER authorize production deployment, DB migrations, credentials, security-risk acceptance, branch deletion, or PR merge.*

### Table 4: Informational Checkpoints
- Stage completion summary notification.
- Test execution pass report.
- Simplicity ladder reduction log.
- Validation checklist status.

---

## 8. Repository-Derived Change Classification

Classification based on empirical repository search:

| File Path | Repository Classification | Rationale |
| :--- | :--- | :--- |
| `commands/dk-autopilot.md` | `must change` `[NEW]` | Command prompt specification for `/dk-autopilot` |
| `agents/development-conductor.md` | `must change` `[MODIFY]` | Conductor control loop & action handshake implementation |
| `skills/using-development-kit/SKILL.md` | `must change` `[MODIFY]` | Methodology update for `/dk-autopilot` |
| `hooks/session-start.js` | `may change after impl evidence` | Modified only if banner/methodology metadata changes |
| `AGENTS.md` | `must change` `[MODIFY]` | Root agent rules and command list update |
| `.gitignore` | `must change` `[MODIFY]` | Added `.development-kit/workspace-id`, `.development-kit/autopilot/` |
| `package.json` | `must change` `[MODIFY]` | Version `0.4.0` update & added test script tasks |
| `opencode.json` | `may change after impl evidence` | Modified if OpenCode specific entry rule is needed |
| `CHANGELOG.md` | `must change` `[MODIFY]` | Release notes for v0.4.0 |
| `runtime/autopilot/engine.mjs` | `must change` `[NEW]` | Control loop & transition engine |
| `runtime/autopilot/state-store.mjs` | `must change` `[NEW]` | Snapshot persistence store |
| `runtime/autopilot/lock-manager.mjs` | `must change` `[NEW]` | Transaction lock & action lease manager |
| `runtime/autopilot/policy-engine.mjs` | `must change` `[NEW]` | Autonomy modes & approval gate policy |
| `runtime/autopilot/transition-model.mjs` | `must change` `[NEW]` | 9-stage transition state machine |
| `runtime/autopilot/staleness-engine.mjs` | `must change` `[NEW]` | Artifact fingerprint hashing & invalidation |
| `runtime/autopilot/project-identity.mjs` | `must change` `[NEW]` | Project UUID & workspace identity resolver |
| `runtime/autopilot/validators.mjs` | `must change` `[NEW]` | Zero-dependency domain validators |
| `scripts/autopilot.mjs` | `must change` `[NEW]` | Executable CLI adapter |
| `scripts/validate-evals.mjs` | `must change` `[NEW]` | Executable evaluation scenario runner |
| `schemas/autopilot-state.schema.json` | `must change` `[NEW]` | State schema contract |
| `schemas/evaluation-scenario.schema.json` | `must change` `[NEW]` | Evaluation scenario schema contract |
| `.agents/AGENTS.md` | `may change after impl evidence` | Synchronized mirror of root `AGENTS.md` |
| `.agents/plugins/development-kit/plugin.json` | `expected unchanged` | Verified unchanged via `npm run doctor` |
| `scripts/install-antigravity.mjs` | `may change after impl evidence` | Command catalog display update |
| `scripts/autopilot.test.mjs` | `must change` `[NEW]` | 32-area runtime unit test suite |
| `scripts/validate-docs.test.mjs` | `must change` `[MODIFY]` | Updated test expectations for 13 commands / 6 scripts |
| `evals/autopilot-lifecycle/scenario-01...15.json` | `must change` `[NEW]` | 15 evaluation scenario files |
| `docs/03-reference/commands/dk-autopilot.md` | `must change` `[NEW]` | Command reference page |
| `docs/03-reference/scripts/autopilot.md` | `must change` `[NEW]` | Script reference page |
| `docs/03-reference/scripts/validate-evals.md` | `must change` `[NEW]` | Script reference page |
| `docs/03-reference/evaluations/autopilot-lifecycle.md` | `must change` `[NEW]` | Evaluation reference page |
| `docs/03-reference/approval-gate-reference.md` | `must change` `[NEW]` | Approval gate reference page |
| `docs/02-user-guide/automated-guided-workflow.md` | `must change` `[NEW]` | User guide page |
| `docs/02-user-guide/failure-and-recovery.md` | `must change` `[NEW]` | Failure and recovery guide page |
| `docs/04-architecture/autopilot-lifecycle-architecture.md` | `must change` `[NEW]` | Architecture spec page |
| `docs/04-architecture/autopilot-implementation-plan.md` | `must change` `[NEW]` | Durable plan on feature branch |
| `docs/06-internals/workflow-state-and-resume-specification.md` | `must change` `[NEW]` | Internals state spec page |
| `docs/SUMMARY.md` | `must change` `[MODIFY]` | Registered 10 new doc pages |
| `README.md` | `must change` `[MODIFY]` | Featured startup menu & command |
| `docs/00-documentation/...` (18 Inventory files) | `must change` `[MODIFY]` | Updated inventory counts (12→13 cmd, 4→6 script, 10→11 eval) |

---

## 9. Preliminary Documentation Projections

- **Current Baseline Count**: 262 Markdown files under `docs/`, 261 `SUMMARY.md` entries.
- **Preliminary Minimum Projection**: **272 Markdown files**, **271 `SUMMARY.md` entries** (+10 new pages).
- **Final Post-Implementation Count**: Will be source-derived and verified via `npm run docs:validate` post-implementation.

---

## 10. Baseline Isolation & Execution Prerequisites

1. Commit approved v0.3.0 documentation baseline on `docs/complete-framework-documentation`.
2. Create baseline tag using the approved two-commit release process.
3. Run all baseline verification gates (`npm run docs:validate` passes 97/97).
4. Confirm clean working tree (`git status`).
5. Create feature branch: `git checkout -b feature/dk-autopilot`.
6. Restore durable v0.4.0 implementation plan on `feature/dk-autopilot`.
7. Re-run baseline gates before creating feature files.

---

## 11. Requirements Compliance Matrix

| Required Correction | Plan Section | Exact Decision | Remaining Uncertainty |
| :--- | :--- | :--- | :--- |
| **1. Expand Operation-State Matrix** | Section 5 | Added 48-cell control-operation matrix covering `--next`, `--begin-action`, `--record-result`, `--renew-action`, `--cancel --confirm` across all states | None |
| **2. Secure Token Architecture** | Section 3 | Generate `crypto.randomBytes(32)` plaintext; persist ONLY SHA-256 hash; compare via `crypto.timingSafeEqual`; mark consumed | None |
| **3. Active-Action Lease Semantics** | Section 4 | `--renew-action` API (30m default / 2h max); late results moved to `manual_review`; non-idempotent ops never auto-retried | None |
| **4. Finalize Remote-Op Gates** | Section 11 | "Any pull-request creation" added to Table 1 mandatory gates; High Autonomy staging deployment requires valid pre-authorization record | None |
| **5. Pre-Authorized Target Storage** | Section 7 | `.development-kit/autopilot/preauthorized-targets.json` added to `.gitignore`; domain validation & expiry enforcement; no secrets allowed | None |
| **6. Correct Change Inventory** | Section 8 | Removed "57 files" claim; classified files into `must change`, `may change`, `expected unchanged` based on repo search | None |
| **7. Correct Speculative Classifications** | Section 8 | Classified `session-start.js`, `opencode.json`, `.agents/AGENTS.md`, `plugin.json` with exact evidence-based criteria | None |
| **8. Preliminary Doc Projections** | Section 9 | Labeled 272 docs / 271 summary entries as preliminary projection; final count source-derived after implementation | None |
| **9. Secure Input Handling** | Section 2 | `--input-file=<path>` (traversal blocked, 10MB limit) or `stdin`; JSON domain validation & secret redaction in diagnostics | None |
| **10. Baseline Isolation** | Section 10 | 7-step prerequisite sequence starting with v0.3.0 baseline lock & tag before branch creation | None |

---

### Final Plan Verdict
**`READY WITH EXPLICIT PREREQUISITES`**
