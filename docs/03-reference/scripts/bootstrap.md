# bootstrap.mjs

The `bootstrap.mjs` script establishes the idempotent project-local runtime state under `.development-kit/`.

## Purpose

Ensures all required project directories and persistent state files exist before lifecycle commands execute:
- `.development-kit/project.json`
- `.development-kit/workspace-id`
- `.development-kit/settings.json`
- `.development-kit/autopilot/state/`
- `.development-kit/intelligence/memory/`

## Usage

```bash
node scripts/bootstrap.mjs
node scripts/bootstrap.mjs --status
```
