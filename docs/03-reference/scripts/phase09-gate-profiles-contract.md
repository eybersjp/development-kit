# phase09-gate-profiles-contract.mjs

## Purpose

Generate and validate the **provisional** Development Contract for T07 Generic Gate Profiles on the Product Owner-approved parallel development track. This is not a deterministic ACCEPTED result; normal dependency-ordered acceptance and independent review remain mandatory.

## Usage

```powershell
node scripts/phase09-gate-profiles-contract.mjs
npm run gate-profiles:test
```

## Authority and checks

The canonical v0.12 specification, design and task-specific implementation PLAN govern this contract. The script must fail closed on stale source evidence. Relevant implementation: `runtime/orchestration/gate-profiles.mjs`. Cross-platform tests and independent source-bound reviews remain mandatory. See Issue #74 for parallel scheduling approval, Issue #73 for required full Windows restore crash-durability support, and the applicable task PR for provisional source and tests.
