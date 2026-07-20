---
name: existing-code-first
description: >-
  Searches the existing codebase for reusable code before writing new code.
  Prevents duplication and unnecessary new code.
compatibility: opencode
---

# Existing Code First

## Overview

Searches the existing codebase for reusable code before writing new code. This is step 3 of the Ponytail ladder: before creating anything new, search for existing implementations, utilities, patterns, and components that can be reused, extended, or adapted.

## When to Use

- Before writing any new code
- When the feature resembles existing functionality
- When implementing a common pattern (CRUD, search, pagination, forms)
- When an implementation agent receives a task

## Process

### 1. Search for Existing Implementations

Before writing new code, search for:
- **Similar features**: Has this or something like it been built before?
- **Utility functions**: Are there helpers in `utils/`, `helpers/`, or `lib/`?
- **Components**: Are there reusable UI components that can be extended?
- **Hooks or mixins**: Are there reusable behaviours?
- **Services**: Are there existing service or API patterns to follow?
- **Models and schemas**: Can an existing model be extended?

### 2. Evaluate Reusability

For each candidate, determine:
- **Direct reuse**: Can it be used as-is?
- **Extension**: Can it be extended (subclass, compose, wrap)?
- **Adaptation**: Can it be copied and modified?
- **Inspiration**: Does it show the pattern to follow?

### 3. Apply Before Creating

Only create new code if:
- The required behaviour doesn't exist anywhere in the codebase
- Existing implementations cannot be reasonably extended
- The cost of adapting existing code exceeds the cost of creating new code
- Creating new code is simpler than untangling existing code

### 4. Report Findings

When reporting reuse opportunities, include:
- What was found
- How it can be reused
- Why it's the right choice over new code

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I don't think there's existing code for this" | Think less, search more. Use grep or IDE search before writing. |
| "That existing code is not quite right for this" | It's usually easier to adapt existing code than to write new code. Try extending first. |
| "It's faster to write new code than to understand the existing code" | Short-term speed, long-term pain. Understanding existing code pays off in consistency. |
| "The existing code is poorly written" | If it's bad, refactor it — don't duplicate it. Two wrong implementations are worse than one. |

## Red Flags

- New code duplicates existing functionality
- "I didn't know that existed" is said after implementation
- Multiple implementations of the same pattern exist in the codebase
- A new utility function is created that duplicates a standard library function
- A new component is created that duplicates an existing component
- The same data transformation exists in multiple places

## Verification

- [ ] The existing codebase was searched before new code was written
- [ ] Reusable candidates were evaluated before creating new code
- [ ] New code is justified (existing code cannot be reused)
- [ ] No duplication of existing functionality
- [ ] Reuse rationale is documented
