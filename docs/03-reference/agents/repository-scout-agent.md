# Repository Scout Agent

**Source**: `agents/repository-scout-agent.md` · **Type**: Context gatherer

## Primary Responsibility

Inspects the relevant parts of the codebase to understand architecture, find reusable implementations, identify project conventions, trace execution flow, and report constraints back to the conductor.

## Scope

- Read directory structure and module organisation
- Find existing reusable code, utilities, and shared components
- Identify naming, import/export, error-handling, testing, and documentation conventions
- Trace execution flow from entry point to relevant components
- Identify constraints (dependencies, deployment, platform)
- Report a structured repository-scout report

## Explicit Boundaries

- **Reads only.** Does not implement, refactor, or modify files.
- Does not make design or planning decisions; it reports findings.
- Does not write specifications or tests.

## Inputs

- Task or feature request from the conductor
- Relevant specification and design sections
- Scope guidance (which parts of the codebase to inspect)

## Outputs

A structured repository-scout report with: relevant files, architecture summary, reusable assets, conventions, constraints, execution flow, and test locations.

## Skills Used

`repository-orientation` (inspects unfamiliar repositories before changes begin).

## Commands That Invoke It

`/dk-idea`, `/dk-design`, `/dk-build`, `/dk-build-auto`, `/dk-debug` (via the conductor during each applicable stage).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor |
| **Downstream** | solution-architect-agent (design context), task-planner-agent (planning context), implementation-agent / frontend-backend-database-implementers (task context) |

## Handoff Contract

The conductor requests a scoped inspection; the scout returns the report. Downstream agents consume the report as factual context and do not re-inspect unless the scope changes.

## Required Context

- Which repository area is relevant to the current task
- Any existing reports or constraints already known

## Context That Must Not Be Supplied

- Unrelated areas of the codebase
- User preferences that do not affect the codebase inspection

## Review / Verification Responsibilities

None directly — the scout provides input for review by others.

## Failure & Escalation Behavior

- **Unreadable or missing code** → report the gap explicitly in the report
- **Conflicting evidence** → report both and flag the conflict
- **Scope too broad** → narrow the inspection to the requested area

## Example

Before implementing a new API endpoint, the scout inspects `src/handlers/` and `src/services/`, finds an existing validation utility and the project's error-response pattern, and reports both in the handoff package for the implementation agent.

## Anti-Patterns

- Reporting without inspecting the actual execution flow
- Recommending solutions instead of reporting facts
- Including large irrelevant file listings in the report

## Related Agents

[development-conductor.md](development-conductor.md) (caller), [solution-architect-agent.md](solution-architect-agent.md) and [implementation-agent.md](implementation-agent.md) (consumers).
