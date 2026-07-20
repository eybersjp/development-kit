---
name: technical-design
description: >-
  Creates an implementation-oriented design document. Describes the
  architecture, components, data flow, and interfaces needed to implement
  a feature.
compatibility: opencode
---

# Technical Design

## Overview

Creates an implementation-oriented design document. Describes the architecture, components, data flow, interfaces, and dependencies needed to implement a feature. The technical design bridges the gap between "what to build" (specification) and "how to build it" (implementation).

## When to Use

- After the specification is approved
- Before implementation begins (for standard or comprehensive work)
- When the implementation approach is non-obvious
- When multiple implementation options exist
- Before significant refactoring

## Process

### 1. Review the Specification

Understand the requirements, acceptance criteria, and scope.

### 2. Study the Existing Architecture

Using repository-scout findings, understand:
- Current architecture and patterns
- Existing components that can be reused
- Data models and schemas
- API contracts and interfaces
- Testing patterns

### 3. Apply the Ponytail Ladder

For every design decision:
1. Can existing code be reused?
2. Can the standard library handle this?
3. Can the native platform handle this?
4. Can an installed dependency handle this?
5. Only then create new code.

### 4. Design the Solution

Document:

**Approach**: High-level description of how the feature will be implemented.

**Reused Components**: Existing components, utilities, and patterns that will be reused.

**New Components**: New files or modules to be created, with justification.

**Data Flow**: How data moves through the system — from input through processing to storage and response.

**Interfaces**: APIs, module boundaries, function signatures, and contracts.

**Dependencies**: Any new dependencies with justification for each.

**Open Questions**: Design decisions that need clarification.

### 5. Review Design

Check:
- Does the design satisfy all requirements?
- Is this the simplest possible design?
- Does it follow existing conventions?
- Are new components justified?
- Are dependencies necessary?

## Technical Design Template

```
## Technical Design: [Feature Name]

### Approach
[1-3 paragraphs describing the approach]

### Reused Components
| Component | How It Is Used |
|-----------|----------------|
| [Component] | [Description] |

### New Components
| Component | Purpose | Justification |
|-----------|---------|---------------|
| [Component] | [Purpose] | [Why new code] |

### Data Flow
[Description of how data moves through the system]

### Interfaces
[API contracts, module boundaries, function signatures]

### Dependencies
| Dependency | Purpose | Justification |
|------------|---------|---------------|
| [Package] | [Purpose] | [Why needed] |

### Open Questions
- [Question 1]
- [Question 2]
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll design as I implement" | That leads to inconsistent architecture and missed edge cases. |
| "The design is obvious, I don't need to document it" | If it's obvious, it's quick to document. Documentation catches non-obvious issues. |
| "This design is too detailed for this small feature" | Scale the design to the feature. A small feature needs a small design. |
| "I'll skip the Ponytail ladder, I know what we need" | The ladder prevents unnecessary complexity. Use it. |

## Red Flags

- The design introduces new abstractions without justification
- The design doesn't reuse existing patterns
- New dependencies are proposed without clear justification
- The data flow is unclear or has gaps
- The design would be hard to test
- Design decisions are not explained

## Verification

- [ ] The design satisfies the specification requirements
- [ ] Existing components are reused where possible
- [ ] New components are justified
- [ ] Data flow is clearly described
- [ ] Interfaces are defined
- [ ] Dependencies are justified
- [ ] The design follows existing conventions
