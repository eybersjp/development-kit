# edge-case-testing

**Source**: `skills/edge-case-testing/SKILL.md` · **Category**: Verification · **Compatibility**: `opencode`

## Purpose

Actively searches for failure scenarios, boundary conditions, and unexpected inputs. Tests are designed to break the implementation.

## Lifecycle Category

VERIFY.

## Trigger Conditions

- Verification of any implementation
- Tasks with input handling, boundaries, or concurrency

## When Not to Invoke

- When edge cases are already covered by existing tests

## Required Inputs

- The implementation and its input surface

## Preconditions

- Core tests pass

## Procedure

1. Identify boundary values, empty/null inputs, invalid formats, concurrency, network failures, permissions, and large data volumes.
2. Write and run tests designed to fail the implementation.
3. Fix or report findings.
4. Report (template: `Edge Case Testing: [Feature]` in the skill).

## Outputs

- Edge-case test results and fixed/remaining findings

## Invariants

- Tests are adversarial — designed to break the implementation.
- Found failures are fixed or explicitly reported, never hidden.

## Dependencies

`test-driven-development`.

## Related Agents

test-engineer (primary).

## Related Commands

`/dk-test` (supporting skill).

## Verification Requirements

- [ ] Boundary and invalid inputs tested
- [ ] Unhappy paths covered

## Failure Behavior

- Unhandled edge cases are surfaced as findings for the implementation.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For the email-validation function: empty string, `null`, very long input, and malformed formats are all tested (per the TDD evaluation scenario).

## Anti-Patterns

- Testing only happy paths
- Ignoring boundary values

## Maintenance Notes

None specific.
