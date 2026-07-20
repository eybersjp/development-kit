---
name: code-quality-review
description: >-
  The second gate in the two-stage review process. Assesses code for
  correctness, readability, maintainability, error handling, conventions,
  unnecessary complexity, and duplication.
compatibility: opencode
---

# Code Quality Review

## Overview

The second stage of the two-stage review process. After specification compliance is confirmed, code quality review assesses the implementation for correctness, readability, maintainability, error handling, project conventions, unnecessary complexity, and duplication.

## When to Use

- After specification compliance review passes
- Before marking a task as complete
- Before simplicity review

## Process

### 1. Understand the Implementation

Read the code changes. Understand what was implemented and how.

### 2. Review Each Quality Dimension

**Correctness**
- Does the code handle expected inputs correctly?
- Are edge cases handled?
- Are there any logical errors or off-by-one errors?
- Do the tests actually test what they claim to test?

**Readability**
- Are names clear and descriptive (variables, functions, classes, files)?
- Is the code structured logically?
- Are comments helpful (explaining "why", not "what")?
- Is the code self-documenting?

**Maintainability**
- Is the code easy to modify without breaking other things?
- Are dependencies explicit and manageable?
- Is the code testable?
- Are side effects minimised or explicit?

**Error Handling**
- Are error cases handled gracefully?
- Are errors propagated appropriately (not silently swallowed)?
- Are error messages meaningful?
- Are assumptions validated?

**Conventions**
- Does the code follow project naming conventions?
- Are file and component placements consistent?
- Does the code use existing patterns?
- Does the code follow language/framework idiomatic practices?

**Complexity**
- Is there unnecessary abstraction?
- Are there overly complex solutions to simple problems?
- Could the code be expressed more simply?

**Duplication**
- Is there duplicated code that could be shared?
- Is there code that duplicates existing functionality?
- Are there "copy-paste" patterns?

### 3. Classify Issues

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Must fix before proceeding | Blocking |
| **Major** | Should fix, would improve quality significantly | Recommended |
| **Minor** | Nice to fix | Optional |
| **Suggestion** | Alternative approach | Consider for future |

### 4. Report

Provide a clear verdict and actionable findings.

## Code Quality Review Template

```
## Code Quality Review

### Verdict: PASS / FAIL / PASS WITH ISSUES

### Summary
[One paragraph]

### Issues
**Critical**
- [Issue] — [Location] — [Recommendation]

**Major**
- [Issue] — [Location] — [Recommendation]

**Minor**
- [Issue] — [Location] — [Recommendation]

### Strengths
- [What was done well]

### Recommendation
[Approve / Conditional approve / Request changes]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The code works, quality doesn't matter" | Working code that's unreadable or unmaintainable becomes technical debt. Review quality. |
| "I'll refactor it later" | Later rarely comes. Review quality now. |
| "This is the standard library pattern" | Verify it's used correctly and consistently with the rest of the project. |
| "The tests pass, that's good enough" | Passing tests verify correctness, not quality. Review both. |

## Red Flags

- Unused variables, imports, or functions
- Commented-out code
- Deeply nested conditionals or loops
- Functions that do too many things
- Magic numbers or strings without named constants
- Inconsistent naming or formatting
- Error handling is missing or inconsistent
- Tests that don't actually assert anything meaningful

## Verification

- [ ] Code is correct and handles edge cases
- [ ] Code is readable and maintainable
- [ ] Error handling is appropriate
- [ ] Project conventions are followed
- [ ] No unnecessary complexity
- [ ] No duplication
- [ ] Tests are meaningful and well-structured
