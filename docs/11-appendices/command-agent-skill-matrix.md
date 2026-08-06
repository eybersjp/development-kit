# Command Agent Skill Matrix

Mapping of commands to their primary agents and activated skills.

| Command | Primary Agent | Key Skills Activated |
| :--- | :--- | :--- |
| `/dk-idea` | `product-discovery-agent` | `idea-discovery`, `requirements-interview`, `scope-definition` |
| `/dk-spec` | `specification-agent` | `feature-specification`, `acceptance-criteria-writing`, `test-strategy` |
| `/dk-design` | `solution-architect-agent` | `technical-design`, `data-model-design`, `api-contract-design` |
| `/dk-tasks` | `task-planner-agent` | `task-decomposition`, `dependency-ordering`, `risk-first-planning` |
| `/dk-build` | `implementation-agent` | `subagent-driven-implementation`, `test-driven-development`, `minimal-diff` |
| `/dk-test` | `test-engineer` | `verification-before-completion`, `regression-testing`, `edge-case-testing` |
| `/dk-review` | `spec-reviewer`, `code-reviewer` | `specification-compliance-review`, `code-quality-review` |
| `/dk-simplify` | `simplicity-reviewer` | `simplicity-review` |
| `/dk-ship` | `development-conductor` | `branch-completion`, `task-completion-gate`, `release-readiness` |

## Related Documentation

- [Lifecycle Responsibility Matrix](lifecycle-responsibility-matrix.md)
- [Complete Component Inventory](complete-component-inventory.md)
