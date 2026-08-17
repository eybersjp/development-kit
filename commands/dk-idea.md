---
name: dk-idea
description: >-
  Refine a rough idea into a concrete concept with problem definition, user
  identification, success criteria, and requirement categorisation.
---

# /dk-idea

## Purpose

Takes a rough idea and refines it into a concrete, well-defined concept. Runs the full idea discovery process: requirements interview, idea challenge, scope definition, and documentation.

## Workflow

### 1. Understand
Read the user's request. Identify what is clearly stated and what needs clarification.

### 2. Requirements Interview & Design System Discovery
Spawn the **product-discovery-agent** to conduct the requirements interview. Surface requirements, preferences, assumptions, and constraints.

If the project includes a visual user interface, prompt early for visual references:

```text
Design System Setup

This project includes a user interface.
Do you have visual references you want the application to follow?

You can provide:
- screenshots
- application/website screens
- mockups
- Figma exports/images
- competitor/interface references
- existing project UI
- an existing design.md

Options:
1. Attach design references
2. Use an existing design.md
3. Derive the design system from an existing application
4. Create a new design direction without references
5. Defer for now (blocks first frontend implementation)
```

### 3. Idea Challenge
Test assumptions. Is this the real problem? Does it need to exist? Is there a simpler approach? Challenge the proposed solution against the problem.

### 4. Scope Definition
Separate into:
- Must have
- Should have
- Could have
- Explicitly excluded

### 5. Determine Artifact Level
Spawn the **artifact-selector-agent** to determine whether a full idea brief is needed or a lighter artifact suffices (small, standard, or comprehensive).

### 6. Idea Brief
Document the output using the appropriate template:
- Problem statement
- Intended users
- Success criteria
- Requirements (must/should/could)
- Assumptions
- Constraints
- Risks
- Open questions

## Skills Activated

Primary:
- `idea-discovery` — Turns a rough idea into a concrete concept

Supporting:
- `requirements-interview` — Focused questions to surface requirements and assumptions
- `idea-challenge` — Tests whether the proposed solution solves the real problem
- `scope-definition` — Defines must-have, should-have, could-have, and excluded items

Conditional:
- `adaptive-artifact-planning` — Determines whether a full idea brief is needed or a lighter artifact suffices

## Sub-Agents

- product-discovery-agent (primary — conducts requirements interview)
- artifact-selector-agent (conditional — determines artifact level)

## Output

An idea brief document with problem statement, users, success criteria, requirements, assumptions, constraints, risks, and open questions.
