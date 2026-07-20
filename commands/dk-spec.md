---
name: spec
description: >-
  Create the minimum required specification artifacts for the approved concept
  or idea.
---

# /dk-spec

## Purpose

Creates the minimum required specification artifacts for the approved concept or idea. The artifact-selector-agent determines what documents are actually needed based on the scale of work. Acceptance criteria are written using the acceptance-criteria-writing skill.

## Workflow

### 1. Determine Artifact Level
Spawn the **artifact-selector-agent** to assess scale and determine the minimum artifact set.

### 2. Create Required Artifacts
Spawn the **specification-agent** to create the specification artifacts based on the determined artifact level:
- **Small**: Task brief, acceptance criteria, test case
- **Standard**: Feature specification, technical design, task plan, acceptance criteria, test plan
- **Comprehensive**: Idea brief, PRD, user journeys, system architecture, data model, API contracts, security considerations, design direction, implementation roadmap, task plan, test strategy

### 3. Write Acceptance Criteria
Convert requirements into observable, testable conditions. Each criterion must be specific, measurable, and independently verifiable.

### 4. Present for Approval
Show the artifacts to the user for approval before proceeding.

## Skills Activated

Primary:
- `adaptive-artifact-planning` — Selects the minimum required artifact set

Supporting:
- `feature-specification` — Writes concise, precise feature specifications
- `acceptance-criteria-writing` — Converts requirements into testable conditions

Conditional:
- `idea-discovery` — If the concept needs further refinement

## Sub-Agents

- artifact-selector-agent (determines what to create)
- specification-agent (writes the spec)
- product-discovery-agent (if concept needs refinement)

## Output

A set of specification artifacts appropriate to the scale of work.
