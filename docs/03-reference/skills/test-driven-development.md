# test-driven-development

**Source**: `skills/test-driven-development/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Enforces Red-Green-Refactor discipline. Tests are written before implementation code for behaviour changes.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Any behavioural change to implement
- Every implementation task that alters behaviour

## When Not to Invoke

- For documentation or configuration-only changes with no behaviour change

## Required Inputs

- The task's acceptance criteria and required tests

## Preconditions

- Acceptance criteria exist

## Procedure

1. **RED** — write a failing test that defines the expected behaviour; confirm it fails.
2. **GREEN** — write the minimum code to make it pass.
3. **REFACTOR** — improve the code while keeping tests green.
4. Cover edge cases per the testing-layers and coverage-priorities guidance in the skill.

## Outputs

- Tests written first, then minimal passing implementation

## Invariants

- Tests precede implementation for behaviour changes.
- Minimum implementation to green — no over-engineering.

## Dependencies

`test-strategy`, `edge-case-testing`.

## Related Agents

implementation agents (apply), test-engineer (verify).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Red phase observed (test fails before implementation)
- [ ] Green phase (test passes)
- [ ] Refactor keeps tests green

## Failure Behavior

- Implementation-before-test is a violation and is routed back.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/test-driven-development/scenario-01-tdd-cycle.json`: an email-validation function is implemented via red (failing tests for valid/invalid/edge inputs) → green (minimal function) → refactor.

## Anti-Patterns

- Implementing before writing the test
- Over-engineering the minimum solution
- Tests that mirror implementation

## Maintenance Notes

Evaluated by `evals/test-driven-development/`.
