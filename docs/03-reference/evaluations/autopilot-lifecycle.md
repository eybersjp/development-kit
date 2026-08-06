# Evaluation: Autopilot Lifecycle

## Overview

The `autopilot-lifecycle` evaluation suite validates the end-to-end execution, stage transitions, non-bypassable security gates, pre-authorizations, lease handling, staleness tracking, and two-step cancellation challenges for `/dk-autopilot`.

## Scenarios

1. `scenario-01-project-init.json` — Autopilot project identity initialization & initial revision.
2. `scenario-02-understand-transition.json` — Stage 1 UNDERSTAND transition to Stage 2 DEFINE.
3. `scenario-03-define-spec-approval.json` — Scope acceptance approval gate in DEFINE stage.
4. `scenario-04-design-architecture-review.json` — Stage 3 DESIGN technical/visual design verification.
5. `scenario-05-plan-task-decomposition.json` — Stage 4 PLAN risk-first task decomposition.
6. `scenario-06-implement-subagent-dispatch.json` — Stage 5 IMPLEMENT fresh sub-agent dispatch.
7. `scenario-07-verify-test-suite.json` — Stage 6 VERIFY automated test suite execution.
8. `scenario-08-review-two-stage-gate.json` — Stage 7 REVIEW two-stage review cycle.
9. `scenario-09-simplify-ponytail-ladder.json` — Stage 8 SIMPLIFY Ponytail simplicity ladder application.
10. `scenario-10-complete-branch-ship.json` — Stage 9 COMPLETE release & branch completion.
11. `scenario-11-mandatory-gate-rejection.json` — Mandatory non-bypassable security gate rejection.
12. `scenario-12-preauthorized-target-evaluation.json` — Pre-authorized staging target evaluation.
13. `scenario-13-artifact-staleness-invalidation.json` — Upstream artifact staleness fingerprinting.
14. `scenario-14-lease-expiry-recovery.json` — Action lease expiry and manual-review routing.
15. `scenario-15-cancellation-two-step.json` — Two-step cancellation challenge & confirmation.
