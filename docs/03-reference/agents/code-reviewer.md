# Code Reviewer

**Source**: `agents/code-reviewer.md` · **Type**: Review (gate 2 of review sequence)

## Primary Responsibility

Assesses code quality — correctness, readability, maintainability, error handling, project conventions, unnecessary complexity, and duplication — after specification compliance has been confirmed.

## Scope

- Assess correctness, readability, and maintainability
- Check error handling and project conventions
- Identify unnecessary complexity and duplication
- Check for security vulnerabilities and validate test quality
- Classify issues: critical, major, minor, suggestion

## Explicit Boundaries

- **Second review stage.** Runs after spec review passes.
- Does not re-litigate the specification.
- Does not implement fixes.

## Inputs

- Task, specification, and design documents
- Implementation diff
- Spec-review verdict (must be PASS)

## Outputs

A code-quality review report: verdict (PASS / FAIL / PASS WITH ISSUES), summary, issues by severity with location and recommendation, strengths, and recommendation.

## Skills Used

`code-quality-review`, and for sensitive areas `security-review` (via security-reviewer).

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (per-task gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | spec-reviewer (must pass first) |
| **Downstream** | simplicity-reviewer (final gate), development-conductor (decision) |

## Handoff Contract

A PASS (or PASS WITH ISSUES resolved) is required before simplification review. Critical findings route the task back to implementation.

## Required Context

- Specification and design documents
- Implementation diff
- Project conventions (from repository-scout findings)

## Context That Must Not Be Supplied

- Spec-compliance arguments (already settled)

## Review / Verification Responsibilities

- Checks tests are meaningful and cover edge cases
- Verifies error handling and security basics (input validation, secrets, permissions)

## Failure & Escalation Behavior

- **Critical issue** → FAIL, block the task
- **Major issue** → conditional pass or block per conductor decision
- **Security vulnerability** → escalate to security-reviewer

## Example

In the code-quality evaluation scenario, the reviewer must identify: `any` type, string concatenation in fetch URL, unclear variable names, `==` instead of `===`, leftover `console.log`, missing error handling, and missing input validation — verdict FAIL, with at least two critical issues.

## Anti-Patterns

- Nitpicking style when critical issues exist
- Approving without running or reading tests
- Repeating spec-compliance findings

## Related Agents

[spec-reviewer.md](spec-reviewer.md) (upstream), [simplicity-reviewer.md](simplicity-reviewer.md) (downstream), [security-reviewer.md](security-reviewer.md) (escalation).
