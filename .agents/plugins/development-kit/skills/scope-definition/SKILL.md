---
name: scope-definition
description: >-
  Defines must-have, should-have, could-have, and explicitly excluded items.
  Creates clear boundaries for what the implementation will and will not do.
compatibility: opencode
---

# Scope Definition

## Overview

Defines the boundaries of the work: what is definitely included, what is desirable but not essential, what is optional, and what is explicitly excluded. Clear scope boundaries prevent scope creep and ensure everyone agrees on what will and will not be delivered.

## When to Use

- After idea discovery and requirements interview
- Before writing the specification
- When a feature request is ambiguous about boundaries
- When there's disagreement about what should be included
- At the start of any project or feature

## Process

### 1. Gather Inputs

Review outputs from:
- Idea discovery
- Requirements interview
- User request
- Existing documentation or discussions

### 2. Categorise Requirements

Using the MoSCoW method:

**Must Have (Essential)**
Required for the solution to be viable. Without these, the feature fails.
- Critical path functionality
- Core user workflows
- Legal or compliance requirements
- Security requirements

**Should Have (Important but Not Essential)**
Significant value but not critical. Can be delivered in a follow-up if needed.
- Important user experience improvements
- Performance optimisations
- Non-critical features

**Could Have (Nice to Have)**
Desirable but low impact. Only included if time and resources permit.
- Visual enhancements
- Convenience features
- "Would be cool" functionality

**Will Not Have (Explicitly Excluded)**
Consciously excluded from this scope.
- Features for future versions
- Out-of-scope workflows
- Features that are too expensive for the value they provide

### 3. Define Boundaries

For each category, be specific:
- **Must Have**: "Users can create accounts with email and password"
- **Should Have**: "Users can reset their password"
- **Could Have**: "Users can sign in with Google OAuth"
- **Will Not Have**: "Users cannot sign in with Apple ID, Facebook, or other providers"

### 4. Validate With Stakeholders

Confirm the scope boundaries with the requestor or stakeholders. Specifically confirm the "Will Not Have" list — if there's disagreement, move items up the priority.

### 5. Document

Produce a scope definition document.

## Scope Template

```
## Scope Definition: [Feature/Project]

### Must Have
- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Should Have
- [ ] [Requirement 3]
- [ ] [Requirement 4]

### Could Have
- [ ] [Requirement 5]
- [ ] [Requirement 6]

### Will Not Have (This Version)
- [Exclusion 1]
- [Exclusion 2]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "Everything is a must-have" | If everything is critical, nothing is. Prioritise honestly. |
| "We'll figure out scope as we go" | That's how scope creep happens. Define it upfront. |
| "Exclusions create unnecessary constraints" | Exclusions create clarity. No one is surprised when something isn't delivered. |
| "Let's keep it all in scope, we can cut later" | Scope is easier to define upfront than to cut mid-implementation. |

## Red Flags

- Everything is "Must Have" (no prioritisation)
- Exclusions list is empty (everything is in scope)
- Scope is defined in vague terms ("basic CRUD")
- Scope items are mixed with implementation details
- Scope items are too large to be verifiable

## Verification

- [ ] Must-have items are truly essential
- [ ] Should-have items are clearly valuable but not critical
- [ ] Could-have items are genuinely optional
- [ ] Will-not-have items are explicitly documented and agreed
- [ ] The scope boundaries are clear and specific
