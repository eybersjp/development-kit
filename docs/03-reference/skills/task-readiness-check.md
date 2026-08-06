# task-readiness-check

**Source**: `skills/task-readiness-check/SKILL.md` · **Category**: Planning · **Compatibility**: `opencode`

## Purpose

Verifies that a task is clear enough to implement. Prevents starting work on tasks that are ambiguous, incomplete, or missing acceptance criteria.

## Lifecycle Category

PLAN → IMPLEMENT boundary.

## Trigger Conditions

- Before spawning any implementation agent
- Re-check before each task begins in `/dk-build` / `/dk-build-auto`

## When Not to Invoke

- When the task is already validated and unchanged

## Required Inputs

- The task definition (objective, requirements, acceptance criteria, verification, exclusions)

## Preconditions

- The task is selected from the plan

## Procedure

1. Check the task has an objective, requirements, acceptance criteria, verification, and exclusions.
2. Check criteria are testable and the task is independently verifiable.
3. Report ready / not-ready with the specific issues.

## Outputs

A readiness verdict with the list of blocking issues.

## Invariants

- No implementation starts on a task that fails the check.
- Missing exclusions is itself an issue (use an empty list if none).

## Dependencies

`task-decomposition`.

## Related Agents

task-planner-agent, development-conductor (gate keeper).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Objective, requirements, criteria, verification, exclusions present
- [ ] Criteria testable

## Failure Behavior

- Not-ready tasks are returned to the planner with the specific gaps.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

`hooks/before-task.js` implements the same validation (`validateTaskReadiness`): objective, requirements, acceptance criteria, verification, and exclusions are all required.

## Anti-Patterns

- Starting implementation on a vague task
- Skipping the re-check between plan and build

## Maintenance Notes

Keep aligned with `hooks/before-task.js`.
