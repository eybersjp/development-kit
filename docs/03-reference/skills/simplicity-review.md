# simplicity-review

**Source**: `skills/simplicity-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

Ponytail-style minimum-solution inspection. Checks whether code, abstractions, dependencies, or files can be removed. Prevents overengineering.

## Lifecycle Category

REVIEW (final gate) / SIMPLIFY.

## Trigger Conditions

- After implementation passes spec and code-quality review with green tests
- `/dk-simplify` invocation
- Final gate in `/dk-build` / `/dk-build-auto`

## When Not to Invoke

- Before correctness is established (tests must be green)

## Required Inputs

- The implementation diff and green test results

## Preconditions

- Tests pass; compliance and quality reviews passed

## Procedure

1. Apply the Ponytail ladder to every change: can code be deleted? Does the feature already exist? Was a dependency added unnecessarily? Was a native element replaced by a custom component? Was a general framework created for one use case? Did the implementation exceed the spec?
2. Measure every deletion against the never-remove list.
3. Recommend removals/replacements/consolidations.
4. Require re-running the test suite after any simplification.

## Outputs

- A simplicity verdict: PASS or SIMPLIFICATIONS RECOMMENDED

## Invariants

- **Never remove**: security protections, input validation, error handling, accessibility, data integrity protections, tests.

## Dependencies

`verification-before-completion` (re-verify after changes).

## Related Agents

simplicity-reviewer (primary).

## Related Commands

`/dk-simplify` (primary), `/dk-build`, `/dk-build-auto`, `/dk-review`.

## Verification Requirements

- [ ] Every removal checked against the never-remove list
- [ ] Tests re-run after changes

## Failure Behavior

- A recommendation touching the never-remove list is refused.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/simplicity-review/scenario-01-overengineering.json`: remove `AbstractValidator` (single subclass), `StringUtils` (duplicates native methods), and `lodash` — but keep validation logic, error handling, and tests.

## Anti-Patterns

- Removing tests or validation "to simplify"
- Simplifying unverified code

## Maintenance Notes

Evaluated by `evals/simplicity-review/`.
