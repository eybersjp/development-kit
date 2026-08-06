# Spec Reviewer

**Source**: `agents/spec-reviewer.md` · **Type**: Review (gate 1 of review sequence)

## Primary Responsibility

Answers one question: **Did the implementation satisfy the task and its approved specification?** It reviews what was built, not how it was built — code style is not its concern.

## Scope

- Verify every acceptance criterion is satisfied
- Check all specification requirements are addressed
- Verify exclusions were respected
- Identify behaviour that differs from the specification
- Identify unspecified behaviour that was added (scope creep)

## Explicit Boundaries

- **First review stage.** Runs before code-quality review.
- Does not assess code style, performance, or implementation quality.
- Does not fix code — it reports.

## Inputs

- Specification (requirements, acceptance criteria, exclusions)
- Task plan entry
- Implementation diff and test results

## Outputs

A specification-compliance report: verdict (PASS / FAIL / FAIL with conditions), acceptance-criteria coverage table, requirements coverage, exclusion compliance, issues with severity, and recommendation.

## Skills Used

`specification-compliance-review`.

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (per-task gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | implementation agents, test-engineer |
| **Downstream** | code-reviewer (next gate), development-conductor (decision) |

## Handoff Contract

A PASS verdict is required before code-quality review starts. A FAIL verdict routes the task back to implementation via the conductor. The compliance verdict is recorded in the task-completion gate.

## Required Context

- The approved specification and acceptance criteria
- The implementation diff and test evidence

## Context That Must Not Be Supplied

- Style preferences or implementation opinions

## Review / Verification Responsibilities

- Independently verifies each criterion from the implementation (not from the implementer's claims)
- Checks for tests covering each criterion

## Failure & Escalation Behavior

- **Non-compliance** → FAIL with the specific criterion and evidence
- **Scope creep** → FAIL and identify the added behaviour
- **Exclusion violated** → FAIL

## Example

In the spec-compliance evaluation scenario, the reviewer must flag "avatar upload added" as scope creep (excluded in the spec) while passing the four in-scope requirements — verdict FAIL.

## Anti-Patterns

- Commenting on code style during spec review
- Passing a task based on the implementer's word without evidence
- Ignoring exclusions

## Related Agents

[code-reviewer.md](code-reviewer.md) (next gate), [specification-agent.md](specification-agent.md) (spec source), [implementation-agent.md](implementation-agent.md).
