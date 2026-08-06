# verification-before-completion

**Source**: `skills/verification-before-completion/SKILL.md` · **Category**: Verification · **Compatibility**: `opencode`

## Purpose

Requires fresh evidence before claiming success. A task is not complete because the implementation agent says it is complete.

## Lifecycle Category

VERIFY.

## Trigger Conditions

- Before any completion claim (task, feature, or project)
- After any implementation or simplification

## When Not to Invoke

- When evidence is already fresh and current

## Required Inputs

- The implementation and its acceptance criteria
- Test and review results

## Preconditions

- Implementation exists

## Procedure

1. Run the verification suite (unit, integration, browser).
2. Verify acceptance criteria against observable results.
3. Confirm no regressions.
4. Only then allow the completion claim.

## Outputs

- Fresh verification evidence and a gate summary

## Invariants

- Completion claims require fresh evidence — never the implementer's word alone.
- Verification is re-run after any change (including simplification).

## Dependencies

`test-strategy`, `test-driven-development`.

## Related Agents

test-engineer (primary executor).

## Related Commands

`/dk-test` (primary), `/dk-build`, `/dk-build-auto`, `/dk-ship` (supporting).

## Verification Requirements

- [ ] Tests run and pass
- [ ] Acceptance criteria verified
- [ ] No regressions

## Failure Behavior

- Missing or stale evidence blocks the completion claim.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

After the simplicity reviewer recommends removals, the conductor re-runs the suite before accepting the task as complete (the mandatory task loop step 12).

## Anti-Patterns

- Trusting "done" without evidence
- Claiming completion with stale test results

## Maintenance Notes

The core of the mandatory-task-loop rule: "A task is not complete because the implementation agent says it is complete."
