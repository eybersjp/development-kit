---
name: skill-routing
description: >-
  Maps user intent to the appropriate skill or workflow. The conductor uses
  this to determine which skills to activate for a given user request.
compatibility: opencode
---

# Skill Routing

## Overview

Maps user intent to the appropriate skill or workflow. The development-conductor uses this skill to determine which skills to activate for a given user request, ensuring the right methodology is applied to the right situation.

## When to Use

- At the start of any session or user request
- When the conductor needs to determine which skills to load
- When routing a command to the correct workflow

## Process

### 1. Classify the Request

Determine the type of request:

| Request Signal | Category | Primary Skill |
|----------------|----------|---------------|
| Vague idea, problem statement | Idea/Discovery | idea-discovery |
| "I want to build [feature]" | Definition | feature-specification |
| Design question, architecture | Design | technical-design |
| "Create tasks for [feature]" | Planning | task-decomposition |
| "Implement [specific task]" | Implementation | subagent-driven-implementation |
| "Run the full plan automatically" | Batch Implementation | subagent-driven-implementation |
| "Run the tests" | Verification | verification-before-completion |
| Bug report, failure | Debugging | systematic-debugging |
| "Review this code" | Review | specification-compliance-review |
| "Simplify this" | Simplification | simplicity-review |
| "Ship this" | Completion | branch-completion |
| "Open control center" | Informational | skill-routing |
| "What's the status?" | Informational | skill-routing |

### 2. Determine Required Skills

Based on the current lifecycle stage, select:
- **Primary skill**: The main methodology for this stage
- **Supporting skills**: Additional skills needed for context
- **Conditional skills**: Skills activated only when specific conditions are met (e.g., security-review for auth tasks)

### 3. Activate Skills

Load the selected skills into the current context. Skills are loaded from the `skills/` directory and activated for the current workflow stage.

### 4. Route to Workflow

Route the request to the appropriate workflow:
- Commands (`/dk-idea`, `/dk-spec`, `/dk-design`, etc.) map to specific workflow bundles
- Direct requests map to the most appropriate lifecycle stage
- The conductor coordinates the workflow, not the individual skills

## Routing Table

```yaml
commands:
  /dk-idea:
    primary: idea-discovery
    supporting:
      - requirements-interview
      - idea-challenge
      - scope-definition
    workflow: discovery

  /dk-research:
    primary: external-research
    supporting:
      - agent-reach-integration
    workflow: research

  /dk-spec:
    primary: adaptive-artifact-planning
    supporting:
      - feature-specification
      - acceptance-criteria-writing
    workflow: definition

  /dk-design:
    primary: technical-design
    supporting:
      - data-model-design
      - api-contract-design
      - user-flow-design
      - design-direction
    workflow: design

  /dk-tasks:
    primary: task-decomposition
    supporting:
      - subtask-decomposition
      - dependency-ordering
      - risk-first-planning
      - task-readiness-check
    workflow: planning

  /dk-build:
    primary: subagent-driven-implementation
    supporting:
      - incremental-implementation
      - test-driven-development
      - existing-code-first
      - native-platform-first
      - dependency-restraint
      - minimal-diff
      - context-packing
      - test-strategy
    workflow: implementation

  /dk-build-auto:
    primary: subagent-driven-implementation
    supporting:
      - incremental-implementation
      - test-driven-development
      - existing-code-first
      - native-platform-first
      - dependency-restraint
      - minimal-diff
      - context-packing
      - test-strategy
      - task-readiness-check
      - dependency-ordering
      - verification-before-completion
      - regression-testing
    workflow: implementation

  /dk-test:
    primary: verification-before-completion
    supporting:
      - browser-runtime-verification
      - regression-testing
      - edge-case-testing
    workflow: verification

  /dk-review:
    primary: specification-compliance-review
    supporting:
      - code-quality-review
      - security-review
      - accessibility-review
      - design-quality-review
    workflow: review

  /dk-simplify:
    primary: simplicity-review
    workflow: simplification

  /dk-debug:
    primary: systematic-debugging
    workflow: debugging

  /dk-ship:
    primary: branch-completion
    supporting:
      - task-completion-gate
      - release-readiness
    workflow: completion

  /dk-control:
    primary: skill-routing
    note: >-
      Informational/runtime command. Launches the project-scoped Development Kit
      Control Center web interface.
    workflow: informational

  /dk-status:
    primary: skill-routing
    note: >-
      Informational command. Shows the active lifecycle stage, current task,
      completed tasks, pending reviews, and blocked items. Uses skill-routing
      to determine the current workflow state.
    workflow: informational
```

## Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I don't need routing, I know what skill to use" | Routing ensures consistent methodology. Let the table decide. |
| "This request doesn't fit any category exactly" | Pick the closest category. The conductor can adjust. |
| "I'll just load all skills at once" | Loading unnecessary skills causes context bloat. Route precisely. |

## Red Flags

- Skills are loaded but not activated (wasted context)
- The routing table is bypassed for direct skill activation
- A request is routed to the wrong workflow
- Multiple workflow stages are active simultaneously

## Verification

- [ ] The request category is correctly identified
- [ ] The primary skill matches the request type
- [ ] Supporting skills are appropriate for the context
- [ ] The correct workflow is activated
