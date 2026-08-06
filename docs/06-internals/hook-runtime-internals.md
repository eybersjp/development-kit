# Hook Runtime Internals

## Hook Inventory

| Hook | Trigger | Exports | Contract |
| :--- | :--- | :--- | :--- |
| `session-start.js` | Session start | `{ session }` | Metadata object (startedAt, methodology, version, rules) |
| `before-task.js` | Before each task | `validateTaskReadiness(task)`, `selectSkillsForTask(task)` | Readiness `{ready, issues}` + skill list |
| `after-task.js` | After each task | `verifyTaskGates(gates)`, `recordTaskCompletion(task, gates, implementation)` | Gate status + completion record |
| `before-completion.js` | Completion checkpoints | `checkCompletionReadiness(state)` | `{ready, issues, canShip}` |

## Runtime Model

- Hooks are **CommonJS modules** executed by the Antigravity hook runtime at lifecycle events.
- They are **pure functions of their inputs** — no load-time I/O, no global state.
- Exit/blocking semantics: hooks return verdicts; enforcement (stopping a task, blocking ship) is done by the conductor acting on those verdicts, not by the hook throwing.

## Error Handling

- Hooks avoid throwing: missing fields are collected as `issues[]` strings.
- `after-task` treats missing `securityReview` as passed (default true).
- If a hook throws in a non-supporting runtime, the session continues (hooks are advisory by design).

## Relationship to Lifecycle

| Lifecycle Point | Hook |
| :--- | :--- |
| Session start | `session-start` |
| Task start | `before-task` |
| Task end | `after-task` |
| Completion claim | `before-completion` |

## Version Note

`session-start.js` hard-codes `version: '0.1.0'`, which does not track `package.json` (`0.3.0`). Documented in [known-limitations.md](../11-appendices/known-limitations.md).

## Testing Hooks

Because hooks are pure modules, they can be unit-tested directly:

```bash
node -e "const h=require('./hooks/after-task.js'); console.log(h.verifyTaskGates({functionalVerification:true,specificationCompliance:true,codeQuality:true,simplicityReview:false}))"
```

See [before-task.md](../03-reference/hooks/before-task.md) and [task-state-and-completion-gates.md](../04-architecture/task-state-and-completion-gates.md).
