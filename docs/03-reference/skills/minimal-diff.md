# minimal-diff

**Source**: `skills/minimal-diff/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Keeps changes tightly scoped to the task. Prevents unrelated refactoring, formatting changes, and scope creep in implementation diffs.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Every implementation task (as a restraint principle)
- Before reviewing a diff for submission

## When Not to Invoke

- When the diff is already task-scoped

## Required Inputs

- The task scope and the produced diff

## Preconditions

- Implementation complete

## Procedure

1. Compare the diff against the task scope.
2. Remove unrelated refactoring, formatting changes, and out-of-scope edits.
3. Re-run tests after trimming.

## Outputs

- A task-scoped diff (reviewed against the diff checklist in the skill)

## Invariants

- The diff contains nothing outside the task scope.
- No opportunistic fixes.

## Dependencies

None.

## Related Agents

implementation agents (apply).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] No unrelated changes
- [ ] No formatting-only churn

## Failure Behavior

- Out-of-scope diffs are routed back to be trimmed.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

A validation task adds only the validator, its tests, and the wiring — it does not reformat the whole module or fix unrelated functions.

## Anti-Patterns

- "While I'm here" fixes
- Whole-file reformatting

## Maintenance Notes

None specific.
