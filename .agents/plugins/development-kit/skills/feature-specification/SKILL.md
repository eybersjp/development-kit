---
name: feature-specification
description: >-
  Creates a concise, precise feature specification. Defines what must be built
  without prescribing how it must be implemented. Includes explicit exclusions.
compatibility: opencode
---

# Feature Specification

## Overview

Creates a concise feature specification that defines the problem, expected behaviour, scope, exclusions, acceptance criteria, constraints, and risks. The specification describes **what** to build, not **how** to build it.

## When to Use

- After idea discovery has produced a clear concept
- Before any non-trivial implementation begins
- When adding new features or modifying existing ones

## Process

### 1. Gather Context

Review output from idea discovery, user request, and any existing documentation.

### 2. Analyse

Identify the core behaviour changes required. Distinguish between what the system must do and how it might be implemented. Apply the Ponytail ladder: does this need to exist?

### 3. Write the Specification

Include only what is necessary:

**Title**: Clear, descriptive name.
**Problem**: What problem this solves (1-2 sentences).
**Intended Users**: Who this is for.
**Expected Behaviour**: What the system should do, in observable terms.
**Scope**: What is included.
**Exclusions**: What is explicitly not included.
**Acceptance Criteria**: Testable conditions that define completion.
**Constraints**: Technical or design constraints.
**Risks**: Potential issues or dependencies.

### 4. Review Acceptance Criteria

Ensure each criterion is:
- **Testable**: Can be verified objectively (pass/fail)
- **Specific**: Unambiguous and precise
- **Independent**: Does not depend on other criteria passing
- **Minimal**: Only what is necessary to confirm the feature works
- **Observable**: Describes visible or measurable behaviour

## Specification Template

```markdown
# Specification: [Feature Name]

## Problem
[1-2 sentences]

## Intended Users
[Who uses this]

## Expected Behaviour
[What the system should do]

## Scope
- [Included item 1]
- [Included item 2]

## Exclusions
- [Excluded item 1]
- [Excluded item 2]

## Acceptance Criteria
- [ ] Criterion 1: [description]
- [ ] Criterion 2: [description]
- [ ] Criterion 3: [description]

## Constraints
[Technical or design constraints]

## Risks
[Potential issues or dependencies]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I know what to build, I don't need a spec" | Writing the spec surfaces assumptions and edge cases you haven't considered. |
| "The spec will take too long" | A good spec for a standard feature can be 10-20 bullet points. It takes 10 minutes. |
| "We'll figure it out during implementation" | That's how scope creep and unclear acceptance criteria happen. |
| "The user doesn't need to see the spec" | The spec is for the implementation agent. It prevents drift. |

## Red Flags

- Acceptance criteria are vague or untestable (e.g., "feels fast")
- Exclusions are empty — everything is always out of scope or in scope
- The specification describes implementation rather than behaviour
- The specification is longer than necessary
- Acceptance criteria are not independently verifiable

## Verification

- [ ] Problem is clearly stated
- [ ] Expected behaviour is described in observable terms
- [ ] Scope and exclusions are explicit
- [ ] Acceptance criteria are testable, specific, independent, and minimal
- [ ] Constraints and risks are documented
