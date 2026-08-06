# /dk-ship

**Source**: `commands/dk-ship.md` · **Lifecycle Stage**: COMPLETE

## Purpose

Performs final verification and release preparation. Runs the full test suite, inspects the diff, verifies task completion gates, checks release readiness, and prepares the commit. This is the final gate before work is considered ready to merge.

## When to Use

- All tasks are complete.
- All reviews have passed.
- Work is ready to be merged or released.

## When NOT to Use

- Tasks are incomplete or have unresolved review findings.
- Tests do not pass.

## Workflow

1. **Task Completion Gate**: Verify every task has passed all gates (acceptance criteria, tests, spec review, code review, simplicity review). Stop and report incomplete tasks.
2. **Final Test Suite**: Run unit tests, integration tests, browser tests, type checking, linting.
3. **Full Review Cycle**: `spec-reviewer` and `code-reviewer` review the full diff.
4. **Documentation Check**: Verify README, API docs, changelog, and migration notes are updated.
5. **Simplicity Review**: `simplicity-reviewer` checks the full diff for unnecessary code.
6. **Release Readiness Assessment**: Dependency audit, secrets scan, build verification, rollback plan.
7. **Commit Preparation**: Descriptive commit message with task references and change summary.
8. **Branch Completion**: Final diff inspection, PR description prepared.

## Pause Conditions

`/dk-ship` stops and reports issues when:
- Any task has not passed all gates
- Tests fail
- Review finds critical issues
- Secrets are detected in the diff
- Documentation is not updated

> [!IMPORTANT]
> `/dk-ship` never pushes to remote, merges PRs, or publishes to npm unless explicitly instructed by the user.

## Skills Invoked

`branch-completion`, `task-completion-gate`, `release-readiness`, `specification-compliance-review`, `code-quality-review`, `simplicity-review`, `regression-testing`

## Agents Invoked

- `spec-reviewer`
- `code-reviewer`
- `simplicity-reviewer`

## Outputs

Ship report including:
- Task completion gate status
- Test results
- Review results
- Documentation status
- Release readiness assessment
- Commit summary
- Go/no-go recommendation

## Related Commands

- `/dk-simplify` — previous step
- `/dk-status` — check completion status
