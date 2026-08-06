# /dk-review

**Source**: `commands/dk-review.md` · **Lifecycle Stage**: REVIEW

## Purpose

Runs the full multi-axis review cycle. Specification compliance is checked first, then code quality, then specialist reviews (security, accessibility, design) as conditionally required.

## When to Use

- After tests pass for a task or full feature.
- Before merging or shipping any change.

## Two-Stage Review Order

Development Kit enforces a mandatory two-stage review order:
1. **Specification Compliance First** — `spec-reviewer` verifies the implementation satisfies the specification.
2. **Code Quality Second** — `code-reviewer` assesses correctness, readability, maintainability.

Code quality review begins **only after** specification compliance passes.

## Conditional Specialist Reviews

Additional reviews are spawned based on the nature of the change:
- **Security Review** (`security-reviewer`): When change involves auth, user input, APIs, secrets, file handling, or PII.
- **Accessibility Review** (`accessibility-reviewer`): When change includes UI modifications.
- **Design Quality Review** (`design-reviewer`): When change includes visual UI changes.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `specification-compliance-review` | Stage 1: spec compliance |
| `code-quality-review` | Stage 2: code correctness and quality |
| `security-review` | Conditional: security-sensitive changes |
| `accessibility-review` | Conditional: UI changes |
| `design-quality-review` | Conditional: visual UI changes |

## Agents Invoked

- `spec-reviewer` (stage 1)
- `code-reviewer` (stage 2)
- `security-reviewer` (conditional)
- `accessibility-reviewer` (conditional)
- `design-reviewer` (conditional)

## Outputs

Review report (uses `review-report.md` template) containing:
- Specification compliance findings
- Code quality findings
- Security review findings (if applicable)
- Accessibility findings (if applicable)
- Design quality findings (if applicable)
- Overall pass/fail recommendation

## Failure Behavior

If any review fails with critical findings, the command routes back to the implementation agent for fixes. Do not proceed to `/dk-simplify` or `/dk-ship` until all reviews pass.

## Related Commands

- `/dk-test` — must pass before review
- `/dk-simplify` — next step after review passes
- `/dk-ship` — final gate after simplification
