# bootstrap.mjs

`bootstrap.mjs` establishes idempotent project-local runtime state under `.development-kit/` and provides Development Modes initialization, inspection and revisioned selection.

## Purpose

Establishes project identity, settings, Autopilot state folders and memory alongside a repository-owned `.development-kit/development-mode.json` selection. Fresh interactive projects offer numbered mode choices, non-interactive projects default to Balanced; existing bootstrapped projects without mode selection are migrated to a recorded Balanced entry. Valid existing selections are preserved.

## Usage

```bash
node scripts/bootstrap.mjs --init
node scripts/bootstrap.mjs --init --mode=rapid --no-interactive
node scripts/bootstrap.mjs --init --mode=maintenance-evolution --base-methodology=spec-driven
node scripts/bootstrap.mjs --init --config-file=mode-selection.json
node scripts/bootstrap.mjs --status
node scripts/bootstrap.mjs --mode-status
node scripts/bootstrap.mjs --history
node scripts/bootstrap.mjs --recommend --project-type=existing --delivery=production --requirements=clear --documentation=standard --governance=strict
node scripts/bootstrap.mjs --set-mode --mode=doc-driven --expected-revision=1 --reason=Approved-process-change
```

Changing a selected mode requires the separate `--set-mode` operation with the expected revision and a reason. Corrupt configuration fails closed. Recommendation never writes state. For the complete profile and CLI guide see [Development Modes](../../02-user-guide/development-modes.md). Autopilot's autonomy-level policies and required approval gates are unchanged.
