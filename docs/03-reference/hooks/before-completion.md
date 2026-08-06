# before-completion

**Source**: `hooks/before-completion.js` · **Language**: JavaScript (CommonJS)

## Trigger Point

Runs before marking any work as complete — end of task, feature, or project.

## Purpose

- Verify all tasks are complete
- Verify all gates passed for all tasks
- Check for unresolved issues
- Confirm documentation is updated
- Confirm tests are in place

## Inputs

- `state` object: `allTasksComplete`, `failedGates[]` (optional), `documentationUpdated`, `openIssues[]` (optional)

## Outputs

- `checkCompletionReadiness(state)` → `{ ready: boolean, issues: string[], canShip: boolean }`

## Side Effects

- Produces the completion-check verdict used by `/dk-ship`

## Environment Assumptions

- Node.js with CommonJS; Antigravity hook runtime

## Exit Behavior

Returns the readiness verdict; `canShip` is true only when no issues exist.

## Blocking Behavior

Conceptually gating: completion/ship claims require `canShip` (enforced by the conductor).

## Failure Handling

Issues are returned as strings; no throw paths.

## Security Considerations

No privileged operations.

## Relationship to Lifecycle

Implements the completion gate at the SIMPLIFY → COMPLETE boundary and feeds `release-readiness`.

## Maintenance Notes

Keep the state contract in sync with [branch-completion](../skills/branch-completion.md) and `hooks/after-task.js` gate recording.
