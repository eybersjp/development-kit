# orchestration

`node scripts/orchestration.mjs` is the v0.9 task-orchestration CLI. It exposes deterministic runtime operations used by the public DK commands without making the shell command itself an acceptance authority.

## Operations

- `prepare-run` — create/resolve the active Development Contract and orchestration run.
- `context` — build a role-specific fresh/rehydrated context package from authoritative sources.
- `verify` — create an independent evidence-backed verification record.
- `acceptance` — compute ACCEPTED / PENDING / BLOCKED from verification, reviews, controls, drift, approvals and source freshness.
- `correction` — classify failed verification and produce a bounded correction request when safe.
- `safety` — classify command risk, blast radius, resource ownership and required approval.
- `reconcile` — apply an exact amendment to a canonical project artifact with fingerprint/read-back checks.
- `plan-validate` — deterministically validate task count, dependencies, resource ownership and criterion coverage.
- `run-status` — read the persisted orchestration run manifest.

## Input

Pass JSON through `--input-file=<project-relative-path>` or `--input-json=<json>`. Input files may not escape the project root.

## Trust Boundary

The CLI persists or computes control-plane records; it does not accept an implementation agent's narrative PASS/Done claim as authority. Contract-aware verification/review/acceptance results must retain the active contract ID, run ID and source fingerprint.

## Runtime State

Contracts are stored under `.development-kit/contracts/`. Run/evidence records are stored under `.development-kit/runs/`. These runtime records are ignored by default and are not product source unless a project explicitly chooses otherwise.
