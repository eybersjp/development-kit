# acceptance-criteria-writing

**Source**: `skills/acceptance-criteria-writing/SKILL.md` · **Category**: Idea & Definition · **Compatibility**: `opencode`

## Purpose

Converts requirements into observable, testable conditions that define when a feature is complete and correct.

## Lifecycle Category

DEFINE.

## Trigger Conditions

- Writing or reviewing a specification
- Converting vague requirements ("should be fast") into measurable conditions

## When Not to Invoke

- When acceptance criteria already exist and are testable

## Required Inputs

- The requirements to convert

## Preconditions

- Requirements are at least articulated

## Procedure

1. For each requirement, define a measurable condition and observable outcome.
2. Reject vague terms ("fast", "quick", "easy", "graceful") and non-verifiable conditions.
3. Keep behaviour (not implementation details) in the criteria.
4. Produce the criteria list with a minimum count appropriate to the feature.

## Outputs

A list of testable acceptance criteria.

## Invariants

- Every criterion is testable, specific, independent, and minimal.
- No vague terms; no implementation details.

## Dependencies

`scope-definition` (boundaries), `feature-specification` (container).

## Related Agents

specification-agent (primary writer).

## Related Commands

`/dk-spec` (supporting skill).

## Verification Requirements

- [ ] Each criterion has a measurable condition and observable outcome
- [ ] Vague terms absent

## Failure Behavior

- Vague criteria are rewritten before the spec is approved.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/acceptance-criteria-writing/scenario-01-vague-criteria.json`: "The search should be fast" → "search returns results within 2 seconds"; "the page should load quickly" → "page loads under 1 second (LCP < 1s)".

## Anti-Patterns

- Leaving criteria vague
- Writing implementation details instead of behaviour

## Maintenance Notes

Evaluated by `evals/acceptance-criteria-writing/`.
