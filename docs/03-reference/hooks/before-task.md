# before-task

**Source**: `hooks/before-task.js` · **Language**: JavaScript (CommonJS)

## Trigger Point

Runs before each implementation task begins.

## Purpose

- Validate that the previous task completed all gates (if applicable)
- Verify the task is clearly defined with acceptance criteria
- Check that verification is specified
- Load relevant skills for the task type
- Signal the repository-scout for task context

## Inputs

- `task` object: `objective`, `requirements[]`, `acceptanceCriteria[]`, `verification[]`, `exclusions`

## Outputs

- `validateTaskReadiness(task)` → `{ ready: boolean, issues: string[] }`
- `selectSkillsForTask(task)` → `string[]` of skill names (`subagent-driven-implementation`, plus `test-driven-development` when unit/test verification is present)

## Side Effects

- Skill-selection result informs which skills the conductor loads

## Environment Assumptions

- Node.js with CommonJS; Antigravity hook runtime

## Exit Behavior

Returns the readiness verdict and skill list; the task proceeds only when `ready` is true.

## Blocking Behavior

Conceptually gating: a not-ready task should not start implementation (enforced by the conductor, not by the hook itself).

## Failure Handling

Readiness issues are returned as strings, not thrown.

## Security Considerations

No privileged operations.

## Relationship to Lifecycle

Implements the `task-readiness-check` gate at the PLAN → IMPLEMENT boundary.

## Maintenance Notes

Keep the required-fields contract in sync with [task-readiness-check](../skills/task-readiness-check.md) and the `templates/task-plan.md` structure.
