---
name: simplicity-review
description: >-
  Ponytail-style minimum-solution inspection. Checks whether code,
  abstractions, dependencies, or files can be removed. Prevents overengineering.
---

# Simplicity Review

## Overview

The Ponytail-inspired simplicity review. After the implementation is correct and tested, the simplicity reviewer checks whether any code, abstraction, dependency, or file can be removed. This prevents overengineering and keeps the codebase lean.

## When to Use

- After the implementation is correct and all tests pass
- After specification compliance is confirmed
- After code quality review
- Before marking a task complete

## Process

### 1. Read the Diff

Review all files that were created or modified.

### 2. Apply the Ponytail Ladder

For every change, ask these questions in order:

**Can code be deleted?**
- Is every function, variable, and component actually used?
- Is there commented-out code?
- Are there debugging leftovers?
- Are there unused imports or exports?

**Does this feature already exist elsewhere?**
- Could existing project code handle this requirement?
- Is this duplicating existing functionality?

**Was a dependency added unnecessarily?**
- Could the standard library do this?
- Could the native platform do this?
- Could an existing dependency do this?
- Is the dependency justified by the complexity it saves?

**Was a custom component built where a native element works?**
- Could an HTML element or CSS feature replace this component?
- Could a browser API replace this utility?
- Could a framework built-in replace this?

**Was a general framework created for one use case?**
- Is there a generic utility that is only called once?
- Is there an abstraction layer for a single implementation?
- Is there a configuration system for a single variant?
- Is there a base class with only one subclass?

**Did the implementation exceed the specification?**
- Were features implemented that weren't in the spec?
- Was code prepared for future requirements that may never come?
- Were extensibility hooks added unnecessarily?

**Can the same behaviour be achieved more directly?**
- Is there indirection without purpose?
- Are there unnecessary wrapper functions?
- Are there unnecessary intermediate data transformations?
- Is there unnecessary error handling for impossible conditions?

### 3. Never Remove List

Do NOT recommend removing:
- **Security protections**: Input validation, sanitisation, authentication, authorisation
- **Error handling**: Try/catch blocks, error boundaries, error responses
- **Accessibility**: ARIA labels, focus management, keyboard navigation, screen reader support
- **Data integrity**: Constraints, validation, referential integrity
- **Tests**: Unit tests, integration tests, regression tests

### 4. Report

Provide specific, actionable simplification recommendations.

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This abstraction will be useful later" | YAGNI. Build for what's needed now. Remove it. |
| "The code is fine as is, it's not hurting anything" | Every line of code is a maintenance burden. If it's not needed, remove it. |
| "We might need this in the future" | When the future comes, you'll know exactly what's needed. Now, you don't. Remove it. |
| "This is our standard pattern" | If the pattern adds unnecessary complexity for this case, don't use it. |
| "I don't want to break anything by removing it" | That's what tests are for. If tests pass, it's safe to remove. |

## Red Flags

- Abstractions with a single use
- Generic utilities for specific problems
- Configuration or extension hooks for one variant
- Dependencies that add more complexity than they save
- Code that prepares for "future requirements"
- Duplicate implementations of existing functionality
- Custom implementations of standard library features
- Overly defensive code for impossible conditions

## Verification

- [ ] No unnecessary code remains
- [ ] No unnecessary dependencies were added
- [ ] No unnecessary abstractions exist
- [ ] The implementation does not exceed the specification
- [ ] Native or standard library options were preferred
- [ ] All simplifications keep tests passing
- [ ] The never-remove list was respected
