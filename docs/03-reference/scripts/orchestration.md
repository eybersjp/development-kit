# orchestration

`node scripts/orchestration.mjs` is the v0.9 task-orchestration CLI. It exposes deterministic runtime operations used by the public DK commands without making the shell command itself an acceptance authority.

## Operations

- `prepare-run` — create/resolve the active Development Contract and orchestration run, persist the immutable initial manifest, and create state revision 1.
- `context` — build a role-specific fresh/rehydrated context package from authoritative sources.
- `verify` — create an independent evidence-backed verification record. PASS criteria must prove their declared `verificationType` when evidence is required.
- `acceptance` — compute `ACCEPTED` / `PENDING` / `BLOCKED` from verification, contract-level required verification, reviews, controls, drift, approvals, and source freshness. When the payload includes the active run, the resulting run transition is persisted as the next state revision.
- `correction` — classify failed verification and produce a bounded correction request when safe. With an active run, `CORRECT` and `PAUSE` persist a new revision; `NONE` preserves the current state and does not manufacture a pause.
- `safety` — classify command risk, blast radius, resource ownership, and required approval.
- `reconcile` — apply an exact amendment to a canonical project artifact. The caller must provide the expected pre-edit SHA-256 fingerprint; stale replay is rejected and the file is read back after atomic replacement.
- `plan-validate` — deterministically validate task count, dependencies, cycles, resource ownership, and criterion coverage while allowing legitimate independent/parallel tasks.
- `run-status` — read the latest persisted run state through the current-state pointer, falling back to the immutable initial manifest only when no state revision pointer exists.

## Input

Pass JSON through `--input-file=<project-relative-path>` or `--input-json=<json>`. Input files may not escape the project root.

## Trust Boundary

The CLI persists or computes control-plane records; it does not accept an implementation agent's narrative PASS/Done claim as authority. Contract-aware verification/review/acceptance results must retain the active contract ID, run ID, and source fingerprint. Once Autopilot binds a Development Contract, later action results may not omit orchestration evidence to downgrade the workflow to legacy mode.

## Runtime State

Contracts are stored under `.development-kit/contracts/`. Run/evidence records are stored under `.development-kit/runs/`.

Each run keeps:

- immutable `manifest.json` for the initial run definition;
- immutable `state-revisions/00000001.json`, `00000002.json`, and later revisions;
- `current-state.json`, an atomically updated pointer to the latest immutable state revision;
- immutable verification/control evidence records;
- `final-state.json` for terminal `ACCEPTED` or `BLOCKED` state.

This design lets restart/resume recover the current governed state without rewriting historical evidence. Runtime records are ignored by default and are not product source unless a project explicitly chooses otherwise.
