---
name: dk-design
description: >-
  Produce the technical and visual design for the approved specification.
  Activates the appropriate design skills based on what needs to be designed:
  technical architecture, data model, API contracts, user flows, or visual
  direction.
---

# /dk-design

## Purpose

Produces the technical and visual design for the approved specification. The solution-architect-agent determines the smallest compatible solution. Depending on the scope, data models, API contracts, user flows, and design direction may also be produced.

## Workflow

### 1. Study Architecture
Spawn the **repository-scout-agent** to understand the existing architecture, conventions, and reusable components.

### 2. Apply Ponytail Ladder
Before proposing any new code:
1. Can existing code be reused?
2. Can the standard library do it?
3. Can native platform features do it?
4. Can installed dependencies do it?
5. Only then create new abstractions.

### 3. Design the Solution
Spawn the **solution-architect-agent** to determine the smallest compatible solution:
- Existing components to reuse
- New components (with justification)
- Interfaces and data flow

### 4. Design Supporting Artifacts (Conditional)
Based on the scope of work:

- **Data model design**: If persistent data changes are required (new models, migrations)
- **API contract design**: If APIs or module boundaries are being defined or changed
- **User flow design**: If a user-facing workflow changes
- **Design direction**: For UI work, define visual language, typography, colour, and interaction patterns

### 5. Present for Approval
Show the design to the user for approval before proceeding.

## Skills Activated

Primary:
- `technical-design` — Creates an implementation-oriented design document

Supporting (conditional on scope):
- `data-model-design` — Data models, schemas, and migrations (persistent data changes only)
- `api-contract-design` — API contracts and module boundaries (API or interface changes only)
- `user-flow-design` — User workflows and journeys (UI workflow changes only)
- `design-direction` — Visual language, typography, colour, interaction patterns (UI work only)

Overarching:
- `using-development-kit` — Methodology context for the design phase
- `existing-code-first` — Search for reusable project code before designing new components

## Sub-Agents

- repository-scout-agent (architecture inspection)
- solution-architect-agent (solution design)

## Output

A technical design document including:
- Approach
- Reused components
- New components (with justification)
- Interfaces
- Data flow
- Open questions
- Conditional: data model, API contracts, user flows, design direction
