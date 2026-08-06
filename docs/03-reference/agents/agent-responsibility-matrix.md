# Agent Responsibility Matrix

All 18 agents, their responsibility, lifecycle stage, and whether they are spawn-on-demand or per-task fresh agents.

| Agent | Responsibility | Lifecycle Stage | Invocation Model |
| :--- | :--- | :--- | :--- |
| **development-conductor** | Orchestrates the entire workflow; selects skills, spawns agents, enforces gates | All stages | Persistent coordinator |
| **repository-scout-agent** | Inspects the codebase; finds reusable code and conventions | UNDERSTAND / per-task context | Spawn-on-demand per stage or task |
| **product-discovery-agent** | Clarifies ideas and requirements into an idea brief | UNDERSTAND | Spawn-on-demand (`/dk-idea`) |
| **artifact-selector-agent** | Selects the minimum required artifact set and level | DEFINE | Spawn-on-demand (`/dk-spec`) |
| **specification-agent** | Writes concise, testable specifications with exclusions | DEFINE | Spawn-on-demand (`/dk-spec`) |
| **solution-architect-agent** | Designs the smallest compatible solution | DESIGN | Spawn-on-demand (`/dk-design`) |
| **task-planner-agent** | Breaks work into ordered, verifiable tasks | PLAN | Spawn-on-demand (`/dk-tasks`) |
| **implementation-agent** | Implements a single task; fresh per task | IMPLEMENT | **Fresh per task** (`/dk-build`, `/dk-build-auto`) |
| **frontend-implementer** | UI implementation specialist; fresh per UI task | IMPLEMENT | **Fresh per task** |
| **backend-implementer** | Backend implementation specialist; fresh per backend task | IMPLEMENT | **Fresh per task** |
| **database-implementer** | Database implementation specialist; fresh per database task | IMPLEMENT | **Fresh per task** |
| **test-engineer** | Writes and runs unit/integration/browser/regression tests | VERIFY | Per task verification |
| **spec-reviewer** | Verifies specification compliance (gate 1) | REVIEW | Per task gate |
| **code-reviewer** | Assesses code quality (gate 2) | REVIEW | Per task gate |
| **security-reviewer** | Security review for sensitive tasks (conditional) | REVIEW | Conditional gate |
| **accessibility-reviewer** | WCAG AA review for UI tasks (conditional) | REVIEW | Conditional gate |
| **design-reviewer** | Visual design quality review (conditional) | REVIEW | Conditional gate |
| **simplicity-reviewer** | Ponytail simplicity inspection (final gate) | SIMPLIFY | Per task gate |

## Review Gate Order (enforced)

1. **spec-reviewer** — specification compliance (always)
2. **code-reviewer** — code quality (always, after gate 1 passes)
3. **Conditional reviewers** — security / accessibility / design (when the task triggers them)
4. **simplicity-reviewer** — simplicity (after gates pass and tests are green)
5. Re-run tests after any simplification.

See [agent-handoff-map.md](agent-handoff-map.md) for orchestration and [command-agent-skill-matrix.md](../../11-appendices/command-agent-skill-matrix.md) for command-level routing.
