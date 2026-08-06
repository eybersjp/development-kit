# scope-definition

**Source**: `skills/scope-definition/SKILL.md` · **Category**: Idea & Definition · **Compatibility**: `opencode`

## Purpose

Defines must-have, should-have, could-have, and explicitly excluded items. Creates clear boundaries for what the implementation will and will not do.

## Lifecycle Category

UNDERSTAND → DEFINE.

## Trigger Conditions

- Feature requests with potential feature creep
- After the idea is approved, before specification

## When Not to Invoke

- When scope is already explicit and agreed

## Required Inputs

- The idea brief and any constraints (deadline, team size, platform)

## Preconditions

- The concept is approved

## Procedure

1. List every requested item.
2. Classify: must-have, should-have, could-have, explicitly excluded.
3. Justify exclusions (e.g. "AI predictions exceed MVP scope given the 2-week timeline").
4. Record the classification as the scope baseline.

## Outputs

A scope classification: must/should/could/excluded with rationale.

## Invariants

- Excluded items are explicit and justified — never silently dropped or silently added.
- Not everything requested is a must-have.

## Dependencies

`idea-discovery`, `idea-challenge`.

## Related Agents

product-discovery-agent, specification-agent (baseline for the spec's scope/exclusions sections).

## Related Commands

`/dk-idea` (supporting skill).

## Verification Requirements

- [ ] Every request classified
- [ ] Exclusions justified

## Failure Behavior

- New requests during implementation are routed back through scope definition (no mid-task creep).

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For the dashboard request, the evaluation expects: sales data + charts + tables must-have; email reports + dark mode should-have; AI predictions explicitly excluded with rationale.

## Anti-Patterns

- Accepting all requests as must-have
- Adding items mid-implementation

## Maintenance Notes

Evaluated by `evals/scope-definition/`.
