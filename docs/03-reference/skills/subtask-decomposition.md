# subtask-decomposition

**Source**: `skills/subtask-decomposition/SKILL.md` · **Category**: Planning · **Compatibility**: `opencode`

## Purpose

Breaks each task into atomic, ordered steps. Ensures every task has a clear, executable sequence of work items.

## Lifecycle Category

PLAN.

## Trigger Conditions

- Each task in the plan needs atomic steps
- TDD-first ordering (test step before implementation step)

## When Not to Invoke

- When a task is already atomic (a single step)

## Required Inputs

- The task's requirements and acceptance criteria

## Preconditions

- Tasks are decomposed

## Procedure

1. For each task, list the atomic steps.
2. Order steps: tests first where behaviour changes, core logic before edge cases.
3. Ensure each step is independently executable.

## Outputs

Ordered subtask lists per task.

## Invariants

- Steps atomic and ordered.
- Test-first ordering for behaviour changes.

## Dependencies

`task-decomposition`.

## Related Agents

task-planner-agent (primary).

## Related Commands

`/dk-tasks` (supporting skill).

## Verification Requirements

- [ ] Every task has an ordered step list
- [ ] Steps are atomic

## Failure Behavior

- Steps that cannot be executed independently are reworked.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For the "input validation" task: 1) write failing validation tests, 2) implement validators, 3) wire into endpoint, 4) run integration tests.

## Anti-Patterns

- Steps that bundle multiple concerns
- Implementation before tests for behaviour changes

## Maintenance Notes

None specific.
