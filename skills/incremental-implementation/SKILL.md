---
name: incremental-implementation
description: >-
  Implements one thin vertical slice at a time. Each slice adds end-to-end
  value and can be tested independently before the next slice begins.
---

# Incremental Implementation

## Overview

Implements one thin vertical slice at a time. Instead of building each layer completely (first all models, then all services, then all UI), each slice cuts through all layers and adds end-to-end value. Each slice is testable independently before the next slice begins.

## When to Use

- When implementing any feature with multiple layers (data, logic, UI)
- When building features with multiple components
- When implementing features with uncertain requirements
- When working on a feature where early feedback would be valuable

## Process

### 1. Define the Slices

Divide the feature into thin vertical slices. Each slice should:
- Cut through all layers (data → logic → presentation)
- Add independently testable value
- Be completable in a short time

**Example**: A lead management feature
- Slice 1: View a list of leads (read-only, all fields)
- Slice 2: Create a new lead (form + API + database)
- Slice 3: Edit an existing lead (pre-fill form, update API)
- Slice 4: Delete a lead (confirmation + delete API)
- Slice 5: Search and filter leads (search API + UI)
- Slice 6: Lead detail view (individual lead page)

### 2. Implement One Slice at a Time

For each slice:
1. Write end-to-end tests for the slice behaviour
2. Implement the data layer (model, migration, repository)
3. Implement the logic layer (service, validation)
4. Implement the presentation layer (API endpoint or UI component)
5. Verify the slice works end-to-end
6. Move to the next slice

### 3. Test Before Moving On

Each slice must be:
- Independently testable
- Tested before the next slice begins
- Working end-to-end (not just the new parts)

### 4. Refactor Between Slices

After each slice is complete and tested, refactor if needed before starting the next slice.

### 5. Validate with Stakeholders

After key slices (especially the first working slice), show the result to stakeholders for feedback. Adjust remaining slices based on feedback.

## Slice Planning Template

```
## Slices for: [Feature Name]

### Slice 1: [Name]
- **Value**: [What this slice enables]
- **Layers**: Data [schema/query] → Logic [service] → UI [component/endpoint]
- **Test**: [How to verify this slice]
- **Risk**: [Low/Medium/High]

### Slice 2: [Name]
- **Value**: [What this slice enables]
- **Layers**: Data → Logic → UI
- **Test**: [How to verify]
- **Risk**: [Low/Medium/High]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "It's more efficient to build each layer completely" | Building all of one layer before the next hides integration problems until the end. |
| "Vertical slices are harder to plan" | They're not harder to plan — they require thinking about end-to-end value rather than technical components. |
| "I'll build the whole data layer first, then move up" | That's horizontal slicing. You won't know if the data layer works for the UI until the UI exists. |
| "Thin slices mean more context switching" | Each slice is independent. There's no context switching — you finish one before starting the next. |

## Red Flags

- Layers are built completely before moving to the next layer (horizontal slicing)
- The first few slices don't produce end-to-end value
- Slices are too large to be completed quickly
- Slices are not independently testable
- Stakeholders see the feature for the first time when it's "done"
- Integration issues are discovered late

## Verification

- [ ] Each slice cuts through all layers
- [ ] Each slice is independently testable
- [ ] Each slice is tested before the next begins
- [ ] The first slice produces working end-to-end functionality
- [ ] Stakeholders can provide feedback after the first few slices
- [ ] Refactoring happens between slices, not at the end
