---
name: user-flow-design
description: >-
  Designs user-facing workflows and journeys. Maps the steps a user takes
  to accomplish a goal, including happy paths, edge cases, and error states.
---

# User Flow Design

## Overview

Designs user-facing workflows and journeys. Maps the steps a user takes to accomplish a goal, including happy paths, edge cases, and error states. Used when a user-facing workflow changes.

## When to Use

- When designing new user-facing features
- When changing existing user workflows
- When the user experience is complex or multi-step
- When multiple user roles or permissions are involved

## Process

### 1. Identify User Goals

What is the user trying to accomplish? What triggers this workflow?

### 2. Map the Happy Path

The ideal, error-free path:
1. Entry point: How does the user start?
2. Steps: What does the user do at each step?
3. Decisions: What choices does the user make?
4. Completion: How does the user know they succeeded?

### 3. Consider Edge Cases

For each step, consider:
- What if the user cancels?
- What if the input is invalid?
- What if a required resource is unavailable?
- What if the network fails?
- What if the session expires?

### 4. Consider Alternative Paths

- What if the user has different permissions?
- What if the user comes from a different entry point?
- What if the user needs to go back?

### 5. Design Error States

For each failure point:
- What does the user see?
- Can the user retry?
- Can the user recover?
- Who do they contact for help?

### 6. Document

Produce a user flow diagram or description.

## User Flow Template

```
## User Flow: [Feature Name]

### User Goal
[What the user wants to accomplish]

### Entry Points
- [Entry point 1]: [How user arrives]
- [Entry point 2]: [How user arrives]

### Happy Path
1. [Step 1]: [Description]
2. [Step 2]: [Description]
3. [Step 3]: [Description]
4. **Success**: [What the user sees]

### Error States
- **Error 1 — [Condition]**: [What user sees] → [Recovery action]
- **Error 2 — [Condition]**: [What user sees] → [Recovery action]

### Edge Cases
- **Empty state**: [What user sees when no data exists]
- **Loading state**: [What user sees while waiting]
- **Permission denied**: [What happens if user lacks access]

### Alternative Flows
- **Flow B — [Condition]**: [Different path]
- **Flow C — [Condition]**: [Different path]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "The flow is obvious, I don't need to map it" | Obvious flows hide subtle edge cases. Map it to find them. |
| "I'll handle errors during implementation" | Error handling affects the flow design. Design it now. |
| "The user will figure it out" | Users don't "figure it out" — they get frustrated and leave. Design the recovery path. |
| "This is just a form submission" | Every form has loading, validation, success, and error states. Design all four. |

## Red Flags

- Only the happy path is designed
- Error states are not considered
- Loading and empty states are not defined
- The flow assumes ideal network conditions
- The user has no way to recover from errors
- Keyboard and screen reader users are not considered

## Verification

- [ ] Happy path is mapped end-to-end
- [ ] Error states are designed for each failure point
- [ ] Loading, empty, and error states are defined
- [ ] The user can recover from errors
- [ ] The flow works for all user roles
- [ ] Alternative flows are considered
