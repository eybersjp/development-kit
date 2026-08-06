# regression-testing

**Source**: `skills/regression-testing/SKILL.md` · **Category**: Verification · **Compatibility**: `opencode`

## Purpose

Checks that existing behaviour remains intact after changes. Runs the existing test suite and verifies no previously passing tests fail.

## Lifecycle Category

VERIFY.

## Trigger Conditions

- After any implementation change
- Before task completion claims

## When Not to Invoke

- When the suite has just been run with no changes since

## Required Inputs

- The existing test suite and the change being verified

## Preconditions

- A baseline suite exists

## Procedure

1. Run the existing test suite.
2. Compare against the baseline — no previously passing test may fail.
3. Investigate any regression to root cause.
4. Report (template: `Regression Test Report` in the skill).

## Outputs

- A regression report with pass/fail vs baseline

## Invariants

- No previously passing test may fail.
- Regression fixes are protected with tests.

## Dependencies

`test-driven-development`, `systematic-debugging`.

## Related Agents

test-engineer (primary).

## Related Commands

`/dk-test` (supporting), `/dk-build`, `/dk-build-auto`, `/dk-debug`.

## Verification Requirements

- [ ] Full suite run
- [ ] Baseline comparison reported

## Failure Behavior

- Any regression blocks completion until root-caused and fixed.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

After refactoring a shared utility, the engineer runs the full suite and confirms all 48 previously passing tests still pass.

## Anti-Patterns

- Running only the touched module's tests
- Hiding regressions as "pre-existing"

## Maintenance Notes

None specific.
