# Evaluations Index

Development Kit ships **11 evaluation suites** in `evals/`, one per evaluated skill/capability area.

## Suites

| Suite | Evaluated Skill | Scenario | Reference |
| :--- | :--- | :--- | :--- |
| **acceptance-criteria-writing** | acceptance-criteria-writing | Convert vague requirements into testable criteria | [acceptance-criteria-writing.md](acceptance-criteria-writing.md) |
| **autopilot-lifecycle** | dk-autopilot | End-to-end 9-stage lifecycle & security gates | [autopilot-lifecycle.md](autopilot-lifecycle.md) |
| **code-quality-review** | code-quality-review | Review a PR with common quality issues | [code-quality-review.md](code-quality-review.md) |
| **dependency-restraint** | dependency-restraint | Reject unnecessary dependencies | [dependency-restraint.md](dependency-restraint.md) |
| **idea-discovery** | idea-discovery | Clarify a vague feature request | [idea-discovery.md](idea-discovery.md) |
| **scope-definition** | scope-definition | Scope a request with feature creep | [scope-definition.md](scope-definition.md) |
| **simplicity-review** | simplicity-review | Remove overengineering, keep protections | [simplicity-review.md](simplicity-review.md) |
| **specification-compliance-review** | specification-compliance-review | Verify implementation against spec | [specification-compliance-review.md](specification-compliance-review.md) |
| **subagent-driven-implementation** | subagent-driven-implementation | Split a task into sub-agent assignments | [subagent-driven-implementation.md](subagent-driven-implementation.md) |
| **task-decomposition** | task-decomposition | Decompose an API endpoint into tasks | [task-decomposition.md](task-decomposition.md) |
| **test-driven-development** | test-driven-development | Implement via red-green-refactor | [test-driven-development.md](test-driven-development.md) |

## Common Scenario Format

Each scenario JSON contains: `skill`, `scenario` (description), `input` and/or `implementation` (the case), and `expected` (behavioural expectations: `must_be_testable`, `should_identify`, `must_not`, `verdict_contains`, etc.).

## Running Evaluations

There is currently **no automated evaluation runner** — scenarios are manual/semi-automated checklists executed against a live agent or model. See [evaluation-strategy.md](../../07-testing-quality-security/evaluation-strategy.md).

## Relationship to Validation

`npm run validate` does not execute evaluations; it validates component structure. Evaluations validate **agent behaviour** and are complementary.
