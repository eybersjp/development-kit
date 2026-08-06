# specification-compliance-review

**Source**: `skills/specification-compliance-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

The first gate in the two-stage review process. Verifies that the implementation satisfies the specification, before assessing code quality.

## Lifecycle Category

REVIEW (gate 1).

## Trigger Conditions

- After implementation and verification
- Always, before code-quality review

## When Not to Invoke

- When the implementation does not exist yet

## Required Inputs

- The specification (requirements, acceptance criteria, exclusions)
- The implementation diff and test results

## Preconditions

- Implementation exists and tests pass

## Procedure

1. Verify every acceptance criterion from the implementation (not from claims).
2. Check all requirements addressed; check exclusions respected.
3. Identify non-compliance, scope creep, and exclusion violations.
4. Produce the verdict (template: `Compliance Categories` in the skill).

## Outputs

- A compliance verdict: PASS / FAIL with the specific evidence

## Invariants

- Compliance is verified from the implementation itself.
- Runs before code-quality review — the order never reverses.

## Dependencies

`feature-specification`, `acceptance-criteria-writing`.

## Related Agents

spec-reviewer (primary).

## Related Commands

`/dk-review` (primary), `/dk-build`, `/dk-build-auto`.

## Verification Requirements

- [ ] Every criterion verified with evidence
- [ ] Exclusions checked

## Failure Behavior

- FAIL routes back to implementation; code-quality review does not start until PASS.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/specification-compliance-review/scenario-01-spec-compliance.json`: 4 in-scope requirements pass but "avatar upload added" (excluded) is flagged as scope creep — verdict FAIL.

## Anti-Patterns

- Reviewing style during compliance review
- Passing on the implementer's word

## Maintenance Notes

Evaluated by `evals/specification-compliance-review/`.
