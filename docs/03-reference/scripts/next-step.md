# `next-step.mjs` Script Reference

The `scripts/next-step.mjs` script provides the command-line interface for the Development Kit Next-Step Guidance subsystem.

## Purpose

`next-step.mjs` resolves context-aware next `/dk-*` commands using the centralized `NextStepResolver` engine. It evaluates completed commands, current lifecycle stages, test/verification status, review status, post-simplification verification, active blockers, safety policies, and explicit human approvals to output actionable next-step guidance.

## Usage

```bash
node scripts/next-step.mjs --command=/dk-build --stage=IMPLEMENT --success=true
node scripts/next-step.mjs --command=/dk-test --verification=failed
node scripts/next-step.mjs --context-file=context.json
node scripts/next-step.mjs --context-json='{"completedCommand":"/dk-idea","success":true}' --format=json
```

## Options

- `--command=<cmd>`: Completed command name (e.g., `/dk-build`). Must be a registered command.
- `--previous-command=<cmd>`: Previous command prior to recovery. Must be a registered command.
- `--stage=<stage>`: Current lifecycle stage (`UNDERSTAND`, `DEFINE`, `DESIGN`, `PLAN`, `IMPLEMENT`, `VERIFY`, `REVIEW`, `SIMPLIFY`, `COMPLETE`).
- `--success=<bool>`: Whether the operation succeeded (`true` or `false`, default: `true`).
- `--verification=<status>`: Verification outcome (`passed`, `failed`, `unverified`).
- `--tests=<status>`: Test suite outcome (`passed`, `failed`).
- `--review=<status>`: Review outcome (`passed`, `failed`, `pending`).
- `--approval=<status>`: Approval status (`approved`, `pending`, `rejected`, `not_required`).
- `--post-simplification=<status>`: Post-simplification verification outcome (`passed`, `failed`, `unverified`, `pending`).
- `--complete=<bool>`: Workflow complete status (`true` or `false`).
- `--automated=<bool>`: Automated execution status (`true` or `false`).
- `--paused=<bool>`: Paused execution status (`true` or `false`).
- `--approvals=<list>`: Comma-separated list of outstanding human approval tokens.
- `--blockers=<list>`: Comma-separated list of active blocking issues.
- `--remaining-tasks=<num>`: Number of uncompleted tasks remaining in the plan (integer >= 0).
- `--context-file=<path>`: Path to a JSON file containing a `NextStepContext` object.
- `--context-json=<json>`: Inline JSON string containing a `NextStepContext` object.
- `--format=<markdown|json>`: Output format (`markdown` or `json`, default: `markdown`).
- `--max=<num>`: Maximum recommendations to return (integer >= 1, default: 3).
- `--help`, `-h`: Show help message.

## Error Handling & Exit Codes

The CLI strictly validates all inputs and context objects:

- **Exit code `0`**: Context successfully parsed and recommendations resolved.
- **Exit code `1`**: Malformed JSON input, unreadable/missing context file, invalid numeric values (NaN, negative, float, unsafe), non-boolean values for boolean flags, unknown enum values, unknown command strings, or schema violations. On error, a descriptive message is written to `stderr` and no guidance output is emitted.

## Consequential Action Safety Gating

Consequential actions (specifically `/dk-ship`) are gated by strict fail-closed predicates:

- Recommending `/dk-ship` requires all 9 conditions to be explicitly satisfied:
  1. `success === true`
  2. `approvalStatus === 'approved'`
  3. `verificationStatus === 'passed'`
  4. `testsStatus === 'passed'`
  5. `reviewStatus === 'passed'`
  6. `postSimplificationVerificationStatus === 'passed'`
  7. `blockers` is an empty array
  8. `outstandingApprovals` is an empty array
  9. `isAutomated === false`
- Absence, null, undefined, unverified, pending, rejected, or malformed state fails closed.
- After `/dk-simplify`, only `/dk-test` is recommended; `/dk-ship` is strictly forbidden immediately after simplification. Earlier test passes do not satisfy the post-simplification regression gate.

## Output Format

### Markdown (Default)

Single recommendation outputs a singular heading:

```markdown
## Suggested Next Step

1. `/dk-test`
   Verify the completed implementation, tests, documentation, and repository state before progressing.
```

Multiple recommendations output a plural heading with a `Recommended.` prefix on the primary option:

```markdown
## Suggested Next Steps

1. `/dk-build`
   Recommended. Implement the next uncompleted task (2 tasks remaining).

2. `/dk-test`
   Run interim verification on completed tasks.
```

### JSON

```json
{
  "recommendations": [
    {
      "command": "/dk-test",
      "description": "Verify the completed implementation, tests, documentation, and repository state before progressing.",
      "priority": "primary",
      "reason": "Implementation finished; run verification gate."
    }
  ],
  "count": 1
}
```
