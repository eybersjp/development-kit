# phase12-control-center-validation-contract.mjs

## Purpose

Generate and validate the **provisional** Development Contract for T10 Control Center and Comparative Release Validation on the Product Owner-approved parallel development track. This is not a deterministic ACCEPTED result; normal dependency-ordered acceptance and independent review remain mandatory.

## Usage

```powershell
node scripts/phase12-control-center-validation-contract.mjs
npm run control-center-v012:test
```

## Authority and checks

The canonical v0.12 specification, design and task-specific implementation PLAN govern this contract. The script must fail closed on stale source evidence. Relevant implementation: `runtime/api/runtime-api-service.mjs`. Cross-platform tests and independent source-bound reviews remain mandatory. See Issue #74 for parallel scheduling approval, Issue #73 for required full Windows restore crash-durability support, and the applicable task PR for provisional source and tests.
