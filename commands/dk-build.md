---
name: dk-build
description: >-
  Implement the next approved Development Contract task through required safety, verification, review, correction, and acceptance gates.
---

# /dk-build

## Workflow

1. Select the next approved validated PLAN task.
2. Use cached repository orientation when valid; perform task-specific delta inspection and readiness checks.
3. For UI work verify `design.md`, ensure Live UI Preview, fulfil `OPEN_OR_REUSE`, and preserve HMR.
4. Create/resolve contract + run with `node scripts/orchestration.mjs --operation=prepare-run`.
5. Build fresh implementation context. Use source sections and inspect `tokenProfile`; repack over-budget context instead of dropping required authority.
6. Preflight consequential commands through execution safety.
7. Implement only contract scope using existing-code-first, native-platform-first, dependency restraint, minimal diff and required tests.
8. Run `/dk-test` in independent verification context; every required criterion/control receives evidence-backed status.
9. Run only required/risk-selected reviewers and evaluate deterministic acceptance.
10. If correction engine returns `CORRECT`, apply only its exact bounded scope and reverify; otherwise pause.
11. Simplify only inside scope, reverify changes, and complete only at acceptance `ACCEPTED`.

## Non-Negotiable Gates

No self-certification; no PASS without required evidence; stale sources, missing required controls, unauthorized architecture drift or required approvals block completion. Preview availability is not acceptance.

## Output

Contract/run/fingerprint, changed files/evidence references, verification/review states, correction attempt, acceptance state, blockers, and preview URL/state when relevant. Do not restate full source text.
