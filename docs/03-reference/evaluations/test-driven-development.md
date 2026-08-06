# Evaluation: test-driven-development

**Source**: `evals/test-driven-development/scenario-01-tdd-cycle.json`

## Skill Being Evaluated

`test-driven-development` — red-green-refactor discipline.

## Evaluation Files

- `evals/test-driven-development/scenario-01-tdd-cycle.json`

## Cases

**Scenario 01 — Implement a function using TDD.** Task: email-validation function — true for valid formats (`user@example.com`, `a.b@c.co`), false for invalid (`@example.com`, `user@`, `user@.com`, empty string), handle edge cases (empty, null, very long input).

## Expected Behaviour

- Red phase observed (test written and failing first)
- Green phase (minimum implementation makes it pass)
- Refactor phase
- Tests written before implementation
- Minimum implementation (no over-engineering)
- Must not implement before test; must not over-engineer

## Scoring / Pass Criteria

All three phases observed in order; tests-first; minimum implementation.

## How to Interpret Failures

- Implementation before tests → red phase absent
- Over-engineered solution → violates minimum-implementation expectation

## How to Add a Case

Add `scenario-02-*.json` with a different function.

## Coverage Limitations

Single function; single language.

## Relationship to Repository Validation

Behavioural only.
