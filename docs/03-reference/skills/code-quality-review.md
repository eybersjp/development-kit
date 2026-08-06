# code-quality-review

**Source**: `skills/code-quality-review/SKILL.md` · **Category**: Review · **Compatibility**: `opencode`

## Purpose

The second gate in the two-stage review process. Assesses code for correctness, readability, maintainability, error handling, conventions, unnecessary complexity, and duplication.

## Lifecycle Category

REVIEW (gate 2).

## Trigger Conditions

- After spec-compliance review passes
- For every implemented task

## When Not to Invoke

- Before compliance is confirmed (order is fixed)

## Required Inputs

- The implementation diff
- The specification/design and project conventions

## Preconditions

- Spec-compliance review passed

## Procedure

1. Assess correctness, readability, maintainability.
2. Check error handling, conventions, complexity, duplication.
3. Check security basics and test quality.
4. Classify issues: critical, major, minor, suggestion.
5. Produce the verdict (PASS / FAIL / PASS WITH ISSUES).

## Outputs

- A quality verdict with severity-classified findings

## Invariants

- Runs only after compliance passes.
- Security and testing are part of quality.

## Dependencies

`specification-compliance-review` (predecessor).

## Related Agents

code-reviewer (primary).

## Related Commands

`/dk-review` (supporting), `/dk-build`, `/dk-build-auto`.

## Verification Requirements

- [ ] Issues severity-classified
- [ ] Tests assessed for meaningfulness

## Failure Behavior

- Critical issues block the task; conditional passes require fixes.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/code-quality-review/scenario-01-messy-code.json`: the reviewer identifies `any` types, concatenated fetch URLs, unclear names, `==`, leftover logs, missing error handling, and missing validation — verdict FAIL with ≥2 critical issues.

## Anti-Patterns

- Nitpicking when critical issues exist
- Approving without reading tests

## Maintenance Notes

Evaluated by `evals/code-quality-review/`.
