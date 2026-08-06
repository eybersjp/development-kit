# after-task

**Source**: `hooks/after-task.js` · **Language**: JavaScript (CommonJS)

## Trigger Point

Runs after each implementation task completes.

## Purpose

- Verify all task gates passed
- Record task completion status
- Identify carry-over issues for the next task
- Report a task summary

## Inputs

- `gates` object: `functionalVerification`, `specificationCompliance`, `codeQuality`, `securityReview` (optional, defaults pass), `simplicityReview`
- `task` object (with `id`, `objective`)
- `implementation` object: `filesChanged[]`, `testsAdded[]`, `dependenciesAdded[]`, `openIssues[]`

## Outputs

- `verifyTaskGates(gates)` → `{ allPassed: boolean, gates: [{name, passed}], failedGates: [] }`
- `recordTaskCompletion(task, gates, implementation)` → a completion record (taskId, taskName, completedAt, gatesPassed, filesChanged, testsAdded, dependenciesAdded, issues)

## Side Effects

- Produces the completion record used for `/dk-status` state tracking

## Environment Assumptions

- Node.js with CommonJS; Antigravity hook runtime

## Exit Behavior

Returns gate status and completion record; the conductor decides the next action.

## Blocking Behavior

Non-blocking for execution, but `allPassed: false` must prevent the next task starting (sequential task rule).

## Failure Handling

- `securityReview` is optional — defaults to passed when not supplied
- No throw paths

## Security Considerations

No privileged operations.

## Relationship to Lifecycle

Implements the `task-completion-gate` at the IMPLEMENT → VERIFY/REVIEW boundary.

## Maintenance Notes

Keep the gate list in sync with [task-completion-gate](../skills/task-completion-gate.md) and the review pipeline.
