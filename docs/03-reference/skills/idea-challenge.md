# idea-challenge

**Source**: `skills/idea-challenge/SKILL.md` · **Category**: Idea & Definition · **Compatibility**: `opencode`

## Purpose

Tests whether the proposed solution is solving the real problem. Applies critical thinking to prevent building the wrong thing.

## Lifecycle Category

UNDERSTAND.

## Trigger Conditions

- Before committing to a proposed solution
- When assumptions behind an idea are untested

## When Not to Invoke

- After the concept is approved and defined (scope-definition takes over)

## Required Inputs

- The idea brief or proposed solution

## Preconditions

- The idea has been articulated

## Procedure

1. Identify the stated problem and proposed solution.
2. Ask whether this is the real problem or a symptom.
3. Test for simpler ways to achieve the same outcome.
4. Question assumptions about users, technology, and context.
5. Produce a challenge report with a go/no-go assessment.

## Outputs

A challenge report (real problem, assumptions tested, risks, recommendation).

## Invariants

- Critical thinking precedes commitment — building the wrong thing is the failure to prevent.

## Dependencies

`idea-discovery` output.

## Related Agents

product-discovery-agent (primary).

## Related Commands

`/dk-idea` (supporting skill).

## Verification Requirements

- [ ] Assumptions explicitly tested
- [ ] Simplest alternative considered

## Failure Behavior

- If the solution does not solve the real problem, the concept is reworked before definition.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

"I want a dashboard with AI predictions" is challenged: is the real problem understanding sales, and is AI prediction the simplest way to achieve that outcome? (Per the scope-definition evaluation, AI predictions get excluded from the MVP.)

## Anti-Patterns

- Rubber-stamping ideas
- Confusing symptoms with root problems

## Maintenance Notes

None specific.
