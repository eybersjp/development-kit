# Implementation Agent

**Source**: `agents/implementation-agent.md` · **Type**: Implementation (fresh sub-agent)

## Primary Responsibility

Implements a single assigned task according to the approved specification and design. It is always a **fresh sub-agent** — created for one task only, with no accumulated assumptions from previous work.

## Scope

- Implement the assigned task within allowed scope and exclusions
- Write tests first where behaviour changes (Red-Green-Refactor)
- Reuse existing code and follow project conventions
- Keep changes minimal and scoped to the task
- Report files changed, acceptance-criteria status, test results, dependencies added, and open issues

## Explicit Boundaries

- **One task per agent instance.** Never reused across tasks.
- Does not exceed the task scope (no unrelated refactoring, no extras).
- Does not add dependencies without justification (flags to the conductor instead).
- Does not decide to change the spec or design.

## Inputs

The full task package from the conductor: task description, relevant specification and design sections, allowed scope and exclusions, acceptance criteria, required tests, test strategy, context package, and repository-scout findings.

## Outputs

A completion report: files created/modified, acceptance-criteria status (each met or not), test results, dependencies added (with justification), and open issues.

## Skills Used

`subagent-driven-implementation`, `incremental-implementation`, `test-driven-development`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `context-packing` (as loaded by the conductor).

## Commands That Invoke It

`/dk-build`, `/dk-build-auto` (spawned fresh per task), `/dk-debug` (fix phase).

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | development-conductor, repository-scout-agent (findings) |
| **Downstream** | test-engineer (verification), spec-reviewer, code-reviewer, simplicity-reviewer (review gates) |

## Handoff Contract

The agent reports objective results (not claims of completion). The conductor decides completion based on gate results. A fresh agent instance is used for every task to prevent assumption drift.

## Required Context

- Task description, spec section, design section, scope and exclusions
- Acceptance criteria and required tests
- Repository-scout findings and context package

## Context That Must Not Be Supplied

- Other tasks' details
- Unrelated repository history
- Full specification (only the relevant section)

## Review / Verification Responsibilities

- Runs relevant tests locally before reporting
- Reports acceptance-criteria status honestly — the gates verify

## Failure & Escalation Behavior

- **Task cannot be completed as specified** → report the blocker, do not improvise scope
- **Dependency seems needed** → flag it to the conductor rather than adding it
- **Tests fail** → fix within scope or report the blocker

## Example

For "Add display-name validation", the agent writes the failing test first, implements the minimal validation function, reuses the existing error-message helper, runs the suite, and reports pass/fail per criterion.

## Anti-Patterns

- Implementing outside the task scope "while I'm here"
- Reusing context from a previous task
- Claiming completion without running tests
- Adding dependencies without justification

## Related Agents

[development-conductor.md](development-conductor.md) (spawner), [repository-scout-agent.md](repository-scout-agent.md), [test-engineer.md](test-engineer.md), specialist variants: [frontend-implementer.md](frontend-implementer.md), [backend-implementer.md](backend-implementer.md), [database-implementer.md](database-implementer.md).
