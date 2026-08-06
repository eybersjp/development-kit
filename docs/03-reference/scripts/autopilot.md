# `autopilot.mjs` Script Reference

The `scripts/autopilot.mjs` script provides the command-line interface and CLI adapter for the Development Kit Autopilot runtime subsystem (`v0.4.0`).

## Purpose

`autopilot.mjs` acts as the deterministic state and policy engine bridge for `development-conductor`. It evaluates workflow state, issues structured next actions, validates action results, and enforces approval policies.

## Usage

```bash
node scripts/autopilot.mjs --init [--autonomy=guided-autopilot|high-autonomy|review-every-stage]
node scripts/autopilot.mjs --status
node scripts/autopilot.mjs --next
node scripts/autopilot.mjs --begin-action --action=<actionId>
node scripts/autopilot.mjs --record-result [--input-file=<path> | --input-json=<json>]
node scripts/autopilot.mjs --renew-action --action=<actionId>
node scripts/autopilot.mjs --pause
node scripts/autopilot.mjs --resume
```

## Options

- `--init`: Initialize a new Autopilot workflow.
- `--status`: Display current workflow status and state.
- `--next`: Issue the next structured action for the conductor.
- `--begin-action`: Mark an action as `in_progress`.
- `--record-result`: Record an action result and advance lifecycle state.
- `--renew-action`: Extend the active-action lease timestamp up to the 2-hour maximum limit.
- `--pause`: Transition workflow state to `paused` and block state-modifying actions.
- `--resume`: Restore a paused workflow to `executing` status.

## Output Format

All operations return JSON payloads to standard output:
```json
{
  "success": true,
  "state": { ... }
}
```
