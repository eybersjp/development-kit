---
name: test-driven-development
description: >-
  Enforces Red-Green-Refactor discipline. Tests are written before
  implementation code for behaviour changes.
compatibility: opencode
---

# Test-Driven Development

## Overview

Enforces the Red-Green-Refactor cycle. For behavioural changes, tests must be written before implementation code. This ensures code is testable, correct by design, and protected against regressions.

## When to Use

- For any code that adds or changes behaviour
- For bug fixes (write a failing test that reproduces the bug first)
- When refactoring (ensure existing behaviour is tested first)

## Process

### 1. RED — Write a Failing Test

Before writing any implementation code:

1. Understand the expected behaviour from the specification.
2. Write a test that expresses the desired behaviour.
3. The test must fail because the behaviour doesn't exist yet.
4. Confirm the test fails by running it.

**Good test characteristics:**
- Tests one specific behaviour
- Is independent of other tests
- Is readable (describes what should happen)
- Uses the project's testing conventions

### 2. GREEN — Write Minimum Implementation

Write only enough code to make the test pass:

1. Implement the minimum code needed.
2. Do not over-engineer.
3. Do not add features beyond what the test requires.
4. Run the test — it should pass.
5. Run existing tests — they should still pass.

### 3. REFACTOR — Improve Code Quality

With the test passing, improve the implementation:

1. Refactor for clarity, simplicity, and consistency.
2. Remove duplication.
3. Follow project conventions.
4. Ensure all tests still pass after refactoring.
5. Do not add new behaviour during refactoring.

### 4. Repeat

For each new behaviour, repeat the cycle.

## Testing Layers

**Unit Tests**: Test individual functions, methods, or components in isolation.
- Mock or stub external dependencies
- Test edge cases and error conditions
- Fast and deterministic

**Integration Tests**: Test interactions between components.
- Test real integrations where practical
- Cover the happy path and key error scenarios

**Browser/Runtime Tests**: Test UI behaviour.
- Cover user interactions
- Cover responsive behaviour
- Check for console errors

## Test Coverage Priorities

1. Core business logic
2. Error and edge case handling
3. Integration points (APIs, databases, external services)
4. UI interactions
5. Configuration and setup code

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This code is too simple to need tests" | Simple code breaks too. A test takes 30 seconds. |
| "I'll add tests after it works" | "After" rarely comes. Write the test first. |
| "The test is hard to write because the code isn't testable" | That's a sign the design needs to change. Write the test first to drive better design. |
| "It's just a prototype" | If it's being committed, it will be used. Test it. |
| "I already know this works" | Prove it. A passing test is evidence. Your confidence is not. |

## Red Flags

- Implementation code exists without tests
- Tests are added after implementation is complete
- Tests only cover the happy path
- Tests are flaky (non-deterministic)
- Tests depend on other tests
- Tests are too slow to run frequently
- The test suite can't be run locally
- Refactoring happens before tests pass

## Verification

- [ ] Tests were written before implementation (RED phase)
- [ ] Implementation makes tests pass (GREEN phase)
- [ ] Code is refactored with tests still passing (REFACTOR phase)
- [ ] Edge cases and error scenarios are tested
- [ ] Existing tests still pass
- [ ] Test suite can be run
