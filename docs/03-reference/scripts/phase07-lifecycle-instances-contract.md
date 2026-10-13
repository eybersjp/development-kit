# phase07-lifecycle-instances-contract.mjs

## Purpose
Materialize and validate the **PROVISIONAL** T05 Development Contract for Lifecycle Instances. The corresponding formal acceptance remains blocked until T04 is independently accepted.

## Usage
```powershell
node scripts/phase07-lifecycle-instances-contract.mjs
npm run lifecycle-instances:test
npm run release:validate
```

## Safety
Preserve exact source fingerprinting, canonical stage authority, parent-child isolation and independently verified completion. Running this generator or local tests does not mark T05 accepted. Product Owner scheduling authorization is tracked in GitHub Issue #74.

## Implementation
See `runtime/orchestration/lifecycle-instance.mjs`, `schemas/lifecycle-instance.schema.json` and `scripts/lifecycle-instances.test.mjs`.
