# /dk-test

**Source**: `commands/dk-test.md` · **Lifecycle Stage**: VERIFY

## Purpose

Runs task-specific verification including unit tests, integration tests, edge-case testing, and browser runtime checks. Confirms that acceptance criteria are met and that no regressions were introduced.

## When to Use

- After an implementation task completes.
- When you need to verify a specific task or set of tasks independently.
- When you want to run regression tests after a change.

## When NOT to Use

- Implementation has not been completed — implement first.

## Workflow

1. **Unit Tests**: Run the test suite for the implemented task.
2. **Integration Tests**: Verify components work correctly together.
3. **Browser Runtime Verification** (for UI tasks): Check console errors, network failures, DOM behavior, responsive layout, and accessibility.
4. **Regression Testing**: Confirm existing tests still pass.
5. **Edge-Case Testing**: Search for boundary conditions and unexpected inputs.
6. **Acceptance Criteria Verification**: Confirm all stated criteria pass.

## Skills Invoked

| Skill | Role |
| :--- | :--- |
| `verification-before-completion` | Primary — requires empirical evidence |
| `regression-testing` | Existing behavior intact |
| `edge-case-testing` | Boundary and failure conditions |
| `browser-runtime-verification` | Conditional — UI tasks only |

## Agents Invoked

- `test-engineer` (for complex test suites)

## Outputs

Test report with:
- Tests run and results
- Failing tests with error details
- Edge cases discovered
- Acceptance criteria status (pass/fail per criterion)
- Regression status

## Completion Criteria

All tests pass. No regressions. All acceptance criteria verified with empirical evidence.

## Related Commands

- `/dk-build` — previous step (implementation)
- `/dk-review` — next step after tests pass
- `/dk-debug` — if tests fail, use this for root-cause analysis
