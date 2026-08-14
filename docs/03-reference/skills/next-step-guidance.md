# next-step-guidance

**Source**: `skills/next-step-guidance/SKILL.md` · **Category**: Meta · **Compatibility**: `opencode`

## Purpose

Provides context-aware Suggested Next Step guidance at completed Development Kit workflow points based on lifecycle stage, verification state, safety gates, and approvals.

## Lifecycle Category

Meta — active across all lifecycle stages. Automatically evaluates transitions at completion points.

## Trigger Conditions

- At the completion of any Development Kit command or workflow
- When a workflow pauses for human approval or encounters a blocker
- When an automated workflow returns control to the user
- When guidance on the next valid lifecycle step is required

## When Not to Invoke / Suppression Rules

- During non-interactive batch automation while operations are actively running (guidance is displayed when execution pauses or finishes).
- When the overall workflow is completely finished (e.g. terminal `/dk-ship` completion).

## Required Inputs

- `completedCommand` (string)
- `lifecycleStage` (string: `UNDERSTAND`, `DEFINE`, `DESIGN`, `PLAN`, `IMPLEMENT`, `VERIFY`, `REVIEW`, `SIMPLIFY`, `COMPLETE`)
- `success` (boolean)
- `verificationStatus` (optional: `passed`, `failed`, `unverified`)
- `testsStatus` (optional: `passed`, `failed`)
- `reviewStatus` (optional: `passed`, `failed`, `pending`)
- `approvalStatus` (optional: `approved`, `pending`, `rejected`, `not_required`)
- `postSimplificationVerificationStatus` (optional: `passed`, `failed`, `unverified`, `pending`)
- `outstandingApprovals` (array of string)
- `blockers` (array of string)
- `isPaused` (boolean)
- `isWorkflowComplete` (boolean)

## Preconditions

- Command registry initialized with registered `/dk-*` commands.

## Procedure

1. Assemble the execution context (`NextStepContext`).
2. Validate schema and safety prerequisites.
3. Query `NextStepResolver` with context and safety rules.
4. Format output using `formatNextStepGuidance`.
5. Append guidance to the user response.

## Outputs

- A structured Markdown section with `## Suggested Next Step` (single recommendation) or `## Suggested Next Steps` (multiple recommendations).

## Invariants

- Only valid registered `/dk-*` commands may ever be recommended.
- Consequential actions (`/dk-ship`) require explicit `approvalStatus: approved`, `reviewStatus: passed`, `postSimplificationVerificationStatus: passed`, verified test results, and zero blockers. Absence of evidence fails closed.
- After `/dk-simplify`, the only primary recommendation is `/dk-test`; `/dk-ship` is strictly forbidden immediately after simplification. Earlier test results do not satisfy the post-simplification regression gate.
- Failures and blockers override forward progression.
- Guidance is not execution; no automatic command triggering.
- Paused workflows recommend `/dk-status` for state inspection.
- Unknown commands safely route to `/dk-status`.

## Dependencies

- `runtime/next-step/index.mjs`

## Related Agents

- `development-conductor` (primary orchestrator using next-step guidance)

## Related Commands

- All `/dk-*` commands (participate in lifecycle transitions)

## Verification Requirements

- [ ] Recommended command is valid in registry
- [ ] Consequential actions blocked without explicit approval and post-simplification verification
- [ ] Failures route to remediation (`/dk-debug`)
- [ ] Markdown formatting conforms to standard singular/plural template

## Failure Behavior

- If input or context schema is malformed, an actionable error is written to `stderr` with exit code `1`.
- If an unknown command is supplied, safe `/dk-status` inspection is recommended.

## Practical Example

After `/dk-build` completes the implementation of all tasks:

```markdown
## Suggested Next Step

1. `/dk-test`
   Verify the completed implementation, tests, documentation, and repository state before progressing.
```
