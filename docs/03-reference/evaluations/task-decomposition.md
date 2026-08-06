# Evaluation: task-decomposition

**Source**: `evals/task-decomposition/scenario-01-api-endpoint.json`

## Skill Being Evaluated

`task-decomposition` — breaking specifications into verifiable tasks.

## Evaluation Files

- `evals/task-decomposition/scenario-01-api-endpoint.json`

## Cases

**Scenario 01 — Break an API endpoint implementation into tasks.** Spec: user registration API — accept email/password/name, validate format, check duplicate email, hash password before storage, return JWT on success, return appropriate error responses.

## Expected Behaviour

- Task count between 3 and 7
- Each task has: objective, requirements, acceptance criteria, verification
- Ordering: dependencies first
- Must include tasks for: validation, duplicate check, password hashing, token generation

## Scoring / Pass Criteria

3–7 tasks; all four required work areas present; dependencies-first ordering.

## How to Interpret Failures

- Task count outside range → over/under-decomposition
- Missing a required work area → incomplete coverage
- Wrong ordering → dependency violation

## How to Add a Case

Add `scenario-02-*.json` with a different feature type.

## Coverage Limitations

Single API-endpoint scenario.

## Relationship to Repository Validation

Behavioural only.
