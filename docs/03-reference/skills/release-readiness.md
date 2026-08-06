# release-readiness

**Source**: `skills/release-readiness/SKILL.md` · **Category**: Completion · **Compatibility**: `opencode`

## Purpose

Performs the broader pre-release check: full test suite, security scan, performance check, documentation review, and deployment preparation.

## Lifecycle Category

COMPLETE.

## Trigger Conditions

- Before a release
- `/dk-ship` for release preparation

## When Not to Invoke

- For normal task completion (task-completion-gate suffices)

## Required Inputs

- The full project state: tests, docs, dependencies, deployment targets

## Preconditions

- Branch completion passed

## Procedure

1. Run the full test suite.
2. Run security checks (dependencies, secrets).
3. Check performance for expected load.
4. Review documentation currency.
5. Prepare deployment notes.
6. Report against the release-readiness checklist in the skill.

## Outputs

- A release-readiness verdict with the completed checklist

## Invariants

- All checklist items pass before release; nothing is "skipped for now".

## Dependencies

`branch-completion`, `task-completion-gate`.

## Related Agents

development-conductor (primary).

## Related Commands

`/dk-ship` (supporting skill).

## Verification Requirements

- [ ] Full suite passes
- [ ] Security scan clean
- [ ] Documentation reviewed

## Failure Behavior

- Failed items block the release verdict.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Before publishing a version, the conductor confirms the suite, dependency vulnerabilities, changelog, and docs are all current — mirroring the CI release gates.

## Anti-Patterns

- Releasing with known failed checks
- Skipping documentation review

## Maintenance Notes

See [docs/08-maintenance-release/release-process.md](../../08-maintenance-release/release-process.md) for the actual release procedure.
