# Development Conductor Internals

## Operating Model

The conductor is a **prompt-defined orchestrator** (an agent persona in `agents/development-conductor.md`), not a program. Its behaviour is enforced by:

1. The agent definition itself (Role, Responsibilities, Workflow, Key Rules)
2. The `using-development-kit` and `skill-routing` skills (loaded at session start)
3. `AGENTS.md` always-on rules (loaded by `hooks/session-start.js`)
4. Lifecycle hooks at task/completion boundaries

## Coordination Decisions

| Decision | Mechanism |
| :--- | :--- |
| Which skill bundle to activate | `skill-routing` routing table (request → primary/supporting) |
| Which agent to spawn | Stage mapping (commands → specialist agents) |
| Whether a task is ready | `task-readiness-check` + `hooks/before-task.js` |
| Whether a task is complete | `task-completion-gate` + `hooks/after-task.js` + `hooks/before-completion.js` |
| Whether to proceed past a failure | Gate verdicts (tests, spec review, code review, simplicity) |

## Context Boundaries

- The conductor holds workflow state (approved artifacts, current task, gate results), not full repository context.
- Per-task context is packed via `context-packing` into the fresh agent's package.
- This boundary keeps the conductor's context stable across long projects.

## State Transitions

```
command received → classify → stage active → approvals gated
→ task loop (readiness → implement → verify → review → simplify → re-test)
→ complete → next task or ship
```

There is **no persistent state file** — state is re-derived from artifacts and reports. See [task-state-and-completion-gates.md](../04-architecture/task-state-and-completion-gates.md).

## Failure Handling

- **Test failure** → route to test-engineer + fresh implementation agent
- **Review failure** → route back to implementation (fresh agent)
- **Blocker** → surface to user with options
- **Ambiguity** → sequential-questioning interview

## Known Constraints

- The conductor's enforcement power depends on the runtime honouring agent instructions — there is no hard programmatic gate (see [known-limitations.md](../11-appendices/known-limitations.md)).

See [internal-operating-model.md](internal-operating-model.md) and [agent-orchestration.md](../04-architecture/agent-orchestration.md).
