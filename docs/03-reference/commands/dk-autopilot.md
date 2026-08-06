# `/dk-autopilot`

**Source**: `commands/dk-autopilot.md` · **Lifecycle Stage**: ALL (Lifecycle-Wide)

## Purpose

Executes the complete Development Kit software-development lifecycle in Automated Guided Workflow mode. Manages the complete lifecycle from project discovery through release preparation (`UNDERSTAND` → `DEFINE` → `DESIGN` → `PLAN` → `IMPLEMENT` → `VERIFY` → `REVIEW` → `SIMPLIFY` → `COMPLETE`).

## When to Use

- Starting a new feature, project, or lifecycle workflow.
- You want guided, automated management across all nine lifecycle stages with deterministic state tracking.

## Lifecycle Stage Sequence

1. **UNDERSTAND**: Product discovery and requirements interview (`/dk-idea`)
2. **DEFINE**: Specification creation (`/dk-spec`)
3. **DESIGN**: Technical architecture design (`/dk-design`)
4. **PLAN**: Task decomposition and risk ordering (`/dk-tasks`)
5. **IMPLEMENT**: Task execution loop with fresh sub-agents (`/dk-build`)
6. **VERIFY**: Browser runtime and edge-case testing (`/dk-test`)
7. **REVIEW**: Multi-axis review pipeline (`/dk-review`)
8. **SIMPLIFY**: Ponytail ladder reduction (`/dk-simplify`)
9. **COMPLETE**: Release readiness and completion (`/dk-ship`)

## Auto-Pause Conditions

`/dk-autopilot` pauses and requests explicit user approval when:
- Scope acceptance is required
- Destructive file or database operations are encountered
- Authentication/authorization logic or credentials change
- Security risk acceptance is required
- Remote repository Git push, pull-request creation/merge, or branch deletion occurs
- Production release tags or deployments are created

## Skills Invoked

`using-development-kit`, `idea-discovery`, `feature-specification`, `technical-design`, `task-decomposition`, `subagent-driven-implementation`, `browser-runtime-verification`, `code-quality-review`, `simplicity-review`, `release-readiness`

## Agents Invoked

- `development-conductor`
- `product-discovery-agent`
- `specification-agent`
- `solution-architect-agent`
- `task-planner-agent`
- `implementation-agent`
- `test-engineer`
- `code-reviewer`
- `simplicity-reviewer`

## Related Commands

- `/dk-build-auto` — automate implementation tasks after planning
- `/dk-status` — check current Autopilot workflow state
