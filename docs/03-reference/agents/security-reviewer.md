# Security Reviewer

**Source**: `agents/security-reviewer.md` · **Type**: Review (conditional specialist)

## Primary Responsibility

Security-focused review, activated only when the task involves authentication, authorisation, user input, secrets, file handling, database access, external APIs, payments, or personally identifiable information (PII).

## Scope

- Review authentication and authorisation patterns
- Validate input handling and sanitisation
- Review secrets and credential management
- Check database access for injection vulnerabilities
- Review API security (rate limiting, validation, auth)
- Check payment handling for compliance
- Verify PII handling for privacy compliance

## Activation Criteria

Activate when the task involves: auth/session management, permission checks, user input, secrets/tokens, file uploads/downloads, database queries, external API calls, payments, PII, or cryptography.

## Explicit Boundaries

- **Conditional review.** Not invoked for every task — only security-relevant ones.
- Does not implement fixes; reports findings with severity.

## Inputs

- Task, specification, and implementation diff
- Context on which security domains apply

## Outputs

A security review report: verdict (PASS / FAIL / PASS WITH ISSUES), scope (domains reviewed), findings by severity (vulnerability, location, severity, recommendation), and recommendations.

## Skills Used

`security-review`.

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (conditional gate), `/dk-review`.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor (activation decision), code-reviewer (escalation) |
| **Downstream** | development-conductor (decision), implementation agents (fixes) |

## Handoff Contract

Security findings are severity-tagged. Critical and major findings block completion until fixed and re-reviewed. The review is recorded as a gate in the task-completion gate.

## Required Context

- Specification (what security domains are in scope)
- Implementation diff
- Any existing security constraints

## Context That Must Not Be Supplied

- Security-irrelevant context (keeps the review focused)

## Review / Verification Responsibilities

- Verifies server-side (not client-side-only) validation
- Verifies secrets are not stored in code
- Verifies safe logging (no sensitive data)

## Failure & Escalation Behavior

- **Critical vulnerability** → FAIL, block until fixed
- **Unknown dependency provenance** → flag for dependency review

## Example

For a registration endpoint, the reviewer checks duplicate-email handling, password hashing before storage, input validation at the boundary, and token generation — per the subagent-driven-implementation evaluation's security-relevant scope.

## Anti-Patterns

- Reviewing every task (dilutes focus)
- Ignoring severity classification
- Accepting "we'll fix it later" for critical findings

## Related Agents

[code-reviewer.md](code-reviewer.md) (escalation source), [simplicity-reviewer.md](simplicity-reviewer.md) (must never remove security protections), [development-conductor.md](development-conductor.md).
