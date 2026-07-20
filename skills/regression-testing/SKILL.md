---
name: regression-testing
description: >-
  Checks that existing behaviour remains intact after changes. Runs the
  existing test suite and verifies no previously passing tests fail.
---

# Regression Testing

## Overview

Checks that existing behaviour remains intact after changes. Runs the existing test suite and verifies that no previously passing tests fail. Regression testing is the safety net that prevents new changes from breaking existing functionality.

## When to Use

- After any implementation change
- Before marking any task as complete
- After code review and simplification
- Before the final ship gate

## Process

### 1. Identify Affected Areas

Determine which parts of the codebase could be affected by the changes:
- Modified files and their consumers
- Changed APIs and their callers
- Changed data models and their dependents
- Changed components and their parents/children

### 2. Run Existing Test Suite

Execute the complete test suite for the affected areas:
- **Unit tests**: All tests in the affected modules
- **Integration tests**: Tests that cover the changed interfaces
- **Browser tests**: Tests for affected UI components
- **End-to-end tests**: Tests covering the changed user journeys

### 3. Check Test Results

- All previously passing tests should still pass
- New tests should pass (from TDD cycle)
- No flaky tests in the results

If tests fail:
1. Determine if the failure is caused by the change or a pre-existing issue
2. If caused by the change, the implementation needs to be fixed
3. If pre-existing, document the failure separately

### 4. Verify Specific Regression Risks

For common regression scenarios:
- **Removed code**: Was it used elsewhere?
- **Renamed or moved code**: Are all references updated?
- **Changed interface**: Are all callers updated?
- **Changed data format**: Are all consumers updated?
- **Changed behaviour**: Are there tests for the old behaviour?

### 5. Document

Report the regression test results.

## Regression Report Template

```
## Regression Test Report

### Suite Results
| Suite | Tests | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| Unit | XX | XX | XX | |
| Integration | XX | XX | XX | |
| Browser | XX | XX | XX | |

### New Failures (caused by this change)
- [Test name]: [Issue description]

### Pre-existing Failures (not caused by this change)
- [Test name]: [Issue description] (pre-existing)

### Regression Risks Verified
- [ ] Removed code confirmed unused
- [ ] All references to renamed/moved code updated
- [ ] All callers of changed interfaces updated
- [ ] All consumers of changed data updated

### Verdict
[PASS / FAIL]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "My change is small, it can't break anything" | Small changes break things too. Run the tests. |
| "I'll run the tests before I commit" | Good practice. But also run them after simplification — simplifications can break things. |
| "The code compiles, so it must be fine" | Compilation doesn't verify runtime behaviour. Run the tests. |
| "I only changed CSS, tests won't catch anything" | CSS changes can break layout tests, visual regression tests, and accessibility checks. Run them. |

## Red Flags

- Regression tests are not run before claiming completion
- Failing tests are ignored because "the test was already flaky"
- Only new tests are run, not the full suite
- The test suite is broken (pre-existing failures)
- Regression tests exist but nobody runs them
- Changes are made to shared code without running dependent tests

## Verification

- [ ] Complete test suite passes for affected areas
- [ ] No new test failures introduced by the change
- [ ] Removed code is confirmed unused
- [ ] All references to changed code are updated
- [ ] Regression testing is performed after simplification
