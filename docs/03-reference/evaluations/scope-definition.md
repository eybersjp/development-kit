# Evaluation: scope-definition

**Source**: `evals/scope-definition/scenario-01-feature-creep.json`

## Skill Being Evaluated

`scope-definition` — defining must/should/could/excluded boundaries.

## Evaluation Files

- `evals/scope-definition/scenario-01-feature-creep.json`

## Cases

**Scenario 01 — Define scope for a feature request with potential feature creep.** Request: dashboard with sales data, charts, tables, "maybe some AI predictions", email reports, and a dark mode toggle. Context: MVP, 2-week deadline, single developer.

## Expected Behaviour

- Must-have: sales data display, charts, tables
- Should-have: email reports, dark mode toggle
- Explicitly excluded: AI predictions, with rationale (exceeds MVP scope given timeline and team size)
- Must not include AI predictions in scope
- Must not accept all requests as must-have

## Scoring / Pass Criteria

Correct classification plus a justified exclusion of AI predictions.

## How to Run

Present the request + context; compare the classification against `expected`.

## How to Interpret Failures

- AI predictions in must-have → scope-definition failure
- No rationale for exclusions → weak justification

## How to Add a Case

Add `scenario-02-*.json` with a different creep pattern.

## Coverage Limitations

Single feature-creep scenario.

## Relationship to Repository Validation

Behavioural only.
