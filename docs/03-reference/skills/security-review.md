# security-review

**Source**: `skills/security-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

Conditional specialist review for tasks involving authentication, authorisation, user input, secrets, file handling, database access, external APIs, payments, or PII.

## Lifecycle Category

REVIEW (conditional).

## Trigger Conditions

- Tasks involving auth, authorisation, user input, secrets, files, databases, external APIs, payments, or PII
- Activated by the conductor when the task triggers the criteria

## When Not to Invoke

- For tasks with no security-relevant surface

## Required Inputs

- The implementation diff and the security domains in scope

## Preconditions

- Implementation exists

## Procedure

1. Determine relevant security domains.
2. Check input validation, injection resistance (SQL/NoSQL/command/XSS), file upload validation, and redirect validation.
3. Check authentication/authorisation enforcement and privilege escalation risk.
4. Check data protection (encryption, secrets, PII, safe logging).
5. Check API security (rate limiting, CORS, key validation, error leakage).
6. Report with severity classification (template: `Security Review` in the skill).

## Outputs

- A security verdict: PASS / FAIL / PASS WITH ISSUES, with severity-tagged findings

## Invariants

- Severity classification is mandatory.
- Critical/major findings block completion.

## Dependencies

`code-quality-review` (predecessor in the review sequence).

## Related Agents

security-reviewer (primary).

## Related Commands

`/dk-review` (supporting), `/dk-build`, `/dk-build-auto` (conditional gate).

## Verification Requirements

- [ ] Relevant domains reviewed
- [ ] Findings severity-tagged

## Failure Behavior

- Critical vulnerabilities block until fixed and re-reviewed.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a registration endpoint: password hashing before storage, duplicate-email handling, boundary validation, and token generation are reviewed per the security checklist.

## Anti-Patterns

- Reviewing every task (dilutes focus)
- Accepting critical findings "to be fixed later"

## Maintenance Notes

Do not claim security guarantees beyond what this review actually checks.
