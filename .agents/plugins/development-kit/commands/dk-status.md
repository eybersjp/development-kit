---
name: dk-status
description: >-
  Show the current lifecycle and contract-driven orchestration state, including active contract, verification, correction, review and acceptance gates.
---

# /dk-status

## Lifecycle Entry Gate

At session start or command invocation, execute the centralized lifecycle entry adapter:
```bash
node scripts/lifecycle.mjs --command=dk-status --phase=entry
```
This establishes and validates project bootstrap, binds project identity, and verifies execution context.

## Purpose

Shows concise Development Kit progress without hiding unresolved control-plane state.

## Workflow

1. Inspect project-local `.development-kit/` state. If absent, report `Uninitialized` and explain that a lifecycle command will bootstrap the project.
2. Read the current Autopilot state when present.
3. If `state.orchestration` exists, report its compact references and use the run manifest/evidence files under `.development-kit/runs/` for detail rather than treating agent summaries as truth.
4. Check whether the active Development Contract is stale before reporting it as executable.
5. Report only persisted/computed gate states.

## Output

```text
## Status Report
Lifecycle stage: <stage>
Current task: <task>
Workflow status: <status>

Contract-driven orchestration, when active:
- Contract: <activeContractId>
- Run: <activeRunId>
- Source fingerprint: <fingerprint>
- Risk: <0-4>
- Correction attempt: <n>
- Verification: PASS / FAIL / INCOMPLETE / pending
- Acceptance: ACCEPTED / PENDING / BLOCKED
- Required gates: <list>
- Completed gates: <list>
- Contract stale: yes / no

Pending reviews/controls/approvals: <list>
Blocked items: <exact reasons>
Design Authority when applicable: <state/version/last verification>
Suggested next action: <command>
```

## Rules

- Never call a task Done solely because implementation/tests reported success.
- Surface PARTIAL/UNVERIFIED required controls explicitly.
- If no contract-driven state exists, remain backward-compatible with the existing lifecycle status view.

## Skills Activated

- `skill-routing`
- `using-development-kit`

## Sub-Agents

None. This command is informational only.
