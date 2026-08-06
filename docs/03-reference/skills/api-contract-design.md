# api-contract-design

**Source**: `skills/api-contract-design/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Designs API contracts and module boundaries. Used only when APIs or module boundaries are being defined or changed.

## Lifecycle Category

DESIGN.

## Trigger Conditions

- New or changed API endpoints, module boundaries, or inter-service contracts
- `/dk-design` when the feature exposes or consumes APIs

## When Not to Invoke

- When no API or boundary changes exist

## Required Inputs

- The specification's functional requirements
- Existing API conventions (scout findings)

## Preconditions

- The behaviour to expose is defined

## Procedure

1. Define resources, endpoints, methods, and payloads.
2. Specify status codes, error responses, validation rules, and auth requirements.
3. Keep contracts narrow and stable.
4. Document the contract.

## Outputs

API contracts (template: `API: [Resource Name]` in the skill).

## Invariants

- Narrow interfaces; contracts are the boundary of trust.
- Behavioural contracts, not implementation details.

## Dependencies

`technical-design`.

## Related Agents

solution-architect-agent, backend-implementer (consumer).

## Related Commands

`/dk-design` (supporting skill).

## Verification Requirements

- [ ] Endpoints, payloads, status codes defined
- [ ] Error and validation behaviour specified

## Failure Behavior

- Contract ambiguity escalated before implementation begins.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a registration endpoint, the contract defines POST payload (email, password, name), validation rules, duplicate-email error, JWT response, and error response shape — later used by backend implementation.

## Anti-Patterns

- Over-broad contracts with unused fields
- Changing contracts mid-implementation

## Maintenance Notes

None specific.
