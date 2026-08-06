# Adding a Command

## Canonical Location

`commands/dk-<verb>.md` — create the file here; never in the mirror.

## Naming Rules

- `dk-<kebab-case-verb>` matching the frontmatter `name`.
- Add the command to `AGENTS.md` and to the `/dk-*` list in the root `README.md`.

## Required Metadata & Sections

```markdown
---
name: dk-mycommand
description: >-
  One sentence: what the command does and when to use it.
---

# /dk-mycommand

## Purpose
[What it accomplishes and which lifecycle stage it serves.]

## Workflow
[Step-by-step what the conductor does when this command runs.]

## Skills Activated
Primary: [...]
Supporting: [...]

## Sub-Agents
[Agents the conductor spawns.]

## Stopping Conditions
[When the command halts or routes back.]
```

## Registration & Discovery

1. Add the routing entry to `skills/skill-routing/SKILL.md` (the routing table).
2. Update `docs/03-reference/commands/` — add `<name>.md` and update `README.md`, `command-selection-matrix.md`, `workflow-sequences.md`.
3. Update `docs/SUMMARY.md`.
4. Commands are discovered by the runtime from the `commands/` directory (and the installed plugin copy); no manifest entry is required for commands (unlike skills/agents/hooks).

## Required Validation & Docs

- `npm run validate` — frontmatter + `## Purpose`/`## Workflow` present.
- `npm run docs:validate` — reference page exists.
- Reference page must cover: purpose, lifecycle stage, syntax, inputs, decisions, agents/skills invoked, artefacts, verification, pause conditions, failure behaviour, completion criteria, relationships, example.

## Example (Based on an Existing Command)

`commands/dk-build.md` is the reference model: frontmatter, `## Purpose`, `## Workflow` (11 steps), `## Skills Activated` (primary/supporting/review), `## Sub-Agents`, `## Stopping Conditions`.

## Common Mistakes

- Forgetting the frontmatter `name` (validator error).
- Not updating the `skill-routing` table (routing breaks).
- Adding a command without a reference page (docs validator error).

## Completion Checklist

- [ ] File created in `commands/`
- [ ] Routing table updated
- [ ] Reference page + index pages updated
- [ ] `npm run validate` passes
- [ ] `npm run docs:validate` passes
