---
name: test-strategy
description: >-
  Defines how a feature will be proven correct. Specifies the test levels,
  types, coverage targets, and acceptance criteria validation approach.
compatibility: opencode
---

# Test Strategy

## Overview

Defines how a feature will be proven correct. Specifies the test levels (unit, integration, browser), test types (functional, edge case, regression), coverage targets, and how acceptance criteria will be validated.

## When to Use

- Before implementing a feature (in the design phase)
- When defining verification for a task plan
- When a feature has complex testing requirements
- When multiple test levels are needed

## Process

### 1. Understand the Feature

Review the specification, acceptance criteria, and technical design.

### 2. Determine Test Levels

Identify which test levels are appropriate:

**Unit Tests**
- Functions, methods, utilities
- Pure business logic
- Data transformations
- Validation logic

**Integration Tests**
- Service interactions
- API endpoints
- Database operations
- Component interactions

**Browser/UI Tests**
- User workflows
- Page rendering
- Interaction behaviour
- Responsive layout

### 3. Define Test Scope

For each test level, define:
- **What to test**: Specific behaviours
- **What not to test**: Framework internals, third-party code (mock these)
- **Edge cases**: Boundary conditions, error states, empty states
- **Regression tests**: Existing behaviours that must not break

### 4. Define Coverage Targets

- **Unit tests**: Line coverage target (e.g., 80%+ for critical paths)
- **Integration tests**: Key paths and error scenarios
- **Browser tests**: Critical user journeys

### 5. Map Acceptance Criteria to Tests

For each acceptance criterion, identify the test level and test case that verifies it.

## Test Strategy Template

```
## Test Strategy: [Feature Name]

### Acceptance Criteria Map
| Criterion | Test Level | Test Case |
|-----------|------------|-----------|
| [Criterion 1] | Unit | `test/unit/...` |
| [Criterion 2] | Integration | `test/integration/...` |

### Unit Tests
**Scope**: [What behaviours to test]
**Files**: [Test file locations]
**Edge cases**: [Specific edge cases to cover]
**Coverage target**: [Percentage or path-based]

### Integration Tests
**Scope**: [What integrations to test]
**Files**: [Test file locations]
**External dependencies**: [What to mock vs what to use real]

### Browser/UI Tests
**Scope**: [What user journeys to test]
**Files**: [Test file locations]
**Viewports**: [Screen sizes to test]

### Regression Tests
**Existing behaviour to protect**: [List existing tests to verify]

### Test Environment
- [Setup requirements]
- [Data fixtures]
- [External services]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll write tests as I go" | A test strategy ensures nothing is missed. Plan the tests. |
| "Unit tests are enough" | Unit tests don't verify that components work together. Test at multiple levels. |
| "I don't need to plan tests, the feature is simple" | Simple features break too. A test strategy takes 5 minutes. |
| "I'll test everything" | Test strategically. Not everything needs the same depth. |

## Red Flags

- No test strategy for high-risk features
- Only one test level is used for complex features
- Acceptance criteria have no corresponding tests
- Edge cases are not tested
- Testing depends on external services (no mocking strategy)
- Coverage targets are unrealistic (100% everywhere) or absent

## Verification

- [ ] Test levels are appropriate for the feature
- [ ] Each acceptance criterion maps to a test
- [ ] Edge cases and error states have tests
- [ ] Regression behaviour is protected
- [ ] Coverage targets are realistic
- [ ] Test environment dependencies are defined
