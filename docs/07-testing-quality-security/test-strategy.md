# Test Strategy

## Test Levels

| Level | Scope | Written By | Verified By |
| :--- | :--- | :--- | :--- |
| Unit | Functions, methods, components | implementation agents (TDD) | test-engineer |
| Integration | Component/service/layer interactions | test-engineer | test-engineer |
| Browser | UI behaviour, interactions, responsive | frontend-implementer | test-engineer (browser-runtime-verification) |
| Regression | Previously passing behaviour | test-engineer | test-engineer |

## TDD Discipline

For any behaviour change: **RED** (failing test first) → **GREEN** (minimum implementation) → **REFACTOR** (keep green). Enforced by the `test-driven-development` skill and verified by the corresponding evaluation scenario.

## Test-First Ordering

- Tests are written **before** implementation for behaviour changes.
- Subtasks are ordered test-first (subtask-decomposition).
- Acceptance criteria map to test levels via `test-strategy` (skill).

## Edge & Unhappy Paths

`edge-case-testing` actively searches for: empty/null inputs, boundary values, invalid formats, concurrency, network failures, permission scenarios, large data volumes, unusual user behaviour.

## Regression Protection

- `regression-testing` runs the existing suite after every change; no previously passing test may fail.
- `/dk-debug` always adds a regression test (protect step).

## Framework Tests (the repo itself)

The Development Kit repository is tested structurally:

- `npm run validate` — content structure
- `npm run doctor` — manifest sync
- `npm run docs:validate` — documentation integrity
- Hooks can be unit-tested directly (pure CommonJS functions)
- Installer changes are tested in scratch directories (see [testing-installer-changes.md](../05-developer-guide/testing-installer-changes.md))

## Coverage Targets

Coverage targets are defined per feature in the test strategy artifact (task plan's Required Verification). There is no repo-wide coverage percentage target — targets are feature-appropriate (see [known-limitations.md](../11-appendices/known-limitations.md)).

See [evaluation-strategy.md](evaluation-strategy.md) and [validation-reference.md](validation-reference.md).
