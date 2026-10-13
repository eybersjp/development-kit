# DKF120-T01 — Cost Observatory Review

**Review status:** PASS  
**Date:** 7 October 2026  
**Branch:** `feature/v0.12-cost-observatory`  
**Reviewed head:** `3b6164dc67a6ceb98ca43e971c2b4636a6c95aa3`

## Scope reviewed

Production/runtime change:

- `runtime/orchestration/cost-observatory.mjs`
- `runtime/orchestration/index.mjs`
- `schemas/cost-record.schema.json`
- `.gitignore`

Contract/test/integration change:

- `scripts/phase03-cost-observatory-contract.mjs`
- `scripts/cost-observatory.test.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- script reference documentation and documentation index.

## Contract compliance

The implementation remains inside DKF120-T01.

It does not implement:

- Workspace Target Engine;
- Execution Capsules/context caching;
- State Engine V2;
- Lifecycle Instances;
- discovery/re-entry;
- Gate Profiles;
- Verification Extension SDK;
- Complexity Delta Guard;
- Control Center v0.12 work.

No application-specific or industry-specific business logic is present.

## Architecture review

### General-purpose core

PASS.

The runtime operates on generic operation identifiers, context text, optional host/provider usage counters, generic orchestration counters, timestamps, and optional lifecycle/contract/task/run references.

There are no solar, energy, finance, healthcare, CAD, legal, ecommerce, or other domain semantics.

### Host/provider independence

PASS.

Provider token values are optional numeric observations. No provider library, provider credential, API key, provider-specific object, or external service is required.

### Observational boundary

PASS.

The Cost Observatory module is exported but is not consulted by:

- `acceptance-engine.mjs`;
- `gate-selector.mjs`;
- Development Contract validation;
- lifecycle/autopilot state transitions.

A regression test proves that writing a cost observation does not alter deterministic acceptance output other than the acceptance engine's own observation timestamp.

### Persistence

PASS for T01 scope.

Cost observations use one append-only project-local JSONL ledger:

```text
.development-kit/telemetry/cost-records.jsonl
```

The telemetry directory is git-ignored.

This is telemetry persistence only. It does not pre-empt State Engine V2 canonical-state design.

### Cross-platform measurement

PASS.

Logical text measurement normalises `CRLF` and legacy `CR` to `LF` before character/byte/token estimation.

The historical `token:audit` implementation remains unchanged.

## Review findings and corrections

### REV-T01-001 — Test incorrectly compared volatile acceptance timestamps

**Severity:** Minor test defect  
**Status:** Corrected

The first CI execution failed because the observational regression test deep-compared two acceptance records whose `createdAt` values were generated independently.

Acceptance state/gates were identical.

Correction:

- preserve the assertion that both records are `ACCEPTED`;
- compare the remaining acceptance semantics with the expected observation timestamp normalised out.

Correction commit:

`869bde49c29495507d21cf6a1395dd4161c6f29c`

### REV-T01-002 — Non-security architecture rule was classified as a security constraint

**Severity:** Governance classification issue  
**Status:** Corrected

The original T01 contract task placed “does not require provider credentials” in `securityConstraints`.

Under existing DKF gate-selection rules any non-empty security constraint correctly adds `security-reviewer` and the security control domain. That exceeded the validated T01 PLAN, whose required reviewer is `code-reviewer`.

The Cost Observatory does not read, persist, or request credentials; the statement is an architectural boundary rather than a security-sensitive implementation requirement.

Correction:

- moved the no-credentials/no-fabrication rules to architecture constraints;
- left `securityConstraints` empty;
- added a contract-time assertion that derived T01 gates are exactly:
  - verification: `specification`, `tests`;
  - reviewer: `code-reviewer`;
  - no specialist control domain;
  - no human approval;
  - no configuration-readiness dependency.

Correction commit:

`3b6164dc67a6ceb98ca43e971c2b4636a6c95aa3`

## Outstanding findings

Critical: **0**  
Major: **0**  
Unresolved minor: **0**

## Review verdict

**PASS**

The T01 implementation is appropriately small, general-purpose, contract-bounded, and non-authoritative.
