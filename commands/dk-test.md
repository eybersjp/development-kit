---
name: dk-test
description: >-
  Independently verify the active Development Contract with evidence for every required criterion/control.
---

# /dk-test

## Workflow

1. Resolve active contract/run and recheck source fingerprint.
2. Build independent verification context from current authority, repository state/diff and real test/runtime evidence. Use source sections; repack over-budget context without dropping required authority. Implementation reports remain non-authoritative hints.
3. Run only applicable unit/integration/type/lint/browser/runtime/regression/edge/schema/security/accessibility/design checks required by contract/risk.
4. Record PASS, FAIL, PARTIAL, UNVERIFIED or NOT_APPLICABLE for every required criterion/control. PASS needs required evidence; NOT_APPLICABLE needs reason.
5. Evaluate complete required control manifests; executed-test count never defines coverage.
6. Create the authoritative verification record through orchestration runtime. Implementation roles cannot do so.
7. Return PASS only when all required coverage is satisfied; otherwise FAIL or INCOMPLETE.

## UI Verification

Re-read bound `design.md` and use browser/visual evidence when required. If host visual capability is unavailable, record the evidence gap and require manual evidence.

## Output

Contract/run/fingerprint, criterion/control IDs with evidence references/status, coverage, and computed PASS / FAIL / INCOMPLETE verdict. Do not restate the specification.
