# Evaluation: specification-compliance-review

**Source**: `evals/specification-compliance-review/scenario-01-spec-compliance.json`

## Skill Being Evaluated

`specification-compliance-review` — verifying implementations against specifications (gate 1).

## Evaluation Files

- `evals/specification-compliance-review/scenario-01-spec-compliance.json`

## Cases

**Scenario 01 — Review an implementation against its specification.** Spec: user profile editing — edit display name, edit bio (max 500 chars), save on submit, cancel discards; exclusions: no avatar upload, no email-field change. Implementation facts: all four in-scope behaviours work, email unchanged, **but avatar upload was added**.

## Expected Behaviour

- Pass: display-name editable, bio editable with limit, form saves, cancel discards, email unchanged
- Fail: avatar upload (not in spec) — identified as scope creep
- Verdict: FAIL

## Scoring / Pass Criteria

Four passes + scope-creep identification + verdict FAIL.

## How to Run

Present the spec and implementation facts; compare the verdict and findings.

## How to Interpret Failures

- Verdict PASS despite scope creep → compliance review failure
- Unidentified scope creep → exclusion checking missed

## How to Add a Case

Add `scenario-02-*.json` with other violation types (exclusion violation, missed requirement).

## Coverage Limitations

Single profile-editing scenario.

## Relationship to Repository Validation

Behavioural only.
