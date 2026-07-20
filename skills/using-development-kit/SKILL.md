---
name: using-development-kit
description: >-
  Loaded at session start. Teaches the agent how to use the Development Kit
  methodology: how to select skills, when to delegate, when not to code,
  how review gates work, and how to avoid bypassing the workflow.
compatibility: opencode
---

# Using Development Kit

## Overview

This skill is loaded automatically at session start. It teaches the agent how to use the Development Kit methodology — an opinionated AI software-development process that produces correct, simple, well-tested code without overengineering.

## When to Use

- Always. This skill is the foundation for all work in Development Kit projects.
- It activates at session start and informs all subsequent behaviour.

## Process

### 1. Understand the Methodology

The Development Kit follows this lifecycle:

```
UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE
```

Each stage activates one or more skills. The **development-conductor** agent coordinates the workflow.

### 2. Know the Always-On Rules

1. Inspect before editing.
2. Clarify before assuming.
3. Specify before implementing non-trivial work.
4. Reuse before creating.
5. Prefer native capability before adding dependencies.
6. Break work into small, testable tasks.
7. Use a fresh sub-agent for each implementation task.
8. Write or identify verification before implementation.
9. Review specification compliance before code style.
10. Test before declaring completion.
11. Simplify after correctness.
12. Do not start the next task while the current task has unresolved failures.

### 3. Know the Ponytail Ladder

Before writing any new code, traverse this ladder:

1. Does this need to exist?
2. Is the required behaviour already present?
3. Can existing project code be reused?
4. Can the standard library do it?
5. Can the native platform do it?
6. Can an installed dependency do it?
7. Can a small local change do it?
8. Only then create a new abstraction.

### 4. Know the Available Commands

| Command | Purpose |
|---------|---------|
| `/dk-idea` | Run idea discovery and requirements interview |
| `/dk-spec` | Create the required artifact set |
| `/dk-design` | Produce technical and visual design |
| `/dk-tasks` | Create task decomposition |
| `/dk-build` | Implement the next task through every gate |
| `/dk-build-auto` | Process the entire plan automatically |
| `/dk-test` | Run task-specific verification |
| `/dk-review` | Run full review cycle |
| `/dk-simplify` | Apply the simplicity ladder to the current diff |
| `/dk-debug` | Systematic root-cause analysis |
| `/dk-ship` | Final verification and release preparation |
| `/dk-status` | Show current workflow state |

### 5. Know the Available Agents

- **development-conductor**: Primary orchestrator
- **repository-scout-agent**: Codebase inspector
- **product-discovery-agent**: Idea clarifier
- **specification-agent**: Spec writer
- **artifact-selector-agent**: Minimum document selector
- **solution-architect-agent**: Smallest solution designer
- **task-planner-agent**: Task decomposer
- **implementation-agent**: Task implementer
- **test-engineer**: Verification writer
- **spec-reviewer**: Specification compliance checker
- **code-reviewer**: Code quality assessor
- **security-reviewer**: Security auditor
- **simplicity-reviewer**: Overengineering preventer
- **accessibility-reviewer**: Accessibility auditor and WCAG compliance reviewer
- **design-reviewer**: Visual design reviewer
- **frontend-implementer**: Frontend implementation specialist
- **backend-implementer**: Backend implementation specialist
- **database-implementer**: Database implementation specialist

### 6. Know When to Delegate

- The **development-conductor** should always be the primary agent for coordinating workflow.
- Specialist agents should be spawned for their specific domains.
- The conductor should NOT implement code itself — it delegates to specialist implementation agents.
- Implementation agents should be **fresh sub-agents** for each task.

### 7. Know When NOT to Code

- When the requirement is unclear — clarify first
- When the behaviour already exists — reuse first
- When a native or standard library feature can do it — use it first
- When a dependency is already installed and can handle it — use it first

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll just implement it quickly and clarify later" | Clarify first. Implementing the wrong thing wastes more time than asking a question. |
| "This code is simple enough to skip the spec" | Simple changes may be fine, but if there's any uncertainty, write the spec. |
| "I'm already in the code, I'll just make the change" | Inspect first. You may be in the wrong file or misunderstand the architecture. |
| "I'll add tests after it works" | Tests first (red-green-refactor). Writing tests after means they may never get written. |
| "This abstraction will be useful later" | YAGNI. Build for what's needed now, not what might be needed later. |
| "The review gates slow me down" | They catch mistakes. Every skipped gate is technical debt. |

## Red Flags

- Implementation starts without a specification review
- A task is marked complete without passing all verification gates
- Multiple tasks are being implemented in parallel
- The same agent implements multiple consecutive tasks
- Dependencies are added without justification
- Code is written but no tests exist for it
- The conductor is implementing code instead of delegating

## Verification

- [ ] The always-on rules are being followed
- [ ] The lifecycle stages are being respected
- [ ] Review gates are not being skipped
- [ ] Fresh sub-agents are used for implementation tasks
- [ ] The Ponytail ladder is being applied before new code
