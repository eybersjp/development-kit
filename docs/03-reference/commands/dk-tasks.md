# /dk-tasks

**Source**: `commands/dk-tasks.md` · **Lifecycle Stage**: PLAN

## Purpose

Breaks an approved design into small, independently verifiable tasks ordered by dependency and risk.

## When to Use

- An approved design document exists.
- Ready to create the implementation plan.

## When NOT to Use

- No approved design — use `/dk-design` first.

## Workflow

1. **Task Decomposition**: `task-planner-agent` breaks work into small, verifiable tasks.
2. **Subtask Decomposition**: Each task broken into atomic, ordered steps.
3. **Dependency Ordering**: Tasks ordered by dependency graph.
4. **Risk-First Planning**: Uncertain or technically risky tasks scheduled before safe, cosmetic work.
5. **Task Readiness Check**: Each task verified to be clear enough to implement.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `task-decomposition` | Primary — breaks design into small tasks |
| `subtask-decomposition` | Atomic steps per task |
| `dependency-ordering` | Correct execution order |
| `risk-first-planning` | Uncertain work scheduled first |
| `task-readiness-check` | Verifies each task is implementable |

## Agents Invoked

- `task-planner-agent` (primary)

## Outputs

A task plan with:
- Tasks ordered by dependency and risk
- Each task: objective, requirements, exclusions, subtasks, acceptance criteria, verification steps

## Related Commands

- `/dk-design` — previous step
- `/dk-build` or `/dk-build-auto` — execution steps
