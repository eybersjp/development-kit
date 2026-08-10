# Development Conductor

**Source**: `agents/development-conductor.md` · **Type**: Orchestrator

## Primary Responsibility

Coordinates the entire software development workflow from idea through completion. It never implements code itself — it selects skills, spawns specialist sub-agents, and enforces lifecycle gates.

## Scope

- Understands user requests and clarifies ambiguity
- Selects relevant skills for each lifecycle stage
- Spawns specialist agents per stage
- Enforces sequential task execution
- Prevents implementation before definition
- Stops when verification or review fails
- Manages the review order: specification compliance → code quality → simplification

## Explicit Boundaries

- **Never implements code itself.** Delegates to specialist sub-agents.
- **Never bypasses gates.** A task is not complete because an agent says so.
- **Never runs multiple tasks concurrently.**
- Does not modify repository files directly; all file changes flow through specialist agents.

## Inputs

- User request or command (`/dk-autopilot`, `/dk-idea`, `/dk-research`, `/dk-spec`, `/dk-design`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, `/dk-status`)
- Approved specifications, designs, and task plans
- Agent reports (scout findings, test reports, review verdicts)

## Outputs

- Spawned sub-agents and their task packages
- Workflow state (active lifecycle stage, current task, completed tasks, blocked items) for `/dk-status`
- Gate decisions: proceed, route back to implementation, or stop

## Skills Used

`skill-routing`, `using-development-kit`, `context-packing`, `task-readiness-check`, `existing-code-first`, `native-platform-first`, `dependency-restraint`, `minimal-diff`, `verification-before-completion`, plus stage skills selected per command via the routing table.

## Commands That Invoke It

All 14 commands (`/dk-autopilot`, `/dk-idea`, `/dk-research`, `/dk-spec`, `/dk-design`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, and `/dk-status`). The conductor is the entry point for every command.

## Upstream & Downstream Agents

| Direction | Agents |
| :--- | :--- |
| **Upstream** | User (direct request) |
| **Downstream** | All 17 specialist agents: repository-scout-agent, product-discovery-agent, specification-agent, artifact-selector-agent, solution-architect-agent, task-planner-agent, implementation-agent, test-engineer, spec-reviewer, code-reviewer, security-reviewer, simplicity-reviewer, accessibility-reviewer, design-reviewer, frontend-implementer, backend-implementer, database-implementer |

## Handoff Contract

Each spawned sub-agent receives a self-contained task package: task description, relevant specification and design sections, allowed scope and exclusions, acceptance criteria, required tests, repository-scout findings, and implementation restraint principles. The agent reports results back to the conductor; the conductor decides the next action.

## Required Context

- The full workflow state (which lifecycle stage is active, what is approved)
- The user request and all approved artefacts (spec, design, task plan)
- Review verdicts and test results from completed stages

## Context That Must Not Be Supplied

- Unapproved or speculative requirements
- Implementation details of code it has not delegated
- Full repository context for every task (context-packing applies)

## Review / Verification Responsibilities

- Enforces the gate sequence: spec compliance first, code quality second, simplification last
- Requires fresh test evidence before any completion claim
- Stops on critical review findings and routes back to implementation

## Failure & Escalation Behavior

- **Test failure** → route to test-engineer and implementation-agent for fixes
- **Critical review finding** → stop, route back to implementation
- **Task cannot be completed as specified** → surface to the user with options
- **Ambiguous requirements** → ask focused questions before proceeding

## Example

For `/dk-spec` the conductor routes: artifact-selector-agent (minimum artifact set) → specification-agent (write spec) → user approval gate. For `/dk-build` it runs the full task loop (see [agent-handoff-map.md](agent-handoff-map.md)).

## Anti-Patterns

- Implementing code itself to "save time"
- Reusing a long-running implementation agent across tasks
- Starting the next task while the current task has unresolved failures
- Running code-quality review before specification-compliance review

## Related Agents

All agents are orchestrated by the conductor. See [README.md](README.md) and [agent-responsibility-matrix.md](agent-responsibility-matrix.md).
