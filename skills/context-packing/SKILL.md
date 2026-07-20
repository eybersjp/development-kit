---
name: context-packing
description: >-
  Gathers only the relevant code, documents, conventions, and history for
  the current sub-agent. Prevents context bloat by delivering only what is
  needed for the task.
compatibility: opencode
---

# Context Packing

## Overview

Gathers only the relevant code, documents, conventions, and history for the current sub-agent. When spawning a fresh implementation agent, the conductor must provide enough context for it to do its job — but not so much that it drowns in irrelevant information.

## When to Use

- When spawning a fresh implementation sub-agent for a task
- When the repository-scout is preparing findings for another agent
- When preparing a task package for an implementation agent
- Any time context is being handed off between agents

## Process

### 1. Identify What Is Relevant

For the given task, determine what the sub-agent actually needs:

**Required (Always Include)**:
- Task objective and requirements
- Acceptance criteria
- Allowed scope and exclusions
- Relevant specification section
- Relevant architecture section
- Files the agent will need to modify

**Context-Dependent (Include When Relevant)**:
- Repository-scout findings (for unfamiliar code)
- Existing test locations and patterns
- Data model or schema definitions
- API contracts or interfaces
- UI component library and patterns

**Exclude**:
- Unrelated parts of the codebase
- Historical decisions not relevant to the task
- Full project documentation
- Skills and methodology instructions (the agent has its own persona)
- Previous task implementations

### 2. Gather Context

For each relevant file or area:
- Read only the specific parts needed
- Extract function signatures, type definitions, and interfaces
- Note relevant patterns and conventions
- Do not copy entire files unless the full file will be modified

### 3. Pack the Context

Format the context package:

```markdown
## Context Package

### Task Reference
[Link to task definition]

### Relevant Files
- `path/to/file1.ts` — Lines XX-YY: [What they contain]
- `path/to/file2.ts` — Lines XX-YY: [What they contain]

### Key Interfaces / Types
[Relevant type definitions]

### Patterns to Follow
[Specific conventions to match]

### Existing Tests
[Where to find related tests]

### Constraints
[Technical limitations the agent must respect]
```

### 4. Verify Completeness

Before handing off, verify:
- Does the agent have everything it needs to start?
- Is anything in the package irrelevant to this task?
- Could the agent successfully implement without asking clarifying questions?

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll send the whole file, it's faster" | Sending the whole file wastes context and distracts the agent. Send only what's needed. |
| "More context is always better" | More context dilutes focus. Pack only what's relevant. |
| "The agent can figure out what it needs" | That wastes context tokens on discovery instead of implementation. |
| "I'll include the full project structure so they understand" | They need the relevant parts, not the whole tree. |

## Red Flags

- Complete files are included when excerpts would suffice
- Agent asks basic questions that the context package should have answered
- The context package is larger than the implementation will be
- Previous task implementations are included for "reference"
- Full documentation is included

## Verification

- [ ] The context package contains only what is relevant to the task
- [ ] No entire files are included unnecessarily
- [ ] The agent has enough context to start implementing
- [ ] Task boundaries (scope, exclusions, files to modify) are clear
