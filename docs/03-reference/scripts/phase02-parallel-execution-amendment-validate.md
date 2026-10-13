# phase02-parallel-execution-amendment-validate.mjs

## Purpose

Deterministically validate the 13 October 2026 Product Owner-approved DKF v0.12.0 parallel *provisional implementation* scheduling amendment. The original ten-task dependency graph, 40 acceptance criteria and historical implementation PLAN remain unchanged. Parallel T05–T10 engineering does **not** authorize early acceptance, integration, merging or release.

## Inputs

- `docs/04-architecture/dkf-scale-context-iteration-v0.12-plan-model.json`
- `docs/04-architecture/dkf-v0.12-parallel-execution-amendment.json`
- The existing pure `validatePlanModel` runtime validator

The canonical human-readable amendment is `docs/04-architecture/dkf-v0.12-parallel-execution-amendment.md`; the Product Owner decision is recorded in GitHub Issue #74.

## Usage

```powershell
npm run parallel-plan:validate
```

Or:

```powershell
node scripts/phase02-parallel-execution-amendment-validate.mjs
```

The validator reports `valid: true` only when the exact provisional-start scope is T05–T10 and all ten-task acceptance dependencies, existing resource/criteria coverage, isolation and formal approval requirements are preserved. Exits nonzero on any violation; no external service or credential is required.

## Safety

Do not interpret a successful validation as a Development Contract `ACCEPTED` verdict, approval of T04 Windows crash durability, or permission to publish v0.12.0. Unaccepted feature branches remain speculative until upstream acceptance and independent source-bound task reviews are complete.

## Verification

The script is included in `npm run release:validate` and runs as an explicit cross-platform CI check on its governance branch. It must fail closed when approval authority, task scope, existing task DAG, required criteria or release safeguards are changed.
