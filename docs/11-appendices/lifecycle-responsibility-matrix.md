# Lifecycle Responsibility Matrix

Matrix defining agent responsibilities and skill activation across each lifecycle stage.

| Lifecycle Stage | Lead Agent | Supporting Agents | Key Skills |
| :--- | :--- | :--- | :--- |
| **UNDERSTAND** | `product-discovery-agent` | `repository-scout-agent` | `idea-discovery`, `requirements-interview`, `idea-challenge` |
| **DEFINE** | `specification-agent` | `artifact-selector-agent` | `feature-specification`, `acceptance-criteria-writing` |
| **DESIGN** | `solution-architect-agent` | `repository-scout-agent` | `technical-design`, `data-model-design`, `api-contract-design` |
| **PLAN** | `task-planner-agent` | — | `task-decomposition`, `dependency-ordering`, `risk-first-planning` |
| **IMPLEMENT** | `implementation-agent` | `frontend/backend/database` | `subagent-driven-implementation`, `test-driven-development` |
| **VERIFY** | `test-engineer` | — | `verification-before-completion`, `regression-testing` |
| **REVIEW** | `spec-reviewer` | `code/security/a11y/design` | `specification-compliance-review`, `code-quality-review` |
| **SIMPLIFY** | `simplicity-reviewer` | — | `simplicity-review` |
| **COMPLETE** | `development-conductor` | — | `branch-completion`, `release-readiness` |

## Related Documentation

- [Command Agent Skill Matrix](command-agent-skill-matrix.md)
- [Development Lifecycle](../01-overview/development-lifecycle.md)
