# Skills Index

Development Kit ships **45 skills** covering the full lifecycle from idea discovery through release readiness, including provider-neutral external research. Every skill has a `SKILL.md` with YAML frontmatter (`name`, `description`, `compatibility: opencode`) and a standard structure centered on purpose, process, constraints, and verification.

## Skill Categories

| Category | Skills | Lifecycle Stage |
| :--- | :--- | :--- |
| **Meta** (4) | using-development-kit, skill-routing, repository-orientation, context-packing | Always / session start |
| **Research & External Capability** (2) | external-research, agent-reach-integration | Conditional, primarily UNDERSTAND / DEFINE |
| **Idea & Definition** (5) | idea-discovery, requirements-interview, idea-challenge, scope-definition, acceptance-criteria-writing | UNDERSTAND -> DEFINE |
| **Artifact** (8) | adaptive-artifact-planning, feature-specification, technical-design, data-model-design, api-contract-design, user-flow-design, design-direction, test-strategy | DEFINE -> DESIGN |
| **Planning** (5) | task-decomposition, subtask-decomposition, dependency-ordering, task-readiness-check, risk-first-planning | PLAN |
| **Implementation** (7) | subagent-driven-implementation, incremental-implementation, test-driven-development, existing-code-first, native-platform-first, dependency-restraint, minimal-diff | IMPLEMENT |
| **Verification** (5) | verification-before-completion, systematic-debugging, browser-runtime-verification, regression-testing, edge-case-testing | VERIFY |
| **Review** (6) | specification-compliance-review, code-quality-review, security-review, accessibility-review, design-quality-review, simplicity-review | REVIEW |
| **Completion** (3) | task-completion-gate, branch-completion, release-readiness | COMPLETE |

## Research Skills

- [`external-research`](external-research.md) is the provider-neutral policy and routing skill. It decides when fresh evidence is needed, selects the smallest approved capability, records provenance, and treats all retrieved content as untrusted data.
- [`agent-reach-integration`](agent-reach-integration.md) documents Agent-Reach as an optional provider adapter. It never makes Agent-Reach a core dependency and does not authorize silent installation.

## Full Catalogue

See [skill-catalogue.md](skill-catalogue.md) for the complete list with purposes.

## Routing & Selection

- [Skill Routing Matrix](skill-routing-matrix.md) - request signals -> primary/supporting skills
- [Lifecycle to Skill Map](lifecycle-to-skill-map.md) - lifecycle stage -> active skills

## Compatibility

All 45 skills declare `compatibility: opencode` in their frontmatter and are auto-discoverable by OpenCode when installed to `.opencode/skills/` (`.opencode/skills` is one of OpenCode's discovery paths). In Antigravity they are loaded from the plugin's `skills/` directory.

External provider tooling is separate from skill compatibility. Development Kit does not automatically install Agent-Reach or other provider runtimes simply because the integration skill is present.

## Validation

Every `SKILL.md` is validated by `npm run validate` (checks frontmatter `name`/`description` and recommended `Overview`/`Process` sections). The plugin manifest references are validated for existence. The v0.5.0 release gate also runs `npm run research:validate` to verify the external research contract.
