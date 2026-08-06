# Evaluation: acceptance-criteria-writing

**Source**: `evals/acceptance-criteria-writing/scenario-01-vague-criteria.json`

## Skill Being Evaluated

`acceptance-criteria-writing` — converting vague requirements into testable criteria.

## Evaluation Files

- `evals/acceptance-criteria-writing/scenario-01-vague-criteria.json`

## Cases

**Scenario 01 — Convert vague requirements into testable acceptance criteria.** Input: requirements like "The search should be fast", "Users should be able to find things easily", "The page should load quickly", "Errors should be handled gracefully".

## Expected Behaviour

- Criteria must be testable, each with a measurable condition and observable outcome
- Sample criteria should include: search results within 2 seconds; autocomplete suggestions after 3 characters; page loads under 1 second (LCP < 1s); user-friendly error state with retry
- Must not accept vague terms ("fast", "quick", "easy", "graceful"), non-verifiable conditions, or implementation details
- Minimum 4 criteria

## Scoring / Pass Criteria

All of: testable criteria produced, ≥4 criteria, no vague terms, no implementation details.

## How to Run

Feed the `input.requirements` to an agent applying the skill; assess the output against `expected`.

## How to Interpret Failures

- Vague terms retained → the agent did not apply the rejection rules
- Fewer than 4 criteria → insufficient coverage
- Implementation details → behaviour-vs-implementation confusion

## How to Add a Case

Add `scenario-02-*.json` with a different requirement set and explicit expectations.

## Coverage Limitations

Single scenario; no multi-requirement-domain coverage.

## Relationship to Repository Validation

Not executed by `npm run validate`; behavioural only.
