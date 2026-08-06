# Evaluation: subagent-driven-implementation

**Source**: `evals/subagent-driven-implementation/scenario-01-registration-flow.json`

## Skill Being Evaluated

`subagent-driven-implementation` — dispatching fresh sub-agents per task.

## Evaluation Files

- `evals/subagent-driven-implementation/scenario-01-registration-flow.json`

## Cases

**Scenario 01 — Break down a complex task into sub-agent assignments.** Task: user registration with email verification (Express.js + PostgreSQL + nodemailer). Requirements: submit email/password, server validates format, duplicate-email check, sends verification email, link verification, confirms verification.

## Expected Behaviour

- Assign sub-agents: minimum 3 (database: schema/migration/unique email constraint; backend: endpoint/validation/duplicate check; backend or integration: email sending/token/confirmation)
- Each assignment has clear scope boundaries, acceptance criteria, exclusions, and verification requirements
- Must not assign everything to a single agent
- Must not skip acceptance criteria for any task
- Must not include frontend work (not requested)

## Scoring / Pass Criteria

≥3 sub-agent assignments with the specified scopes; all per-assignment fields present.

## How to Run

Present the task and technical context; compare the assignment breakdown.

## How to Interpret Failures

- Single-agent assignment → isolation failure
- Missing acceptance criteria → incomplete contracts
- Frontend scope added → scope violation

## How to Add a Case

Add `scenario-02-*.json` with a different complex task.

## Coverage Limitations

Single registration-flow scenario.

## Relationship to Repository Validation

Behavioural only.
