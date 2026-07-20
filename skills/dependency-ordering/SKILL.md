---
name: dependency-ordering
description: >-
  Determines the correct execution order for tasks and subtasks based on
  their dependencies. Ensures foundation work precedes dependent work.
---

# Dependency Ordering

## Overview

Determines the correct execution order for tasks and subtasks based on their dependencies. Foundation work must come before dependent work, risky work before safe work, and infrastructure before features.

## When to Use

- After tasks and subtasks are identified
- Before creating the final execution plan
- When tasks have complex dependency chains
- When multiple teams or agents are involved

## Process

### 1. Identify Dependencies

For each task or subtask, determine:
- **Code dependencies**: What code must exist first (interfaces, models, utilities)
- **Data dependencies**: What data or schema must be in place
- **Knowledge dependencies**: What must be understood first
- **Infrastructure dependencies**: What must be deployed or configured first
- **External dependencies**: What external systems must be available

### 2. Classify Dependency Types

| Type | Example | Flexibility |
|------|---------|-------------|
| Hard | Function A calls function B | Must be ordered |
| Soft | UI depends on API design | Can parallelise with stubs |
| Knowledge | Understanding the schema | Can parallelise with research |
| External | Third-party API availability | May block |

### 3. Apply Ordering Rules

1. **Hard dependencies first**: Tasks that others depend on must be first.
2. **Risky work before safe work**: Implement uncertain or risky work early, when there's time to recover.
3. **Foundation before features**: Core infrastructure, data models, and APIs before UI.
4. **Data before display**: Schema and data access before presentation.
5. **Internal before external**: Core logic before integrations.

### 4. Create the Execution Graph

Produce an ordered list where:
- No task appears before its dependencies
- Risky tasks are placed early
- Parallel tasks are identified (tasks with no mutual dependencies)

### 5. Validate the Order

Check:
- Does every task have its dependencies satisfied?
- Is risky work early enough to allow recovery?
- Can any tasks be parallelised safely?
- Is the order minimal (no unnecessary constraints)?

## Dependency Graph Template

```yaml
execution_order:
  - task: "Task 01: [Name]"
    description: [What it does]
    dependencies: []
    risk: high/medium/low

  - task: "Task 02: [Name]"
    description: [What it does]
    dependencies: [Task 01]
    risk: medium

  - task: "Task 03: [Name]"
    description: [What it does]
    dependencies: [Task 01]
    risk: low
    parallel_with: [Task 04]

  - task: "Task 04: [Name]"
    description: [What it does]
    dependencies: [Task 01]
    risk: low
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll just implement tasks in the order they make sense" | "Make sense" is subjective. Explicit ordering prevents blocks and rework. |
| "Everything depends on everything else" | That's unlikely. Map the actual dependencies, not the perceived ones. |
| "I'll put the easy stuff first" | Put the risky stuff first. Easy stuff can wait. |
| "Dependencies will become clear during implementation" | Unknown dependencies discovered during implementation cause rework. Identify them now. |

## Red Flags

- Risky work is scheduled last
- Tasks with no dependencies are placed after tasks with many dependencies
- Parallel opportunities are missed (agents waiting while others could work)
- The dependency graph has cycles (A depends on B, B depends on A)
- Hard dependencies are ignored in favour of ordering by preference
- Infrastructure tasks are scheduled alongside feature work

## Verification

- [ ] All hard dependencies are satisfied in the ordering
- [ ] Risky work is placed early in the schedule
- [ ] Parallel opportunities are identified and documented
- [ ] No circular dependencies exist
- [ ] Each task's dependencies are clearly stated
- [ ] The order is minimal (no unnecessary serialisation)
