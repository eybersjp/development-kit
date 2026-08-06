# context-packing

**Source**: `skills/context-packing/SKILL.md` · **Category**: Meta · **Compatibility**: `opencode`

## Purpose

Gathers only the relevant code, documents, conventions, and history for the current sub-agent. Prevents context bloat by delivering only what is needed for the task.

## Lifecycle Category

Meta / IMPLEMENT — applied when assembling each task package.

## Trigger Conditions

- Before spawning any implementation sub-agent
- When a sub-agent needs focused context

## When Not to Invoke

- When the context package is already minimal and current

## Required Inputs

- The task scope
- Repository-scout findings

## Preconditions

- The task is defined

## Procedure

1. Identify exactly what the task needs: relevant files, interfaces, patterns, history.
2. Exclude unrelated code, docs, and history.
3. Assemble a focused context package.
4. Deliver the package with the task to the fresh sub-agent.

## Outputs

A minimal, task-scoped context package.

## Invariants

- Only relevant context is delivered — no bloat.
- The package is self-contained so the fresh agent needs nothing else.

## Dependencies

`repository-orientation` findings feed it.

## Related Agents

development-conductor (packer), implementation agents (consumers).

## Related Commands

`/dk-build`, `/dk-build-auto`.

## Verification Requirements

- [ ] Package contains only task-relevant material
- [ ] Fresh agent can implement without asking for more context

## Failure Behavior

- Missing context surfaces as agent questions; the conductor tops up the package.

## Antigravity & OpenCode Behavior

- Environment-agnostic; used by the conductor in both.

## Practical Example

For a single validation-function task, the package contains the relevant module, its tests, and the conventions section — not the entire codebase.

## Anti-Patterns

- Dumping the whole repository into the package
- Reusing a previous task's package

## Maintenance Notes

None specific.
