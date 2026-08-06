# dependency-restraint

**Source**: `skills/dependency-restraint/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Requires justification before adding any new dependency. Every new dependency must provide value that the platform, standard library, or existing dependencies cannot.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- Any proposed new dependency
- As an implementation-restraint principle loaded for every task

## When Not to Invoke

- When no dependency is proposed

## Required Inputs

- The proposed dependency and its use case
- Available native and existing options

## Preconditions

- The requirement is understood

## Procedure

1. Ask: can the standard library do it? The native platform? An existing dependency?
2. Justify the dependency by the complexity it actually saves.
3. Reject "everyone uses it" justifications.
4. Document the justification (template: `Dependency Justification` in the skill).

## Outputs

- Dependency decisions, accepted only with justification

## Invariants

- Justification required for every new dependency.
- No popularity-based justifications.

## Dependencies

`native-platform-first`, `existing-code-first`.

## Related Agents

implementation agents (apply).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Every new dependency justified
- [ ] Native alternatives considered

## Failure Behavior

- Unjustified dependencies are removed or blocked by review gates.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/dependency-restraint/scenario-01-unnecessary-dep.json`: lodash, moment, axios, and uuid are all rejected — native equivalents (`setTimeout`, `Intl.DateTimeFormat`, `fetch`, `crypto.randomUUID()`) suffice.

## Anti-Patterns

- Adding a dependency "everyone uses"
- Wrapping native features in a package

## Maintenance Notes

Evaluated by `evals/dependency-restraint/`.
