# Skills Index

Development Kit ships **43 skills** covering the full lifecycle from idea discovery through release readiness. Every skill has a `SKILL.md` with YAML frontmatter (`name`, `description`, `compatibility: opencode`) and a standard structure: Overview, When to Use, Process, Rationalizations, Red Flags, Verification.

## Skill Categories

| Category | Skills | Lifecycle Stage |
| :--- | :--- | :--- |
| **Meta** (4) | using-development-kit, skill-routing, repository-orientation, context-packing | Always / session start |
| **Idea & Definition** (5) | idea-discovery, requirements-interview, idea-challenge, scope-definition, acceptance-criteria-writing | UNDERSTAND → DEFINE |
| **Artifact** (8) | adaptive-artifact-planning, feature-specification, technical-design, data-model-design, api-contract-design, user-flow-design, design-direction, test-strategy | DEFINE → DESIGN |
| **Planning** (5) | task-decomposition, subtask-decomposition, dependency-ordering, task-readiness-check, risk-first-planning | PLAN |
| **Implementation** (7) | subagent-driven-implementation, incremental-implementation, test-driven-development, existing-code-first, native-platform-first, dependency-restraint, minimal-diff | IMPLEMENT |
| **Verification** (5) | verification-before-completion, systematic-debugging, browser-runtime-verification, regression-testing, edge-case-testing | VERIFY |
| **Review** (6) | specification-compliance-review, code-quality-review, security-review, accessibility-review, design-quality-review, simplicity-review | REVIEW |
| **Completion** (3) | task-completion-gate, branch-completion, release-readiness | COMPLETE |

## Full Catalogue

See [skill-catalogue.md](skill-catalogue.md) for the complete list with purposes.

## Routing & Selection

- [Skill Routing Matrix](skill-routing-matrix.md) — request signals → primary/supporting skills
- [Lifecycle to Skill Map](lifecycle-to-skill-map.md) — lifecycle stage → active skills

## Compatibility

All 43 skills declare `compatibility: opencode` in their frontmatter and are auto-discoverable by OpenCode when installed to `.opencode/skills/` (`.opencode/skills` is one of OpenCode's discovery paths). In Antigravity they are loaded from the plugin's `skills/` directory.

## Validation

Every `SKILL.md` is validated by `npm run validate` (checks frontmatter `name`/`description` and recommended `Overview`/`Process` sections). The plugin manifest references are validated for existence.
