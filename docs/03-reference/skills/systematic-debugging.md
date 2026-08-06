# systematic-debugging

**Source**: `skills/systematic-debugging/SKILL.md` · **Category**: Verification · **Compatibility**: `opencode`

## Purpose

Uses a structured reproduce-localise-fix-protect cycle. Does not guess at fixes — follows evidence.

## Lifecycle Category

VERIFY / recovery.

## Trigger Conditions

- Bug reports or failures
- `/dk-debug` invocation

## When Not to Invoke

- When implementing a feature (not debugging)

## Required Inputs

- The failure report or reproducing input

## Preconditions

- A failure is observable

## Procedure

1. **Reproduce** the failure deterministically.
2. **Locate** the root cause with evidence.
3. **Fix** the root cause minimally.
4. **Protect** against regression with a test.

## Outputs

- Root-cause analysis, minimal fix, and a regression test

## Invariants

- Evidence-driven — no guessing.
- The protect step is mandatory (regression test).

## Dependencies

`test-driven-development`, `regression-testing`.

## Related Agents

repository-scout-agent (context), test-engineer (reproduction), implementation agents (fix).

## Related Commands

`/dk-debug` (primary).

## Verification Requirements

- [ ] Failure reproduced
- [ ] Root cause identified
- [ ] Regression test added

## Failure Behavior

- Failure to reproduce is itself reported — no fix without reproduction.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

A slow search: reproduce with a large dataset → locate an N+1 query → fix the query → add a regression test on response time.

## Anti-Patterns

- Random guess-and-patch fixes
- Skipping the regression test

## Maintenance Notes

None specific.
