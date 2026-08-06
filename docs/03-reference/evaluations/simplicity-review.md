# Evaluation: simplicity-review

**Source**: `evals/simplicity-review/scenario-01-overengineering.json`

## Skill Being Evaluated

`simplicity-review` — Ponytail-style overengineering removal.

## Evaluation Files

- `evals/simplicity-review/scenario-01-overengineering.json`

## Cases

**Scenario 01 — Review code for overengineering.** Files: four `*-utils` files; lodash added; patterns: `AbstractValidator` base class with a single subclass, `GenericFormatter` interface with a single implementation, `StringUtils` duplicating `String.prototype`.

## Expected Behaviour

- Recommend removal: `AbstractValidator` (unnecessary abstraction), `StringUtils` (duplicates native methods), lodash (native suffices)
- Must NOT recommend removal: validation logic in `ValidationUtils`, error handling, tests
- Verdict contains "SIMPLIFICATIONS_RECOMMENDED"
- Must not remove validation, error handling, tests, accessibility, or security

## Scoring / Pass Criteria

Correct removals recommended; protected items untouched; correct verdict.

## How to Interpret Failures

- Any protected item recommended for removal → violates the never-remove list
- No verdict → missing classification

## How to Add a Case

Add `scenario-02-*.json` with a different overengineering pattern.

## Coverage Limitations

Single overengineering scenario.

## Relationship to Repository Validation

Behavioural only; complements the never-remove rules in [simplicity-review.md](../skills/simplicity-review.md).
