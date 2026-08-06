# Recovering from Failed Workflows

The lifecycle is deliberately gated: a failure stops the workflow so it can be fixed before continuing. This page explains how to recover.

## Failure Types

| Failure | Typical Symptom | Recovery |
| :--- | :--- | :--- |
| **Test failure** | `/dk-build` stops at verification | Fix is routed to implementation; re-run `/dk-build` |
| **Spec-compliance failure** | Review gate 1 fails | Scope creep or missed requirement identified; route back to implementation |
| **Code-quality failure** | Review gate 2 fails | Critical/major issues must be fixed; re-run the gate |
| **Task blocked mid-implementation** | Implementer reports a blocker | Decide with the user: adjust scope, escalate, or abort the task |
| **Installation failure** | Installer exits with an error | See [troubleshooting.md](troubleshooting.md) and [uninstalling.md](uninstalling.md) |

## General Recovery Procedure

1. **Establish state** — run `/dk-status` to see the active stage, current task, and blocked items.
2. **Identify the failing gate** — read the latest verdict (test report, review report).
3. **Fix, don't bypass** — route the fix back through the workflow:

```bash
/dk-debug      # root-cause the failure (reproduce → locate → fix → protect)
/dk-build      # resume the task through all gates again
```

4. **Verify recovery** — `/dk-test` and `/dk-review` confirm the fix holds.
5. **Resume** — `/dk-build` continues with the next task, or `/dk-build-auto` replays the remaining plan.

## Rules That Protect You

- **Do not start the next task while the current task has unresolved failures** — the conductor enforces this; do not override it manually.
- **Do not skip the failed gate** — the review order (spec compliance → code quality → simplicity) never changes.
- **Do not claim completion on the implementer's word** — fresh test evidence is required.

## When to Reset

If a task is fundamentally mis-specified, the clean path is:

```bash
/dk-status      # confirm where you are
/dk-spec        # revise the specification with the user
/dk-tasks       # re-plan affected tasks
/dk-build       # restart implementation
```

## When to Uninstall & Reinstall

For installation-level corruption (missing plugin dir, broken manifest):

1. [uninstalling.md](uninstalling.md) — remove the installed copies.
2. Reinstall with the correct mode: `npx development-kit init --project` (or `--all`, `--opencode`).
3. Verify with [verifying-installation.md](verifying-installation.md).

## Next Steps

- [troubleshooting.md](troubleshooting.md) — common errors and fixes
- [faq.md](faq.md)
