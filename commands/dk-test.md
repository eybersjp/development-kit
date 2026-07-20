---
name: dk-test
description: >-
  Run task-specific verification: unit tests, integration tests, type checking,
  linting, and browser tests as applicable.
---

# /dk-test

## Purpose

Runs task-specific verification for the current task. The full verification suite includes unit tests, integration tests, browser tests, type checking, and linting. For UI work, also checks browser runtime behaviour, console errors, responsive layout, and accessibility.

## Workflow

### 1. Identify Test Scope
Determine which verification types are relevant for the current task:
- Unit tests: functions, methods, utilities
- Integration tests: component interactions, API endpoints, database operations
- Browser tests: user workflows, interactions, responsive layout
- Type checking and linting

### 2. Run Core Verification
Spawn the **test-engineer** to execute the verification suite:
- Run existing tests
- Write missing tests (TDD: RED phase if new behaviour)
- Identify edge cases and unhappy paths
- Run type checking and linting

### 3. Apply Browser Runtime Verification (for UI tasks)
Activate the browser-runtime-verification approach:
- Check for console errors and warnings
- Verify network requests succeed with proper error handling
- Confirm DOM behaviour and dynamic updates
- Test responsive layout at multiple viewport sizes
- Verify keyboard navigation and focus management

### 4. Apply Regression Testing
Activate regression-testing to ensure existing behaviour remains intact:
- Run the complete test suite for affected areas
- Confirm previously passing tests still pass
- Check for side effects from the change

### 5. Apply Edge Case Testing
Activate edge-case-testing to actively search for failure scenarios:
- Boundary values (min, max, just outside)
- Invalid inputs (wrong type, malformed, injection patterns)
- Missing values (null, undefined, empty)
- Unexpected values (very large, unicode, control characters)

### 6. Report Results
Provide a clear pass/fail report with details for each verification area.

## Skills Activated

Primary:
- `verification-before-completion` — Requires evidence before claiming success

Supporting:
- `browser-runtime-verification` — Checks runtime behaviour in the browser (console, network, DOM, responsive, accessibility)
- `regression-testing` — Ensures existing behaviour remains intact after changes
- `edge-case-testing` — Actively searches for boundary conditions and failure scenarios

Conditional:
- `test-driven-development` — If new tests need to be written for new behaviour

## Sub-Agents

- test-engineer (primary — runs and coordinates verification)

## Output

Test report including:
- Results per test type (unit, integration, browser, type check, lint)
- Browser runtime checks (console, network, responsive, accessibility)
- Regression test results
- Edge cases covered and any failures found
- Coverage gaps
- New tests added
