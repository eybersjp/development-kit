# skill-routing

**Source**: `skills/skill-routing/SKILL.md` · **Category**: Meta · **Compatibility**: `opencode`

## Purpose

Maps user intent to the appropriate skill or workflow. The conductor uses it to determine which skills to activate for a given user request.

## Lifecycle Category

Meta — used at the start of any request or command.

## Trigger Conditions

- Start of any session or user request
- When the conductor needs to determine which skills to load
- When routing a command to the correct workflow (`/dk-status` uses it as its primary skill)

## When Not to Invoke

- Mid-task, when a stage-specific skill is already active

## Required Inputs

- The user request or command

## Preconditions

- The request can be classified into a lifecycle category

## Procedure

1. **Classify the request** using the signal-to-category table (vague idea → `idea-discovery`; bug report → `systematic-debugging`; "ship this" → `branch-completion`; etc.).
2. **Determine required skills**: primary, supporting, and conditional (e.g. `security-review` for auth tasks).
3. **Activate skills** into the current context.
4. **Route to the workflow** — commands map to workflow bundles via the routing table.

## Outputs

- The activated skill bundle for the current stage

## Invariants

- Skills are routed precisely — loading all skills at once is rejected (context bloat).
- The routing table, not intuition, decides skill selection.

## Dependencies

None.

## Related Agents

development-conductor (the primary consumer).

## Related Commands

`/dk-status` (primary), all commands (routing target).

## Verification Requirements

- [ ] Request category correctly identified
- [ ] Primary skill matches the request type
- [ ] Correct workflow activated

## Failure Behavior

- Unroutable requests are assigned to the closest category and adjusted by the conductor.

## Antigravity & OpenCode Behavior

- Used by the conductor in both environments. Under OpenCode it is installed and discoverable like every other skill.

## Practical Example

"Run the full plan automatically" routes to `subagent-driven-implementation` with the `/dk-build-auto` supporting bundle.

## Anti-Patterns

- Loading all skills at once
- Bypassing the routing table for direct skill activation
- Running multiple workflow stages simultaneously

## Maintenance Notes

When commands or skills are added or removed, update the routing table in `SKILL.md` and the [lifecycle-to-skill-map.md](lifecycle-to-skill-map.md).
