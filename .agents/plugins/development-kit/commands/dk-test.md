---
name: dk-test
description: >-
  Independently verify the active Development Contract and attach evidence to every applicable acceptance criterion and required control.
---

# /dk-test

## Purpose

Runs verification for the active task. v0.9 distinguishes test execution from verification coverage: a green subset of tests is not a PASS when required criteria or controls remain unverified.

## Workflow

1. Resolve the active Development Contract and run ID. Recheck the contract source fingerprint before verification.
2. Build a fresh or rehydrated verification context from the contract, authoritative sources, actual repository state/diff, and real test/runtime evidence. Upstream implementation reports are explicitly non-authoritative.
3. Run applicable unit, integration, type, lint, browser/runtime, regression, edge-case, schema/migration, security, accessibility, and design checks. For UI work, perform Design System Compliance verification.
4. Attach evidence to the stable contract criterion IDs. Each criterion receives exactly one runtime status: PASS, FAIL, PARTIAL, UNVERIFIED, or NOT_APPLICABLE.
5. PASS requires evidence unless that criterion is explicitly evidence-exempt. Evidence-exempt does not mean optional.
6. NOT_APPLICABLE requires an explicit reason.
7. For domains such as security, evaluate the complete required control manifest. Missing controls become UNVERIFIED. Executed-test count never defines the required control set.
8. Create the authoritative verification record through the orchestration runtime. Implementation roles may not produce this record.
9. Return PASS only when all required criteria are satisfied with valid evidence. PARTIAL/UNVERIFIED produce INCOMPLETE, not PASS.

## UI Verification

For UI work, bind and re-read authoritative `design.md`; run Design System Compliance checks and use browser/visual evidence when available. If the host lacks visual capability, record the evidence gap and require manual visual evidence rather than silently skipping the gate.

## Skills Activated

- `verification-before-completion`
- `browser-runtime-verification`
- `regression-testing`
- `edge-case-testing`
- conditional `test-driven-development`

## Sub-Agents

- `test-engineer`
- `spec-reviewer`/verification context as required by the active contract

## Output

Contract/run identity, source fingerprint, criterion-by-criterion evidence/status, required-control coverage by domain, and computed verification verdict PASS / FAIL / INCOMPLETE.
