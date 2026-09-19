---
name: dk-build-auto
description: >-
  Process the validated approved task plan automatically through contract-driven implementation, verification, bounded correction, review, and acceptance.
---

# /dk-build-auto

## Purpose

Processes the approved PLAN sequentially while preserving the same v0.9 control plane as `/dk-build`. Automation may remove repetitive handoffs, but it may not weaken evidence, safety, review, or human approval gates.

## Workflow

For each task:
1. Select the next approved task from the deterministically validated PLAN.
2. Resolve/create its Development Contract and run manifest.
3. Rehydrate authoritative sources and choose the host execution strategy. Use native isolated sub-agents when available; otherwise use sequential fresh-context execution.
4. If the task affects UI/design, run `node scripts/ui-preview.mjs --ensure --context="<current UI task>" --route=<affected-route>` before visual implementation. Fulfil any `OPEN_OR_REUSE` browser action immediately. `WAITING_FOR_RUNNABLE_UI` is allowed before the first frontend shell; ensure again as soon as that shell becomes runnable. Reuse the same preview/HMR process across subsequent UI tasks when healthy.
5. Implement in a fresh implementation context. Implementation output is non-authoritative evidence.
6. Preflight consequential commands through execution safety before execution.
7. Independently verify every acceptance criterion and required control. Live preview remains development visibility and does not replace browser-runtime verification.
8. Run the risk/impact-selected structured reviews.
9. Ask the runtime acceptance engine for `ACCEPTED`, `PENDING`, or `BLOCKED`.
10. On a correctable implementation failure, use the correction engine. Continue automatically only when the decision is `CORRECT`; persist the failure signature and exact correction scope.
11. Reverify after every correction. Stop correction on repeat failure, maximum attempts, high-risk/security/architecture/design ambiguity, source staleness, scope expansion, or a consequential human gate.
12. Continue to the next task only after acceptance is `ACCEPTED`.

## Auto-Pause Conditions

Pause and surface the precise gate when:
- verification is PARTIAL, UNVERIFIED, or blocked by stale sources;
- correction engine returns `PAUSE`;
- a required reviewer/control manifest is incomplete or failed;
- architecture drift is unauthorized or needs a decision;
- Design Authority or required visual evidence is unresolved;
- a required UI preview cannot be started or displayed after the frontend is runnable;
- a destructive/remote action requires approval;
- the host cannot provide mandatory independent verification capability;
- the Product Owner must approve a consequential decision.

## Skills Activated

- `subagent-driven-implementation`
- `incremental-implementation`
- `test-driven-development`
- `existing-code-first`
- `native-platform-first`
- `dependency-restraint`
- `minimal-diff`
- `task-readiness-check`
- `dependency-ordering`
- `live-ui-preview` when UI/design work is present
- `verification-before-completion`
- `regression-testing`

## Output

Cumulative progress by contract/run, current correction attempt, verification/control coverage, outstanding gates, accepted tasks, live-preview state for UI work, and the exact reason for any pause.
