---
name: status
description: >-
  Show the current workflow state: active lifecycle stage, current task,
  completed tasks, pending reviews, and any blocked items.
---

# /status

## Purpose

Shows the current workflow state: active lifecycle stage, current task, completed tasks, pending reviews, and any blocked items. Useful for checking progress and determining what to do next.

## Workflow

### 1. Gather State
Collect current state information:
- Active lifecycle stage (UNDERSTAND, DEFINE, DESIGN, PLAN, IMPLEMENT, VERIFY, REVIEW, SIMPLIFY, COMPLETE)
- Current task (if any)
- Completed tasks with gate results
- Pending tasks from the task plan
- Blocked items with reasons
- Pending reviews (spec compliance, code quality, security, accessibility, design, simplicity)
- Unresolved issues from previous reviews

### 2. Report
Present a clear status summary showing:
- Where you are in the lifecycle
- What's currently being worked on
- What's done
- What's next
- What's blocked

## Skills Activated

- `skill-routing` — Determines which workflow stage is active and which skills are loaded
- `using-development-kit` — Methodology context for interpreting the workflow state

## Sub-Agents

None. This command is informational only.

## Output

```
## Status Report

### Lifecycle Stage
[Current stage: UNDERSTAND, DEFINE, DESIGN, PLAN, IMPLEMENT, VERIFY, REVIEW, SIMPLIFY, COMPLETE]

### Current Task
[Task name and status]

### Completed Tasks
- [Task 1] ✓ — All gates passed
- [Task 2] ✓ — All gates passed

### Pending Tasks
- [Task 3]
- [Task 4]

### Blocked Items
- [Item] — [reason]

### Pending Reviews
- [Type of review needed]

### Workflow State
- Skills active: [active skill names]
- Waiting on: [user input / implementation / review / tests]
```
