# lifecycle.mjs

The `lifecycle.mjs` script acts as the centralized command lifecycle entry adapter for Development Kit commands.

## Purpose

Enforces the command entry classification taxonomy, resolves project roots deterministically, bootstraps runtime state idempotently, and establishes structured execution context before stage actions occur.

## Usage

```bash
node scripts/lifecycle.mjs --command=dk-idea --phase=entry
node scripts/lifecycle.mjs --command=dk-autopilot
node scripts/lifecycle.mjs --command=dk-status
```

## Output

Returns a JSON payload describing:
- `success`: boolean indicating whether lifecycle entry succeeded
- `command`: normalized command name
- `classification`: execution class (`PROJECT_MUTATING`, `PROJECT_STATE_MUTATING`, `PROJECT_ORCHESTRATOR`, `PROJECT_READ_ONLY`, `DUAL_MODE`)
- `bootstrapped`: boolean indicating whether project-local state is initialized
- `identity`: project ID and framework version when initialized
- `ideaStage`: computed IDEA lifecycle state when initialized
