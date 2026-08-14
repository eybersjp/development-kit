---
name: next-step-guidance
description: >-
  Provides context-aware Suggested Next Step guidance at completed Development
  Kit workflow points based on lifecycle stage, verification state, safety gates,
  and approvals.
compatibility: opencode
---

# Development Kit Next-Step Guidance

## Overview

Development Kit Next-Step Guidance is a first-class, context-aware capability that automatically computes and appends a **Suggested Next Step** section to completed Development Kit responses. It directs the user to the single most logical valid `/dk-*` command based on the completed action, current lifecycle stage, test and verification state, outstanding human approval gates, safety policies, and registered commands.

## When to Use

- At the completion of any user-facing Development Kit command or workflow (`/dk-idea`, `/dk-spec`, `/dk-design`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, `/dk-status`, `/dk-research`, `/dk-autopilot`).
- When a workflow pauses for human approval or encounters a blocker.
- When an automated workflow returns control to the user.
- Whenever guidance on the next valid lifecycle step is required.

## Process

### 1. Assemble Execution Context

Gather the relevant context attributes:
- `completedCommand`: The command that just executed (e.g. `/dk-build`)
- `previousCommand`: Previous command before recovery (e.g. `/dk-test`)
- `lifecycleStage`: The current canonical lifecycle stage (`UNDERSTAND`, `DEFINE`, `DESIGN`, `PLAN`, `IMPLEMENT`, `VERIFY`, `REVIEW`, `SIMPLIFY`, `COMPLETE`)
- `success`: Boolean indicating whether the operation succeeded
- `verificationStatus`: `passed`, `failed`, or `unverified`
- `testsStatus`: `passed` or `failed`
- `reviewStatus`: `passed`, `failed`, or `pending`
- `approvalStatus`: `approved`, `pending`, `rejected`, or `not_required`
- `postSimplificationVerificationStatus`: `passed`, `failed`, `unverified`, or `pending`
- `outstandingApprovals`: List of pending human approval gate tokens or identifiers
- `blockers`: List of active blocking issues
- `remainingTasks`: Number of uncompleted tasks remaining in the plan
- `isAutomated`: Boolean indicating whether execution is within a non-interactive automated loop
- `isPaused`: Boolean indicating whether execution is paused

### 2. Query Central Resolver

Pass the context to `NextStepResolver` (`resolveNextStep(context)`). The resolver applies the core recommendation rules:

1. **Valid commands only**: Only commands present in the canonical command registry can be recommended.
2. **Lifecycle-aware**: Recommendations strictly follow the canonical progression (`UNDERSTAND` → `DEFINE` → `DESIGN` → `PLAN` → `IMPLEMENT` → `VERIFY` → `REVIEW` → `SIMPLIFY` → `COMPLETE`).
3. **Failure overrides progression**: Failures, test breakages, or active blockers route to remediation (`/dk-debug` or re-testing) rather than forward progression.
4. **Consequential multi-gate safety predicate**: Consequential commands (specifically `/dk-ship`) require all 9 positive conditions: `success === true`, `approvalStatus === 'approved'`, `verificationStatus === 'passed'`, `testsStatus === 'passed'`, `reviewStatus === 'passed'`, `postSimplificationVerificationStatus === 'passed'`, empty `blockers`, empty `outstandingApprovals`, and `!isAutomated`. Absence of evidence fails closed.
5. **Post-simplification gate**: After `/dk-simplify`, the only primary recommendation is `/dk-test`. Earlier test passes do not satisfy the post-simplification regression gate.
6. **No unnecessary repetition**: Avoids recommending the identical command unless iterative tasks remain.
7. **One primary recommendation**: Returns exactly one primary recommended command (and optional secondary recommendations, capped at 3).
8. **No recommendation when inappropriate**: Produces no recommendation section if the workflow is completed (`isWorkflowComplete: true`) or intermediate execution is suppressed during active automation.
9. **Guidance is not execution**: The feature provides recommendations for user execution; it does not automatically trigger actions.

### 3. Format and Append

Format the recommendations using `formatNextStepGuidance` or `appendNextStepGuidance`:

#### Single Recommendation

```markdown
## Suggested Next Step

1. `/dk-test`
   Verify the completed implementation, tests, documentation, and repository state before progressing.
```

#### Multiple Recommendations

```markdown
## Suggested Next Steps

1. `/dk-build`
   Recommended. Implement the next uncompleted task (2 tasks remaining).

2. `/dk-test`
   Run interim verification on completed tasks.
```

## Recommendation Rules Summary

| Stage / Condition | State | Primary Recommendation | Description |
| :--- | :--- | :--- | :--- |
| `UNDERSTAND` | Succeeded | `/dk-spec` | Create specification artifacts |
| `RESEARCH` | Succeeded | `/dk-spec` | Incorporate research evidence |
| `DEFINE` | Succeeded | `/dk-design` | Produce technical and visual design |
| `DESIGN` | Succeeded | `/dk-tasks` | Decompose into verifiable tasks |
| `PLAN` | Succeeded | `/dk-build` | Implement the first task |
| `IMPLEMENT` (tasks remaining) | Succeeded | `/dk-build` | Implement next uncompleted task |
| `IMPLEMENT` (all tasks done) | Succeeded | `/dk-test` | Verify implementation & test suite |
| `VERIFY` | Passed | `/dk-review` | Run full two-stage review cycle |
| `VERIFY` | Failed | `/dk-debug` | Root-cause diagnosis & repair |
| `REVIEW` | Passed | `/dk-simplify` | Apply Ponytail simplicity ladder |
| `REVIEW` | Failed | `/dk-build` | Address review findings |
| `SIMPLIFY` | Succeeded | `/dk-test` | Verify tests after simplification (no direct ship) |
| `COMPLETE` | Approved & Fully Verified | `/dk-ship` | Final verification & release prep |
| Outstanding Approval | Blocked | `/dk-review` / `/dk-status` | Review and satisfy approval gate |
| Active Blocker | Blocked | `/dk-debug` | Resolve active blockers |
| Paused Workflow | Paused | `/dk-status` | Inspect paused workflow state |

## Verification

- [ ] Command recommended exists in the canonical registry
- [ ] Recommendation respects the current lifecycle stage
- [ ] Failed gates or tests route to remediation
- [ ] Consequential actions are blocked without explicit approval and post-simplification verification
- [ ] Markdown formatting uses standard singular/plural `## Suggested Next Step(s)` structure
- [ ] No intermediate recommendation noise during non-interactive batch automation
