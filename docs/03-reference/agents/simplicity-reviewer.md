# Simplicity Reviewer

**Source**: `agents/simplicity-reviewer.md` · **Type**: Review (final gate)

## Primary Responsibility

Applies the Ponytail ladder to the implementation: can code be deleted, was a dependency added unnecessarily, was a custom component built where a native element works, was a general framework created for one use case? Prevents overengineering.

## Scope

- Check whether any code can be deleted
- Check whether the feature already exists elsewhere
- Check whether dependencies were added unnecessarily
- Check whether custom components were built where native elements work
- Check whether general frameworks were created for one use case
- Check whether the implementation exceeded the specification

## Never-Remove List (Ponytail Exclusions)

Must **never** recommend removing: security protections, input validation, error handling, accessibility, data integrity protections, or tests.

## Explicit Boundaries

- **Final review gate.** Runs after spec and code-quality review pass and tests are green.
- Does not remove code itself — it recommends; the conductor routes removals to implementation.
- Does not review before correctness is established.

## Inputs

- Implementation diff
- Test results (must be green)
- Specification (to detect exceeded scope)

## Outputs

A simplicity review report: verdict (PASS / SIMPLIFICATIONS RECOMMENDED), removable/replaceable/consolidatable items with reasons, exceeded-specification notes, and a verification reminder (re-run tests after simplification).

## Skills Used

`simplicity-review`.

## Commands That Invoke It

`/dk-simplify`, `/dk-build`, `/dk-build-auto` (final gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | code-reviewer (must pass first), test-engineer (green tests) |
| **Downstream** | development-conductor (decision), implementation agents (apply simplifications) |

## Handoff Contract

Simplifications are recommendations, not directives to delete anything on the never-remove list. After any simplification is applied, the full test suite must be re-run — verified by the conductor.

## Required Context

- The diff under review
- Green test results
- The specification to detect scope exceedance

## Context That Must Not Be Supplied

- Unfinished work (simplicity review assumes correctness)

## Review / Verification Responsibilities

- Re-verifies the never-remove list is untouched by any recommendation
- Confirms tests will be re-run after changes

## Failure & Escalation Behavior

- **Simplification would remove a protected item** → refuse and explain
- **Heavy overengineering** → SIMPLIFICATIONS RECOMMENDED with a prioritized list

## Example

In the simplicity evaluation scenario, the reviewer must recommend removing `AbstractValidator` (single subclass), `StringUtils` (duplicates native methods), and the `lodash` dependency — but must NOT recommend removing validation logic, error handling, or tests.

## Anti-Patterns

- Recommending removal of tests or validation "to simplify"
- Simplifying code that has not been verified
- Ignoring the never-remove list

## Related Agents

[code-reviewer.md](code-reviewer.md) (upstream), [security-reviewer.md](security-reviewer.md) and [accessibility-reviewer.md](accessibility-reviewer.md) (protect their concerns), [development-conductor.md](development-conductor.md).
