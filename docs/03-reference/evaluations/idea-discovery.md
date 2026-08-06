# Evaluation: idea-discovery

**Source**: `evals/idea-discovery/scenario-01-vague-request.json`

## Skill Being Evaluated

`idea-discovery` — turning vague requests into concrete concepts.

## Evaluation Files

- `evals/idea-discovery/scenario-01-vague-request.json`

## Cases

**Scenario 01 — User has a vague feature request.** Input: "I want to add a way for users to share things".

## Expected Behaviour

- Ask clarifying questions: what specific problem is being solved, who will use the feature, what kind of content should be shareable
- Output sections: problem, intended_users, success_criteria, requirements, assumptions
- Must not proceed to implementation
- Must not assume implementation details

## Scoring / Pass Criteria

Clarifying questions asked; output contains the five sections; no implementation assumptions.

## How to Run

Give the input string to an agent applying the skill; check the questions asked and output structure.

## How to Interpret Failures

- Jumping to implementation → discovery bypassed
- Missing sections → incomplete brief

## How to Add a Case

Add `scenario-02-*.json` with a different vague request domain.

## Coverage Limitations

Single generic request; no domain-specific coverage.

## Relationship to Repository Validation

Behavioural only.
