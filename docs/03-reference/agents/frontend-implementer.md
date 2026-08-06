# Frontend Implementer

**Source**: `agents/frontend-implementer.md` · **Type**: Implementation (specialist fresh sub-agent)

## Primary Responsibility

Specialist implementation agent for frontend UI tasks: components, pages, layouts, styles, and interactions — accessible, responsive, well-styled, and following the approved specification and design.

## Scope

- Implement UI components and pages
- Implement styles, layouts, and themes
- Implement interactions and animations
- Ensure accessibility, responsive design, and polished states (hover, focus, active, loading, empty, error)
- Follow the approved specification and design

## Explicit Boundaries

- Same fresh-sub-agent discipline as implementation-agent: one task per instance
- Does not build what already exists (reuse first)
- Does not add UI dependencies without justification

## Inputs

- Task, specification, design direction, and repository-scout findings (from the conductor)
- Design-review/accessibility-review guidance for the task

## Outputs

Implemented UI files plus the standard implementation completion report (files, acceptance-criteria status, test results, dependencies, open issues).

## Skills Used

`subagent-driven-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `browser-runtime-verification` (self-verify), plus accessibility/design skills via reviewers.

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (for UI tasks).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor, repository-scout-agent (findings) |
| **Downstream** | test-engineer, accessibility-reviewer, design-reviewer, spec-reviewer, code-reviewer |

## Handoff Contract

Returns implemented UI code with local verification (console, responsive, keyboard) reported. Review gates decide completion.

## Required Context

- Task package with design direction and UI-relevant scout findings

## Context That Must Not Be Supplied

- Backend task details

## Review / Verification Responsibilities

- Self-checks console errors, responsive layout, keyboard navigation, and accessibility basics before reporting

## Failure & Escalation Behavior

- **Design direction unclear** → escalate to the conductor before building
- **Native capability sufficient** → use it (Ponytail ladder)

## Example

For a modal component task, the frontend implementer reuses the existing button and overlay components, uses semantic HTML, traps focus, and adds reduced-motion support.

## Anti-Patterns

- Rebuilding existing components
- Using `<div>` for everything instead of semantic elements
- Adding CSS frameworks for a single component

## Related Agents

[implementation-agent.md](implementation-agent.md) (generic form), [backend-implementer.md](backend-implementer.md), [accessibility-reviewer.md](accessibility-reviewer.md), [design-reviewer.md](design-reviewer.md).
