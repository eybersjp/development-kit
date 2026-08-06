# task-completion-gate

**Source**: `skills/task-completion-gate/SKILL.md` · **Category**: Completion · **Compatibility**: `opencode`

## Purpose

Defines the gate that every task must pass before it is considered complete. A task passes only when acceptance criteria pass, tests pass, spec review passes, code review passes, and simplification review passes.

## Lifecycle Category

COMPLETE.

## Trigger Conditions

- At the end of every task in `/dk-build` / `/dk-build-auto`
- Before a branch or release completion claim

## When Not to Invoke

- Mid-implementation (the gate is a terminal check)

## Required Inputs

- The task's gate results: acceptance criteria, tests, spec review, code review, conditional reviews, simplicity review

## Preconditions

- All individual gates have been run

## Procedure

1. Collect the gate results.
2. Apply the gate decision matrix: all gates pass → complete; any gate fails → not complete.
3. Record the decision and block the next task if not complete.

## Outputs

- A completion decision per task

## Invariants

- A task is complete **only** when all gates pass — no exceptions.
- The next task never starts while the current task has unresolved failures.

## Dependencies

`specification-compliance-review`, `code-quality-review`, `simplicity-review`, `verification-before-completion`.

## Related Agents

development-conductor (gate keeper).

## Related Commands

`/dk-build`, `/dk-build-auto`, `/dk-ship` (supporting skill).

## Verification Requirements

- [ ] All gates collected
- [ ] Decision recorded

## Failure Behavior

- Any failing gate marks the task incomplete and blocks the next task.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

`hooks/after-task.js` (`verifyTaskGates`) implements the gate: functional verification, spec compliance, code quality, security (default pass), and simplicity must all pass.

## Anti-Patterns

- Declaring completion on the implementer's word
- Starting the next task with a failed gate

## Maintenance Notes

Keep aligned with `hooks/after-task.js` and `hooks/before-completion.js`.
