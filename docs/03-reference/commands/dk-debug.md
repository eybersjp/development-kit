# /dk-debug

**Source**: `commands/dk-debug.md` · **Lifecycle Stage**: Recovery

## Purpose

Applies systematic root-cause analysis to bugs and failures using the structured cycle: **Reproduce → Localise → Identify Root Cause → Fix → Add Regression Protection**.

Does not guess at fixes. Follows evidence to the root cause before writing any code.

## When to Use

- A test is failing and the root cause is unknown.
- A bug has been reported and needs systematic investigation.
- An unexpected behavior needs root-cause analysis.

## When NOT to Use

- For feature implementation — use `/dk-build`.
- For code quality review — use `/dk-review`.

## Workflow

### 1. Reproduce
Document the exact conditions that trigger the bug: specific inputs, steps, and environment. Confirm the bug exists in current code.

### 2. Localise
Trace the execution path from input to failure. Use binary search, git blame, and data flow analysis to identify the responsible component.

### 3. Identify Root Cause
Surface the actual cause — not just the symptom. What assumption was violated? What input wasn't validated? What state wasn't managed correctly?

### 4. Fix (TDD Discipline)
- Write a failing test that reproduces the bug (RED)
- Implement the minimum code to make it pass (GREEN)
- Run all tests to confirm no regressions
- Apply the Ponytail simplicity ladder: is there a simpler fix?

### 5. Add Regression Protection
Spawn `test-engineer` to add a regression test. Consider related edge cases. Apply `edge-case-testing` to search for similar failure patterns.

### 6. Verify
Run the full test suite. Confirm the fix works and nothing is broken.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `systematic-debugging` | Primary — reproduce-localise-fix-protect cycle |
| `test-driven-development` | Write failing test before fix |
| `verification-before-completion` | Empirical evidence required |
| `edge-case-testing` | Conditional — similar failure patterns |
| `regression-testing` | Conditional — existing behavior intact |

## Agents Invoked

- `test-engineer` (for regression tests and edge case coverage)

## Outputs

Debug report with:
- Reproduction steps
- Localisation results (responsible module/function)
- Root cause identified
- Fix applied (with RED-GREEN-REFACTOR evidence)
- Regression test added
- Edge cases considered

## Related Commands

- `/dk-test` — run after fix is applied
- `/dk-review` — review fix after tests pass
