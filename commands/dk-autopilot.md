---
name: dk-autopilot
description: >-
  Take me through the complete Development Kit lifecycle.
  The system will select the correct commands, agents, and skills for each stage automatically.
---

# /dk-autopilot

## Purpose

Executes the complete Development Kit software-development lifecycle in Automated Guided Workflow mode. Coordinates all nine canonical stages (`UNDERSTAND` → `DEFINE` → `DESIGN` → `PLAN` → `IMPLEMENT` → `VERIFY` → `REVIEW` → `SIMPLIFY` → `COMPLETE`) using deterministic next-action issuance, immutable state revisions, and explicit approval policies.

## Workflow

1. **Initialize/Resume Workflow** — Interacts with Autopilot runtime via `node scripts/autopilot.mjs --next` to obtain the current structured action.
2. **Execute Stage Action** — Spawns the assigned specialist agent and activates required skills for the current stage:
   - `UNDERSTAND`: `product-discovery-agent` + `/dk-idea`
   - `DEFINE`: `specification-agent` + `/dk-spec`
   - `DESIGN`: `solution-architect-agent` + `/dk-design`
   - `PLAN`: `task-planner-agent` + `/dk-tasks`
   - `IMPLEMENT`: `implementation-agent` + `/dk-build`
   - `VERIFY`: `test-engineer` + `/dk-test`
   - `REVIEW`: `code-reviewer` + `/dk-review`
   - `SIMPLIFY`: `simplicity-reviewer` + `/dk-simplify`
   - `COMPLETE`: `development-conductor` + `/dk-ship`
3. **Record Action Result** — Submits action outputs and gate status via `node scripts/autopilot.mjs --record-result --input-file=<path>`.
4. **Enforce Approval Gates** — Evaluates gate policy table. If approval is required (e.g. scope acceptance, git push, PR creation), pauses for explicit user token confirmation.

## Skills Activated

Primary:
- `using-development-kit` — Master lifecycle routing and rules

Supporting:
- `idea-discovery` — Requirements interview and idea challenge
- `feature-specification` — Minimum required artifact specification
- `technical-design` — Architecture and interface design
- `task-decomposition` — Task breakdown and risk ordering
- `subagent-driven-implementation` — Fresh sub-agent per task
- `browser-runtime-verification` — Browser runtime testing
- `code-quality-review` — Multi-axis code review
- `simplicity-review` — Ponytail ladder reduction
- `release-readiness` — Pre-release validation

## Sub-Agents

- `development-conductor`
- `product-discovery-agent`
- `specification-agent`
- `solution-architect-agent`
- `task-planner-agent`
- `implementation-agent`
- `test-engineer`
- `code-reviewer`
- `simplicity-reviewer`

## Output

Structured status updates showing:
- Active lifecycle stage
- State revision number
- Issued next action
- Mandatory review gates and approval status
- Completed lifecycle progression
