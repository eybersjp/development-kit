---
name: dk-build-auto
description: >-
  Process the validated PLAN sequentially through contract-driven implementation, verification, bounded correction, review, and acceptance.
---

# /dk-build-auto

## Workflow

For each task:

1. Resolve/create Development Contract + run from the validated PLAN.
2. Reuse valid repository orientation; build a compact fresh role context. If `tokenProfile.overBudget`, repack/narrow selectors before execution.
3. For UI work ensure/reuse Live UI Preview and fulfil `OPEN_OR_REUSE`; `WAITING_FOR_RUNNABLE_UI` is valid before scaffold.
4. Implement only contract scope; implementation evidence is non-authoritative.
5. Preflight consequential commands through execution safety.
6. Independently verify all required criteria/controls; preview does not replace browser-runtime verification.
7. Run required/risk-selected reviewers and deterministic acceptance.
8. Automatically correct only when correction engine returns `CORRECT`; persist attempt/failure signature and reverify.
9. Pause on repeated/exhausted failure, stale authority, incomplete verification/control coverage, architecture/design/security ambiguity, scope expansion, unavailable mandatory capability, or human approval.
10. Continue only after current task acceptance is `ACCEPTED`.

## Output

Compact cumulative contract/run progress, verification/review/acceptance state, correction attempt, blockers, preview state, and next task/action.
