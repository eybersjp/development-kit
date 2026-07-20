---
name: subagent-driven-implementation
description: >-
  Dispatches a fresh implementation sub-agent for each task. Prevents
  assumption drift by creating new agents rather than reusing long-running ones.
compatibility: opencode
---

# Subagent-Driven Implementation

## Overview

Dispatches a fresh implementation sub-agent for each task. Each sub-agent receives the task description, relevant specification section, design, allowed scope, acceptance criteria, required tests, and repository-scout findings. Fresh sub-agents prevent assumption drift — each one starts with only the context it needs.

## When to Use

- When starting a new implementation task
- When the previous task's implementation agent should not be reused
- When a task requires different expertise than the previous one

## Process

### 1. Prepare the Task Package
The conductor collects:
- Task description from the task plan
- Relevant section of the approved specification
- Relevant section of the technical design
- Allowed scope and exclusions
- Acceptance criteria
- Required tests
- Repository-scout findings (if applicable)

### 2. Spawn a Fresh Sub-Agent
Create a new implementation agent with:
- A clear, focused prompt containing only the task-relevant information
- The implementation agent persona
- The task package

The agent should be a **clean instantiation** — no context from previous tasks.

### 3. Task Package Format

```markdown
## Task: [Task Name]

### Objective
[One sentence]

### Specification Reference
[Link to relevant spec section]

### Design Reference
[Link to relevant design section]

### Scope
- You may modify: [files]
- You must not modify: [files]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Required Tests
- [Type of tests required]

### Repository Context
[Key findings from repository scout]

### Exclusions
- Do not: [prohibited action]
- Do not: [prohibited action]
```

### 4. Receive Results
The implementation agent reports:
- Files created or modified
- Acceptance criteria status
- Test results
- Dependencies added (if any)
- Open issues

### 5. Verify Before Continuing
Do NOT start the next task until:
- Tests pass
- Reviews pass
- The task is committed

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "It's faster to reuse the same agent" | Reusing agents causes context bleed and assumption drift. Fresh agents produce more consistent results. |
| "The current agent already knows the codebase" | Send the repository-scout findings with the new agent. It will be up to speed quickly. |
| "Creating a new agent takes effort" | The template makes it efficient. The quality improvement is worth it. |
| "I'll just keep going since I'm in the zone" | The zone is where assumptions accumulate. Break the zone. |

## Red Flags

- The same agent implements multiple tasks in a row
- Context from previous tasks bleeds into the current task
- The conductor modifies the implementation directly
- A task is marked complete without verification
- The task package lacks clear scope boundaries

## Verification

- [ ] A fresh sub-agent is spawned for each task
- [ ] The task package includes all necessary context
- [ ] Scope and exclusions are clear
- [ ] Acceptance criteria and tests are defined
- [ ] The agent reports completion with evidence
