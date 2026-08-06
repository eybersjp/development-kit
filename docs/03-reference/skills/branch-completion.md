# branch-completion

**Source**: `skills/branch-completion/SKILL.md` · **Category**: Completion · **Compatibility**: `opencode`

## Purpose

Handles final verification before a branch or task is completed: full test suite, diff inspection, commit preparation, and PR preparation.

## Lifecycle Category

COMPLETE.

## Trigger Conditions

- All tasks complete and ready to close the branch
- `/dk-ship` invocation

## When Not to Invoke

- Before all tasks pass their completion gates

## Required Inputs

- The branch's full diff and test results

## Preconditions

- All task-completion gates passed

## Procedure

1. Run the full test suite.
2. Inspect the complete diff (scope, secrets, unintended files).
3. Prepare the commit message (template in the skill) and PR description (template in the skill).
4. Verify the branch is ready to close.

## Outputs

- A completion verdict, commit message, and PR description

## Invariants

- Full suite passes before branch completion.
- Diff inspection includes a secrets check.

## Dependencies

`task-completion-gate`, `verification-before-completion`.

## Related Agents

development-conductor (primary).

## Related Commands

`/dk-ship` (primary).

## Verification Requirements

- [ ] Full suite run
- [ ] Diff inspected
- [ ] Commit/PR materials prepared

## Failure Behavior

- Diff issues (secrets, stray files) block completion until resolved.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Before closing a feature branch, the conductor runs the suite, confirms no secrets or build artifacts are in the diff, and prepares the conventional commit message.

## Anti-Patterns

- Committing without the full suite
- Leaving secrets or artifacts in the diff

## Maintenance Notes

None specific.
