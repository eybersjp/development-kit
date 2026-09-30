---
name: dk-status
description: >-
  Show the current lifecycle and contract-driven orchestration state, including active contract, verification, correction, review and acceptance gates.
---

# /dk-status

## Purpose

Shows concise Development Kit progress without hiding unresolved control-plane state.

## Workflow

1. Inspect project-local `.development-kit/` state. If absent, report `Uninitialized` and explain that a lifecycle command will bootstrap the project.
2. Read project Git status and source-control readiness (Git availability, repository detected/initialized/relationship, and `.gitignore` status).
3. Read the current Autopilot state when present.
4. If `state.orchestration` exists, report its compact references and use the run manifest/evidence files under `.development-kit/runs/` for detail rather than treating agent summaries as truth.
5. Check whether the active Development Contract is stale before reporting it as executable.
6. Report only persisted/computed gate states.

## Output

```text
## Status Report
Lifecycle stage: <stage>
Current task: <task>
Workflow status: <status>

Source-control readiness:
- Git available: yes / no
- Repository: detected (<relationship>) / none
- Repository root: <path>
- .gitignore: reconciled (created / updated / up-to-date)

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

Secrets & Configuration Readiness Gate:
- Gate state: READY / WAITING_FOR_USER / BLOCKED / CLEARED_WITH_DEFERRED_REQUIREMENTS / NOT_APPLICABLE
- Requirements: <total> total (<valid> valid, <missing> missing, <invalid> invalid, <deferred> deferred)
- Blocking requirements: <list or none>
- Deferred requirements: <list or none>
- Product Owner action required: yes / no
- Setup guide: .development-kit/SECRETS_SETUP.md

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
