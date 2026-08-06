# Adding an Agent

## Canonical Location

`agents/<role-name>.md`.

## Naming Rules

- `<role>.md` with a descriptive role (e.g. `spec-reviewer.md`, `database-implementer.md`).
- Reviewer agents: `<concern>-reviewer.md`; implementer specialists: `<domain>-implementer.md`.

## Required Metadata & Sections

```markdown
# <Agent Name>

## Role
[One paragraph: who you are and what you do.]

## Responsibilities
- [Bullet list of responsibilities]

## Process
### 1. ...
[Step-by-step process]

## Output Format
[The structured report the agent returns.]
```

The `validate-skills.mjs` validator requires a top-level heading and a Role or Responsibilities section.

## Registration & Discovery

1. The agent is discovered by the conductor from `agents/`; add it to the plugin manifest via `node scripts/sync-plugin.mjs`.
2. Add the agent to `AGENTS.md` (Agents list) if it should be spawnable from any command.
3. If it is a new specialist used by a command, add it to that command's `## Sub-Agents` list and to `skill-routing` if relevant.

## Required Docs

- `docs/03-reference/agents/<name>.md` — reference page with the full contract (responsibility, scope, boundaries, inputs, outputs, skills, commands, handoffs, context rules, failure behaviour, example, anti-patterns, related agents).
- Update `docs/03-reference/agents/README.md` table, `agent-responsibility-matrix.md`, and `agent-handoff-map.md` if orchestration changes.
- Update `docs/SUMMARY.md`.

## Required Validation

- `npm run validate` (agent structure)
- `npm run doctor` (manifest references)
- `npm run docs:validate` (reference page)

## Example (Based on an Existing Agent)

`agents/accessibility-reviewer.md` is the model: Role, Responsibilities, Activation Criteria, Process (7 steps), Output Format, and checklist sections.

## Common Mistakes

- No Role/Responsibilities section (validator warning/error).
- Forgetting to regenerate the manifest (doctor reports missing agent).
- Agent references an unregistered skill (routing breaks).

## Completion Checklist

- [ ] File created in `agents/`
- [ ] Manifest regenerated
- [ ] Reference page + matrices updated
- [ ] Command/`AGENTS.md` lists updated where relevant
- [ ] All three validators pass
