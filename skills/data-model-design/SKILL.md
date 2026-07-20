---
name: data-model-design
description: >-
  Designs data models, schemas, and migrations for persistent data changes.
  Used only when persistent data changes are required.
compatibility: opencode
---

# Data Model Design

## Overview

Designs data models, schemas, and migrations for persistent data changes. Used only when persistent data changes are required — not every feature needs a data model change.

## When to Use

- When new persistent data needs to be stored
- When existing data schemas need to change
- When new database tables or collections are required
- When existing data relationships change

## Process

### 1. Understand Requirements

Review the specification to understand what data needs to be stored, queried, and related.

### 2. Design the Model

Define:
- **Entities**: What objects or concepts need to be stored
- **Attributes**: What fields each entity has, with types and constraints
- **Relationships**: How entities relate to each other (one-to-one, one-to-many, many-to-many)
- **Indexes**: What queries need to be fast
- **Constraints**: Uniqueness, required fields, referential integrity

### 3. Apply Ponytail Ladder

Before creating new models:
1. Can an existing model be extended?
2. Can an existing field be repurposed?
3. Is a new model genuinely needed?
4. Are all proposed fields necessary?

### 4. Design Migrations

Define how to get from the current schema to the new schema:
- Create new tables/collections
- Add/modify/remove columns/fields
- Add/drop indexes
- Data migration steps (if needed)
- Rollback plan

### 5. Document

Produce:
- **Entity definitions**: Name, attributes, types, constraints
- **Relationship diagram**: How entities relate
- **Indexes**: Performance-critical queries
- **Migration plan**: Forward and rollback steps

## Data Model Template

```
## Data Model: [Entity Name]

### Attributes
| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| id | UUID | Y | Y | auto | Primary key |
| name | string | Y | N | — | Display name |

### Relationships
- **Belongs to**: [Entity] via [foreign key]
- **Has many**: [Entity] via [foreign key]

### Indexes
- `idx_field_name` on (field_name) — for queries by field

### Migration Plan
1. Create `table_name` with schema
2. Add foreign key constraint to `other_table`
3. Backfill data from `source_table` (if applicable)
4. Add indexes

### Rollback
1. Drop indexes
2. Drop table
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll add fields as needed during implementation" | Schema changes are expensive. Design them upfront. |
| "This model is simple, I don't need to document it" | Simple models benefit from documentation too — they show why certain decisions were made. |
| "We can add indexes later" | Indexes on existing large tables are expensive. Design them now. |
| "I'll use a generic model for everything" | Generic models hide complexity. Design specific models. |

## Red Flags

- Models are created for every feature (many features don't need new data)
- The model is overly generic (JSON blob, key-value pairs)
- No indexes are designed for query patterns
- Migrations are not reversible
- Data integrity is left to application code instead of the database
- The model duplicates existing data structures

## Verification

- [ ] Each entity is justified (not created unnecessarily)
- [ ] Attributes match the specification requirements
- [ ] Relationships are correctly defined
- [ ] Indexes support the required query patterns
- [ ] Migrations are reversible
- [ ] Data integrity constraints are defined at the database level
