# Evaluation: code-quality-review

**Source**: `evals/code-quality-review/scenario-01-messy-code.json`

## Skill Being Evaluated

`code-quality-review` — assessing code quality as the second review gate.

## Evaluation Files

- `evals/code-quality-review/scenario-01-messy-code.json`

## Cases

**Scenario 01 — Review a pull request with common code quality issues.** Implementation: `processUserData` uses `any`, string-concatenated fetch URL, unclear variable names, `==`, a leftover `console.log`, no error handling, no input validation on `req.body`.

## Expected Behaviour

- Identify: `any` type, concatenated fetch URL (injection risk), unclear names, `==` vs `===`, leftover console.log, missing error handling, missing input validation
- Verdict must contain "FAIL"
- At least 2 critical issues
- Must not approve without changes

## Scoring / Pass Criteria

All seven issues identified; verdict FAIL; ≥2 critical.

## How to Run

Present the code snippets to an agent applying the skill; compare findings against `expected.should_identify`.

## How to Interpret Failures

- Missing issues → incomplete review coverage
- Verdict not FAIL → severity misjudgement
- Approval without changes → critical failure

## How to Add a Case

Add `scenario-02-*.json` with different anti-patterns (e.g. security or performance-focused).

## Coverage Limitations

Single TypeScript-style case; no language-matrix coverage.

## Relationship to Repository Validation

Behavioural only; not executed by the validator.
