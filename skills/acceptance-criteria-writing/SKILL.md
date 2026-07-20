---
name: acceptance-criteria-writing
description: >-
  Converts requirements into observable, testable conditions that define
  when a feature is complete and correct.
---

# Acceptance Criteria Writing

## Overview

Converts requirements into observable, testable conditions. Good acceptance criteria define when a feature is complete and correct. They are the contract between the specifier and the implementer: if all criteria pass, the feature is done.

## When to Use

- After scope definition and before specification writing
- When writing any feature specification
- When a task needs clear completion boundaries
- When requirements are vague and need to be made testable

## Process

### 1. Review Requirements

Read each requirement from the scope definition or specification.

### 2. Write Testable Criteria

For each requirement, write criteria that are:

**Specific**: Precise and unambiguous
- Bad: "The form should be user-friendly"
- Good: "The form shows validation errors below each field within 500ms of blur"

**Observable**: Can be seen or measured
- Bad: "The system handles errors gracefully"
- Good: "When the API returns a 500 error, the user sees 'Something went wrong' with a retry button"

**Testable**: Can be verified as pass/fail
- Bad: "The page loads quickly"
- Good: "The page renders meaningful content within 2 seconds on a 3G connection"

**Independent**: Does not depend on other criteria passing
- Bad: "The dashboard works well" (too broad, depends on multiple sub-criteria)
- Good: "The dashboard shows the user count within 1 second of page load"

**Minimal**: Only what is necessary to confirm the feature works
- Bad: "The API returns status 200 with a body containing id, name, email, createdAt, updatedAt, and a links array with self, update, delete relations" (too detailed)
- Good: "The API returns status 200 with the created resource including an id field"

### 3. Format Criteria

Use the Given-When-Then format for behavioural criteria:

```
Given [context/precondition]
When [action/event]
Then [expected outcome]
```

**Example:**
- Given a registered user with a valid session
- When they submit the profile edit form with a new display name
- Then the system saves the new display name and shows a success message

### 4. Include Edge Cases

For each set of criteria, include edge cases:
- Empty or null inputs
- Maximum allowed values
- Invalid formats
- Unauthorised access
- Concurrent operations
- Network failures

### 5. Review Criteria

Check each criterion against the SMART framework:
- **S**pecific
- **M**easurable
- **A**chievable
- **R**elevant
- **T**ime-bound (where applicable)

## Acceptance Criteria Format

```
### Criterion: [Short Name]
- **Given**: [Context]
- **When**: [Action]
- **Then**: [Expected outcome]

### Criterion: [Edge Case: Empty Input]
- **Given**: A user on the create form
- **When**: They submit with all fields empty
- **Then**: The form shows validation errors for required fields and does not submit
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I know it when I see it" | If you can't describe it, you can't test it. Write the criteria. |
| "This criterion is obvious" | Obvious to you may not be obvious to the implementer. Write it down. |
| "We'll test this manually" | Manual tests are not acceptance criteria. Write testable criteria. |
| "The developer will know what to do" | The developer should not have to guess. The criteria define done. |

## Red Flags

- Criteria are vague or subjective ("looks good", "feels fast")
- Criteria describe implementation rather than behaviour
- Criteria cannot be automated or objectively verified
- Only happy-path criteria are defined
- Edge cases are not considered
- Criteria are dependent on each other

## Verification

- [ ] Each criterion is specific, observable, and testable
- [ ] Edge cases are covered (empty, invalid, unauthorised, errors)
- [ ] Criteria use Given-When-Then format where appropriate
- [ ] Criteria are independent of each other
- [ ] Criteria describe behaviour, not implementation
- [ ] All criteria pass = feature is complete
