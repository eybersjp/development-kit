# native-platform-first

**Source**: `skills/native-platform-first/SKILL.md` · **Category**: Implementation · **Compatibility**: `opencode`

## Purpose

Prefers browser, runtime, framework, and language-native capabilities over external packages and custom implementations.

## Lifecycle Category

IMPLEMENT.

## Trigger Conditions

- When a dependency or custom implementation is being considered
- As an implementation-restraint principle loaded for every task

## When Not to Invoke

- When the native capability is proven insufficient for the requirement

## Required Inputs

- The requirement and the candidate native capabilities

## Preconditions

- The requirement is understood

## Procedure

1. Check the platform capability reference (browser, runtime, framework, language).
2. Use native capabilities when they satisfy the requirement.
3. Only reach for dependencies when native options are genuinely insufficient.

## Outputs

- Native-first decisions with justification for any dependency

## Invariants

- Native capability before packages (Ponytail ladder step 5).

## Dependencies

None.

## Related Agents

implementation agents (apply).

## Related Commands

`/dk-build`, `/dk-build-auto` (supporting skill).

## Verification Requirements

- [ ] Native options considered
- [ ] Dependency justified against native options

## Failure Behavior

- Unjustified dependencies are rejected by dependency-restraint and simplicity review.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

Per `evals/dependency-restraint/scenario-01-unnecessary-dep.json`: `fetch`, `crypto.randomUUID()`, and `Intl.DateTimeFormat` cover axios, uuid, and moment use cases natively.

## Anti-Patterns

- Adding packages for what the platform already provides
- Reimplementing platform features badly

## Maintenance Notes

The skill includes a platform-capability reference table — update it as runtimes evolve.
