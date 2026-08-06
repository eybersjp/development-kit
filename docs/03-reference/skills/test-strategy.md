# test-strategy

**Source**: `skills/test-strategy/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Defines how a feature will be proven correct. Specifies the test levels, types, coverage targets, and acceptance-criteria validation approach.

## Lifecycle Category

PLAN (defines verification).

## Trigger Conditions

- Before implementation, to plan verification
- When a task needs its verification types defined

## When Not to Invoke

- When the verification approach is already defined for the task

## Required Inputs

- The specification's acceptance criteria
- The feature's technical design

## Preconditions

- Acceptance criteria exist

## Procedure

1. Map acceptance criteria to test levels: unit, integration, browser.
2. Define test types and coverage targets.
3. Specify how each criterion will be validated.
4. Document the strategy.

## Outputs

A test strategy (template: `Test Strategy: [Feature Name]` in the skill).

## Invariants

- Every acceptance criterion has a validation path.
- Coverage targets are realistic, not aspirational.

## Dependencies

`acceptance-criteria-writing`.

## Related Agents

test-engineer (primary executor).

## Related Commands

`/dk-tasks`, `/dk-build` (supporting skill).

## Verification Requirements

- [ ] Criteria mapped to test levels
- [ ] Coverage targets specified

## Failure Behavior

- Criteria without a validation path are flagged before implementation.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a validation function: unit tests for valid/invalid/edge inputs (per the TDD evaluation), plus a browser check for the form UX.

## Anti-Patterns

- Testing only happy paths
- Coverage targets disconnected from acceptance criteria

## Maintenance Notes

None specific.
