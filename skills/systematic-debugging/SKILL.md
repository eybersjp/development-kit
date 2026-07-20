---
name: systematic-debugging
description: >-
  Uses a structured reproduce-localise-fix-protect cycle. Does not guess
  at fixes — follows evidence.
compatibility: opencode
---

# Systematic Debugging

## Overview

Uses a structured cycle: Reproduce → Localise → Identify Root Cause → Fix → Add Regression Protection. Does not guess at fixes — follows evidence and eliminates hypotheses systematically.

## When to Use

- A bug has been reported
- A test is failing unexpectedly
- Behaviour differs from the specification
- A production incident has occurred

## Process

### 1. Reproduce

Before making any changes:
1. Understand the exact conditions that trigger the bug.
2. Reproduce the bug consistently.
3. Document the steps, inputs, and environment.
4. Verify the bug exists in the current code.

**Good reproduction includes:**
- Specific inputs or actions
- Expected behaviour vs actual behaviour
- Environment details (browser, OS, version)
- Screenshots or error messages

### 2. Localise

Identify where in the code the problem originates:
1. Use the reproduction steps to trace the execution path.
2. Narrow down the responsible module, function, or component.
3. Test your hypothesis by examining the code.
4. Add temporary logging or debugging if needed (remove before fix).

**Localisation techniques:**
- Binary search (disable half the code, see if bug persists)
- Follow the data flow
- Check recent changes (git blame)
- Check assumptions about input data

### 3. Identify Root Cause

Surface the actual cause, not just the symptom:
1. What assumption was violated?
2. What condition wasn't handled?
3. What input wasn't validated?
4. What state wasn't managed correctly?

**Common root causes:**
- Unvalidated input
- Incorrect state management
- Timing or race conditions
- Misunderstood API contract
- Edge case not covered
- Configuration error
- Environment difference

### 4. Fix

Implement the minimum fix:
1. Write a failing test that reproduces the bug (RED).
2. Implement the minimum code to fix it (GREEN).
3. Run all tests to confirm no regressions.
4. Remove temporary debugging code.

**Fix principles:**
- Fix the root cause, not the symptom
- Minimum change necessary
- Match existing conventions
- Handle the edge case properly

### 5. Add Regression Protection

Ensure the bug doesn't return:
1. The test you wrote in step 4 is your regression test.
2. Consider related edge cases that might also be affected.
3. Update documentation if the expected behaviour changed.
4. Commit the fix along with the test.

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I know what the fix is, I don't need to reproduce it" | Without reproduction, you can't verify the fix. Reproduce first. |
| "I'll just change this line, it looks suspicious" | Guessing causes more bugs. Localise the root cause first. |
| "I don't need a test for this fix" | Without a test, the bug will come back. Write the regression test. |
| "The bug is obvious" | Obvious bugs have non-obvious root causes. Follow the process. |

## Red Flags

- Fixes are attempted without reproduction
- Multiple changes are made at once to fix a single bug
- The same bug has been fixed before
- Temporary debug code is left in the codebase
- The root cause is not identified (just the symptom is patched)
- The fix introduces new complexity

## Verification

- [ ] Bug is reproduced consistently
- [ ] Root cause is identified
- [ ] A failing test reproduces the bug
- [ ] Fix is minimal and addresses the root cause
- [ ] All existing tests still pass
- [ ] Temporary debugging code is removed
