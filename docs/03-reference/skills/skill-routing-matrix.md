# Skill Routing Matrix

How the development-conductor routes user requests to skills (source: `skills/skill-routing/SKILL.md`).

## Request → Skill

| Request Signal | Category | Primary Skill |
| :--- | :--- | :--- |
| Vague idea, problem statement | Idea/Discovery | `idea-discovery` |
| "I want to build [feature]" | Definition | `feature-specification` |
| Design question, architecture | Design | `technical-design` |
| "Create tasks for [feature]" | Planning | `task-decomposition` |
| "Implement [specific task]" | Implementation | `subagent-driven-implementation` |
| "Run the full plan automatically" | Batch Implementation | `subagent-driven-implementation` |
| "Run the tests" | Verification | `verification-before-completion` |
| Bug report, failure | Debugging | `systematic-debugging` |
| "Review this code" | Review | `specification-compliance-review` |
| "Simplify this" | Simplification | `simplicity-review` |
| "Ship this" | Completion | `branch-completion` |
| "What's the status?" | Informational | `skill-routing` |

## Command → Skill Bundle

| Command | Primary | Supporting | Workflow |
| :--- | :--- | :--- | :--- |
| `/dk-idea` | idea-discovery | requirements-interview, idea-challenge, scope-definition | discovery |
| `/dk-spec` | adaptive-artifact-planning | feature-specification, acceptance-criteria-writing | definition |
| `/dk-design` | technical-design | data-model-design, api-contract-design, user-flow-design, design-direction | design |
| `/dk-tasks` | task-decomposition | subtask-decomposition, dependency-ordering, risk-first-planning, task-readiness-check | planning |
| `/dk-build` | subagent-driven-implementation | incremental-implementation, test-driven-development, existing-code-first, native-platform-first, dependency-restraint, minimal-diff, context-packing, test-strategy | implementation |
| `/dk-build-auto` | subagent-driven-implementation | incremental-implementation, test-driven-development, existing-code-first, native-platform-first, dependency-restraint, minimal-diff, context-packing, test-strategy, task-readiness-check, dependency-ordering, verification-before-completion, regression-testing | implementation |
| `/dk-test` | verification-before-completion | browser-runtime-verification, regression-testing, edge-case-testing | verification |
| `/dk-review` | specification-compliance-review | code-quality-review, security-review, accessibility-review, design-quality-review | review |
| `/dk-simplify` | simplicity-review | — | simplification |
| `/dk-debug` | systematic-debugging | — | debugging |
| `/dk-ship` | branch-completion | task-completion-gate, release-readiness | completion |
| `/dk-status` | skill-routing | — (informational) | informational |

## Selection Rules

1. **Classify first** — identify the request category.
2. **Primary skill** — the main methodology for the stage.
3. **Supporting skills** — context for the stage.
4. **Conditional skills** — activated only when triggered (e.g. `security-review` for auth tasks).
5. **Precision over volume** — never load all skills at once (context bloat).

See also [lifecycle-to-skill-map.md](lifecycle-to-skill-map.md) and [command-agent-skill-matrix.md](../../11-appendices/command-agent-skill-matrix.md).
