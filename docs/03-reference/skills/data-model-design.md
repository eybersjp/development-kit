# data-model-design

**Source**: `skills/data-model-design/SKILL.md` · **Category**: Artifact · **Compatibility**: `opencode`

## Purpose

Designs data models, schemas, and migrations for persistent data changes. Used only when persistent data changes are required.

## Lifecycle Category

DESIGN.

## Trigger Conditions

- New or changed persistence (tables, schemas, migrations)
- `/dk-design` when the feature stores data

## When Not to Invoke

- When no persistent data changes are involved

## Required Inputs

- The specification's data requirements
- Existing schema and migration conventions (scout findings)

## Preconditions

- Data requirements are known

## Procedure

1. Identify entities, fields, and relationships.
2. Define constraints, keys, and indexes.
3. Plan reversible migrations.
4. Document the data model.

## Outputs

A data model design (template: `Data Model: [Entity]` in the skill; data model section of the design).

## Invariants

- Data integrity first: constraints, foreign keys, validation.
- Migrations reversible.

## Dependencies

`technical-design`.

## Related Agents

solution-architect-agent, database-implementer (consumer).

## Related Commands

`/dk-design` (supporting skill).

## Verification Requirements

- [ ] Entities, fields, relationships defined
- [ ] Constraints and indexes specified
- [ ] Migration reversibility planned

## Failure Behavior

- Irreversible changes flagged for explicit approval.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

For a registration feature, the model defines a `users` table with a unique constraint on email and an index, plus the migration to create it.

## Anti-Patterns

- Adding speculative columns or tables
- Designing migrations that cannot be rolled back

## Maintenance Notes

None specific.
