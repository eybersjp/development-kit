---
name: dk-idea
description: >-
  Refine a rough idea into a concrete concept with problem definition, user
  identification, success criteria, requirement categorisation, and structured suggestion decisions.
---

# /dk-idea

## Purpose

Takes a rough idea and refines it into a concrete, well-defined concept. Runs the full idea discovery process: requirements interview, idea challenge, scope definition, structured suggestion identification, numbered decision menu presentation, and documentation.

## Interaction Principle

> **Commands start capabilities. Numbers control decisions.**

Whenever Development Kit requires a bounded Product Owner decision, prefer a numbered decision interface instead of requiring the user to type or repeat an instruction.

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

### 3. Idea Challenge & Structured Suggestions Discovery
Test assumptions. Is this the real problem? Does it need to exist? Is there a simpler approach? Challenge the proposed solution against the problem.

Discovered recommendations must become structured suggestion records (`IDEA-SUG-001`, `IDEA-SUG-002`, etc.) supporting:
- Stable ID
- Title & description
- Rationale & impact (`LOW` | `MEDIUM` | `HIGH`)
- Implementation effort (`LOW` | `MEDIUM` | `HIGH`)
- Recommended scope classification (`Must Have`, `Should Have`, `Could Have`, `Explicitly Excluded`)
- Decision state (`PENDING`, `ACCEPTED`, `DEFERRED`, `REJECTED`)
- Provenance and audit metadata

Do not allow AI-generated suggestions to become approved implementation scope merely because the AI recommended them. Only an explicit Product Owner decision may promote a suggestion into approved scope.

### 4. Dynamic Numbered Suggestion Decision Menu
Present the identified suggestions and generate a dynamic numbered decision menu:

```markdown
## Suggestions Identified
1. Offline-first support
   Reason: Site users may operate with unreliable connectivity.
   Recommended scope: Must Have
2. Audit logging
   Reason: Important system actions should be traceable.
   Recommended scope: Should Have
3. Advanced analytics
   Reason: Useful but not required for the initial release.
   Recommended scope: Could Have

## Decision Required
1. Accept 1 & 2; defer 3 ? Recommended
2. Accept all suggestions
3. Defer all suggestions
4. Custom response

Reply with 1, 2, 3, or 4.
```

The numbered response is resolved deterministically against the persisted active decision menu before any action is taken. An LLM must not guess bare numeric responses.

### 5. Deterministic Decision Resolution & Custom Response Flow
When the Product Owner replies with a number:
- **1, 2, 3**: Deterministically apply the structured actions (`ACCEPT`, `DEFER`, `REJECT`).
- **4 (Custom response)**: Allow granular accept/defer/reject selection or natural-language custom instruction.

### 6. Canonical Artifact Promotion & Lineage
When suggestions are accepted:
- Promoted into canonical `docs/01-concept/idea-brief.md` under the appropriate scope section with ID tag (e.g. `[IDEA-SUG-001]`).
- Deferred suggestions are recorded in `## Future Ideas (Explicitly Deferred)`.
- Rejections are persisted with rationale and authority so future agents do not repeatedly propose the same rejected capability.
- Lineage is preserved: `IDEA-SUG-001` -> `REQ` -> `AC` -> `TASK` -> `Development Contract`.

### 7. New Project vs Existing Project Routing
- **New Project**: Moves forward through `/dk-spec` -> `/dk-design` -> `/dk-tasks` -> `/dk-build`.
- **Existing Project**: Triggers impact analysis, amends affected canonical artifacts only via canonical reconciliation, and avoids restarting from scratch.

### 8. Determine Artifact Level & Final Idea Brief
Spawn the **artifact-selector-agent** to finalize the idea brief document with problem statement, users, success criteria, requirements, assumptions, constraints, risks, and open questions.

## Skills Activated

Primary:
- `idea-discovery` ? Turns a rough idea into a concrete concept

Supporting:
- `requirements-interview` ? Focused questions to surface requirements and assumptions
- `idea-challenge` ? Tests whether the proposed solution solves the real problem
- `scope-definition` ? Defines must-have, should-have, could-have, and excluded items

Conditional:
- `adaptive-artifact-planning` ? Determines whether a full idea brief is needed or a lighter artifact suffices

## Sub-Agents

- product-discovery-agent (primary ? conducts requirements interview)
- artifact-selector-agent (conditional ? determines artifact level)

## Output

An idea brief document with problem statement, users, success criteria, requirements, assumptions, constraints, risks, open questions, and recorded suggestion decisions.
