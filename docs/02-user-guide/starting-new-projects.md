# Starting New Projects

## Option A — Install First, Then Build

1. Create the project directory and initialize your stack (e.g. `npm init`).
2. Install Development Kit:

```bash
npx development-kit init --project
# or standalone
npx development-kit init --all --dry-run
npx development-kit init --all
```

3. Start the methodology immediately — the empty or near-empty repo is exactly what `repository-orientation` expects:

```bash
/dk-idea
/dk-design-system   # (automatic if UI references supplied in /dk-idea)
/dk-spec
/dk-design
/dk-tasks
/dk-build
```

## Option B — Standalone Toolkit (No Antigravity)

If you are not using Antigravity and want the full component set in the project itself:

```bash
npx development-kit init --all
```

This copies `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `scripts/`, `AGENTS.md`, `README.md`, and the plugin manifest to your project root. `package.json` is deliberately **not** overwritten.

## Option C — OpenCode Projects

```bash
npx development-kit init --opencode
```

Installs compatible skills to `.opencode/skills/`, plus `opencode.json` and `AGENTS.md`, so OpenCode auto-discovers the skills.

## What the Methodology Does on a New Project

- The **repository-scout** confirms the project structure (even if minimal) before any change.
- **Artifact selection** keeps documents minimal — a greenfield CRUD feature does not need a PRD.
- **Tasks** are planned from the design; the first tasks build the foundation (schema, models, core logic).
- **TDD** is applied from the first task — the initial tests are part of the project's first commit.

## Greenfield Pitfalls

- **Over-planning**: let the artifact selector keep the artifact count low.
- **Premature dependencies**: `dependency-restraint` will push back; native platform features are preferred.
- **Skipping discovery**: even on an empty project, define the problem before coding.

## Next Steps

- [first-development-workflow.md](first-development-workflow.md)
- [choosing-the-correct-command.md](choosing-the-correct-command.md)
