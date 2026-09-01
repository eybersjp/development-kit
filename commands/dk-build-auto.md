---
name: dk-build-auto
description: >-
  Process the validated approved task plan automatically through contract-driven implementation, verification, bounded correction, review, and acceptance.
---

# /dk-build-auto

## Lifecycle Entry Gate

At session start or command invocation, execute the centralized lifecycle entry adapter:
```bash
node scripts/lifecycle.mjs --command=dk-build-auto --phase=entry
```
This establishes and validates project bootstrap, binds project identity, and verifies execution context.

## Purpose

Processes the approved PLAN sequentially while preserving the same v0.9 control plane as `/dk-build`. Automation may remove repetitive handoffs, but it may not weaken evidence, safety, review, or human approval gates.

## Workflow

For each task:
1. Select the next approved task from the deterministically validated PLAN.
2. Resolve/create its Development Contract and run manifest.
3. Rehydrate authoritative sources and choose the host execution strategy. Use native isolated sub-agents when available; otherwise use sequential fresh-context execution.
4. Implement in a fresh implementation context. Implementation output is non-authoritative evidence.
5. Preflight consequential commands through execution safety before execution.
6. Independently verify every acceptance criterion and required control.
7. Run the risk/impact-selected structured reviews.
8. Ask the runtime acceptance engine for `ACCEPTED`, `PENDING`, or `BLOCKED`.
9. On a correctable implementation failure, use the correction engine. Continue automatically only when the decision is `CORRECT`; persist the failure signature and exact correction scope.
10. Reverify after every correction. Stop correction on repeat failure, maximum attempts, high-risk/security/architecture/design ambiguity, source staleness, scope expansion, or a consequential human gate.
11. Continue to the next task only after acceptance is `ACCEPTED`.

## Auto-Pause Conditions

Pause and surface the precise gate when:
- verification is PARTIAL, UNVERIFIED, or blocked by stale sources;
- correction engine returns `PAUSE`;
- a required reviewer/control manifest is incomplete or failed;
- architecture drift is unauthorized or needs a decision;
- Design Authority or required visual evidence is unresolved;
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
- `verification-before-completion`
- `regression-testing`

## Output

Cumulative progress by contract/run, current correction attempt, verification/control coverage, outstanding gates, accepted tasks, and the exact reason for any pause.
