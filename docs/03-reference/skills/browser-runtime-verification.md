# browser-runtime-verification

**Source**: `skills/browser-runtime-verification/SKILL.md` · **Category**: Verification · **Compatibility**: `opencode`

## Purpose

Checks runtime behaviour in the browser: console errors, network failures, DOM behaviour, responsive layout, accessibility, and user interactions.

## Lifecycle Category

VERIFY.

## Trigger Conditions

- UI tasks
- After frontend implementation

## When Not to Invoke

- For backend-only tasks with no browser surface

## Required Inputs

- The running UI and the task's expected behaviour

## Preconditions

- The app runs in a browser

## Procedure

1. Check the console for errors and warnings.
2. Check network requests for failures.
3. Verify DOM behaviour and user interactions.
4. Verify responsive layout at common breakpoints.
5. Verify accessibility basics (keyboard, focus, contrast).
6. Report against the verification checklist in the skill.

## Outputs

- A browser verification report (checklist)

## Invariants

- Runtime evidence, not just static code review.
- Console/network errors are blocking findings.

## Dependencies

`verification-before-completion`.

## Related Agents

test-engineer (primary), frontend-implementer (self-verify).

## Related Commands

`/dk-test` (supporting skill).

## Verification Requirements

- [ ] Console clean
- [ ] Network requests succeed
- [ ] Responsive at tested breakpoints
- [ ] Keyboard navigation works

## Failure Behavior

- Console errors or broken interactions block completion.

## Antigravity & OpenCode Behavior

- Identical in both environments.

## Practical Example

After a modal task, the engineer opens the page, confirms no console errors, tabs through the dialog, verifies focus trapping, and checks the layout at 375px and 1280px.

## Anti-Patterns

- Verifying only happy-path clicks
- Ignoring console warnings

## Maintenance Notes

None specific.
