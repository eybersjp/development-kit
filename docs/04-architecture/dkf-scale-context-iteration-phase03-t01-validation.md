# Development Kit v0.12.0 — Phase 3 / DKF120-T01 Validation

**Status:** COMPLETE — ACCEPTED FOR PROGRESSION  
**Date:** 7 October 2026  
**Increment:** DKF120-T01 — Cost Observatory  
**Implementation branch:** `feature/v0.12-cost-observatory`  
**Validated head:** `3b6164dc67a6ceb98ca43e971c2b4636a6c95aa3`  
**Validation PR:** #61  
**Final CI run:** `37665136625`

## 1. Development Contract

The T01 contract is generated through normal DKF runtime contract machinery and persisted as git-ignored runtime state.

Observed final contract:

- Contract ID: `INC-DKF120-T01`
- Task ID: `DKF120-T01`
- Contract schema: `1.2.0`
- Source fingerprint: `sha256:5a89b0c0dd841d09cfcbf465ffc36c4c0e768574282c4c94aa389d713231f661`
- Risk: 2
- Stale: false

Bound acceptance criteria:

- `DKF-120-AC-001`
- `DKF-120-AC-002`
- `DKF-120-AC-003`
- `DKF-120-AC-033`

Derived gates:

```text
verification:
  specification
  tests

reviewers:
  code-reviewer

control domains:
  none

human approvals:
  none

configuration readiness:
  not required
```

## 2. Implemented capability

T01 adds a generic Cost Observatory foundation with:

- versioned `CostRecord` contract;
- canonical newline-normalised logical context measurement;
- deterministic estimated context token metric;
- optional provider input/output/cached-token fields;
- null/unavailable semantics for unobserved host/provider counts;
- explicit DKF-controlled counters;
- operation elapsed-time measurement;
- append-only project-local JSONL telemetry ledger;
- validated ledger reload;
- baseline/current comparison;
- public orchestration API export.

The telemetry ledger is:

```text
.development-kit/telemetry/cost-records.jsonl
```

and is ignored by Git.

## 3. Acceptance-criterion evidence

### DKF-120-AC-001

PASS.

The cost meter and `createCostRecord()` accept explicit DKF-controlled measurements and deterministic context estimates. Invalid values fail closed.

### DKF-120-AC-002

PASS.

Provider token values are `null` unless actual values are supplied. Unknown repository reads/scans, agent invocations, tool calls, and verification-command counts also remain `null`; they are not inferred as zero.

### DKF-120-AC-003

PASS.

LF and CRLF representations of the same logical text produce the same logical character count, byte count, and estimated context-token count.

The pre-existing historical static `token:audit` path was not modified.

### DKF-120-AC-033

PASS for the T01 foundation.

`compareCostRecords()` produces baseline/current deltas and reduction percentages for available metrics and explicitly reports unavailable comparisons as unavailable/null.

Final release-wide before/after conclusions remain owned by T10.

## 4. Focused tests

Final focused result on Ubuntu:

```text
tests: 9
pass:  9
fail:  0
```

The same T01 Cost Observatory gate passed on Windows.

Covered behaviours include:

- newline normalisation;
- explicit counters;
- optional provider telemetry;
- unavailable-host-metric semantics;
- invalid-value fail-closed behaviour;
- append-only JSONL persistence;
- cost comparison;
- acceptance isolation;
- schema alignment.

## 5. Regression validation

Final GitHub Actions run `37665136625` passed on:

- Ubuntu;
- Windows.

The final head passed:

- existing skill/agent validation;
- plugin synchronization;
- installer integrity;
- Development Contract tests;
- execution safety;
- evidence/control coverage;
- orchestration core/integration;
- v0.9 reliability regressions;
- documentation;
- OpenCode/platform adapters;
- external research;
- v0.7.1 regressions;
- Live UI Preview;
- existing token/context efficiency;
- Phase 0/1 baseline;
- Phase 2 deterministic PLAN;
- T01 Cost Observatory validation;
- Design Authority;
- Autopilot/evaluations;
- exact `release:validate`.

## 6. Correction history

The evidence trail preserves two corrections:

1. an invalid deep-equality test over a volatile acceptance timestamp;
2. a Development Contract classification that unnecessarily derived a security-review gate.

Both were corrected and independently rerun through the full CI matrix.

See:

`dkf-cost-observatory-t01-review.md`

## 7. General-purpose framework check

PASS.

T01 contains no application-specific or industry-specific business logic.

The capability is applicable to any DKF-managed software project independent of application type, repository topology, host, model, provider, or technology stack.

## 8. Acceptance decision

**DKF120-T01 — ACCEPTED FOR PROGRESSION**

This decision authorises progression to the next validated PLAN increment only.

It does not:

- publish v0.12.0;
- bump the package version;
- merge to `main`;
- authorise release;
- authorise T03 or later work before T02 is completed and accepted.

## 9. Next increment

```text
DKF120-T02 — Workspace Target Engine
```

T02 must receive its own Development Contract before production implementation.
