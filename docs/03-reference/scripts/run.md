# run.mjs

The `run.mjs` script provides a universal CLI dispatcher for Development Kit scripts across all project-local, repository-local, and global plugin installations.

## Purpose

Resolves the target script in the active environment without requiring fixed relative paths.

## Usage

```bash
node scripts/run.mjs lifecycle.mjs --command=dk-idea --phase=entry
node scripts/run.mjs orchestration.mjs --operation=idea-state
```
