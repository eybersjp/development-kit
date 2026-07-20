---
name: debug
description: >-
  Systematic root-cause analysis using the Reproduce → Localise → Identify
  → Fix → Protect cycle.
---

# /debug

## Purpose

Applies systematic root-cause analysis to bugs and failures. Uses the structured cycle: Reproduce → Localise → Identify Root Cause → Fix → Add Regression Protection. Does not guess at fixes — follows evidence.

## Workflow

### 1. Reproduce
Before making any changes, understand the exact conditions that trigger the bug:
- Document the specific inputs, steps, and environment
- Reproduce the bug consistently
- Verify the bug exists in the current code

### 2. Localise
Narrow down where the problem originates:
- Trace the execution path from input to failure
- Use binary search, git blame, and data flow analysis
- Identify the responsible module, function, or component

### 3. Identify Root Cause
Surface the actual cause, not just the symptom:
- What assumption was violated?
- What condition wasn't handled?
- What input wasn't validated?
- What state wasn't managed correctly?

### 4. Fix
Implement the minimum fix using TDD discipline:
- Write a failing test that reproduces the bug (RED)
- Implement the minimum code to make it pass (GREEN)
- Run all tests to confirm no regressions
- Apply the Ponytail simplicity ladder: is there a simpler fix?

### 5. Add Regression Protection
Ensure the bug doesn't return:
- Spawn the **test-engineer** to add a regression test that covers the fix
- The test from step 4 becomes your regression test
- Consider related edge cases
- Apply edge-case-testing to search for similar failure patterns

### 6. Verify
Apply verification-before-completion:
- Run the full test suite
- Confirm the fix works and nothing is broken

## Skills Activated

Primary:
- `systematic-debugging` — Structured reproduce-localise-fix-protect cycle

Supporting:
- `test-driven-development` — Write a failing test before the fix (RED)
- `verification-before-completion` — Requires evidence before claiming the fix works

Conditional:
- `edge-case-testing` — Search for similar failure patterns and edge cases
- `regression-testing` — Confirm existing behaviour remains intact

## Sub-Agents

- test-engineer (for regression tests and edge case coverage)

## Output

Debug report with:
- Reproduction steps
- Localisation results (responsible module, function, component)
- Root cause
- Fix applied (with RED-GREEN-REFACTOR cycle)
- Regression test added
- Similar edge cases considered
