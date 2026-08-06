# using-development-kit

**Source**: `skills/using-development-kit/SKILL.md` · **Category**: Meta · **Compatibility**: `opencode`

## Purpose

Loaded at session start. Teaches the agent how to use the Development Kit methodology: how to select skills, when to delegate, when not to code, how review gates work, and how to avoid bypassing the workflow.

## Lifecycle Category

Meta — always active. It is the entry-point skill for every session.

## Trigger Conditions

- At the start of any session in a Development Kit project
- When an agent needs to recall how the methodology works

## When Not to Invoke

- During a mid-workflow task when a stage-specific skill applies instead (stage skills take precedence).

## Required Inputs

- The session context and the user's request

## Preconditions

- Development Kit is installed in the environment

## Procedure

1. Orient the agent to the lifecycle: UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE.
2. Explain how commands map to workflow bundles and which skills each activates.
3. Explain the always-on rules and the Ponytail ladder.
4. Explain when to delegate to sub-agents and when the agent must not code.
5. Explain the review gate order and completion criteria.

## Outputs

- Correctly oriented agent behaviour for the session

## Invariants

- The lifecycle is never skipped or reordered.
- Implementation is delegated to fresh sub-agents.

## Dependencies

None (foundational).

## Related Agents

development-conductor (primary consumer).

## Related Commands

All commands (it frames their execution).

## Verification Requirements

- [ ] The agent can state the lifecycle and current stage
- [ ] The agent knows when not to code itself

## Failure Behavior

- If the methodology is bypassed, the always-on rules and mandatory task loop are re-applied.

## Antigravity & OpenCode Behavior

- Loaded automatically by `hooks/session-start.js` at Antigravity session start.
- Under OpenCode, it is one of the 43 skills installed to `.opencode/skills/` and auto-discoverable via its frontmatter `name`/`description`.

## Practical Example

At session start the hook loads this skill so the conductor knows to classify the user's request and route it through the correct command rather than coding directly.

## Anti-Patterns

- Bypassing the workflow "because this task is small"
- Implementing without delegation

## Maintenance Notes

Keep the lifecycle and rule descriptions in sync with `AGENTS.md` and the conductor agent definition.
