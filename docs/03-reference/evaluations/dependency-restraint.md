# Evaluation: dependency-restraint

**Source**: `evals/dependency-restraint/scenario-01-unnecessary-dep.json`

## Skill Being Evaluated

`dependency-restraint` — requiring justification before adding dependencies.

## Evaluation Files

- `evals/dependency-restraint/scenario-01-unnecessary-dep.json`

## Cases

**Scenario 01 — Evaluate a PR that adds unnecessary dependencies.** Dependencies: lodash (debounce once; setTimeout works), moment (one date format; `Intl.DateTimeFormat` available), axios (wraps native fetch), uuid (once; `crypto.randomUUID()` available in Node 20).

## Expected Behaviour

- Reject all four dependencies with native-equivalent reasoning
- Verdict must contain "FAIL"
- Must not approve any dependency
- Must not accept "everyone uses it" as justification

## Scoring / Pass Criteria

All four rejected with correct native alternatives; verdict FAIL.

## How to Run

Present the dependency list and native-API context; compare the verdict and reasoning against `expected`.

## How to Interpret Failures

- Any dependency approved → restraint failure
- Justification "everyone uses it" accepted → violation

## How to Add a Case

Add `scenario-02-*.json` with legitimate vs illegitimate dependencies mixed.

## Coverage Limitations

Node/JS ecosystem only; single scenario.

## Relationship to Repository Validation

Behavioural only; complements the dependency policy in [dependency-policy.md](../../05-developer-guide/dependency-policy.md).
