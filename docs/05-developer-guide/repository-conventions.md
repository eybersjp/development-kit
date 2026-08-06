# Repository Conventions

## Naming

| Component | Convention | Example |
| :--- | :--- | :--- |
| Commands | `dk-<verb>.md` in `commands/` | `dk-build.md` |
| Agents | `<role>.md` in `agents/`; reviewer/implementer suffixes | `spec-reviewer.md`, `backend-implementer.md` |
| Skills | `<kebab-case-name>/SKILL.md` in `skills/` | `acceptance-criteria-writing/SKILL.md` |
| Hooks | `<event>.js` in `hooks/` | `before-task.js` |
| Templates | `<noun>.md` in `templates/` | `task-plan.md` |
| Evaluations | `<skill-name>/scenario-XX-<topic>.json` in `evals/` | `scenario-01-tdd-cycle.json` |
| Scripts | `<purpose>.mjs` in `scripts/` | `validate-skills.mjs` |

## Content Conventions

- **Skills**: YAML frontmatter (`name`, `description`, `compatibility: opencode`) followed by `## Overview`, `## When to Use`, `## Process`, and (recommended) `## Rationalizations`, `## Red Flags`, `## Verification`.
- **Agents**: `# <Name>` heading, `## Role`, `## Responsibilities`, `## Process`, output format.
- **Commands**: YAML frontmatter (`name`, `description`) with `## Purpose`, `## Workflow`, skills activated, sub-agents, stopping conditions.
- **Markdown**: GFM, explicit language tags, relative links only, no local `file://` protocol URLs.

## Canonical vs Mirror

- Canonical root directories are the only edit locations.
- `.agents/plugins/development-kit/` is a mirror; changes there are lost on sync and violate the source-of-truth rules.

## Validation Contracts

- Every skill/agent/command must pass `npm run validate`.
- Every component must have a documentation page covered by `npm run docs:validate`.
- Every command, agent, skill, hook, template, or eval addition must update the docs in the same change (documentation-maintenance-policy).

## Commit Style

- Conventional, concise commit messages (repo history uses e.g. `feat:`, `fix:`).
- One logical change per commit; docs and their validated source change together.

See [developer-checklist.md](developer-checklist.md) for the pre-submission checklist.
