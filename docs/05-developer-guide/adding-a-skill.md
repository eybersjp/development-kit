# Adding a Skill

## Canonical Location

`skills/<skill-name>/SKILL.md`.

## Naming Rules

- Kebab-case, descriptive (`acceptance-criteria-writing`).
- The directory name must equal the frontmatter `name`.

## Required Frontmatter

```yaml
---
name: <skill-name>
description: >-
  <what the skill does and when it is used>
compatibility: opencode
---
```

`name` and `description` are validated; `compatibility: opencode` is required for OpenCode auto-discovery.

## Required Content Sections

- `## Overview` — what the skill does
- `## When to Use` — trigger conditions
- `## Process` — the procedure (numbered steps)
- Recommended: `## Rationalizations` (rebuttals to common objections), `## Red Flags`, `## Verification` (checklist)

## Registration & Discovery

1. Create the directory + `SKILL.md`.
2. Run `node scripts/sync-plugin.mjs` to add the skill to `plugin.json`.
3. If the skill is triggered by a command or request type, add/update the routing table in `skills/skill-routing/SKILL.md`.

## Required Docs

- `docs/03-reference/skills/<name>.md` — full reference page (purpose, lifecycle category, triggers, when-not, inputs, preconditions, procedure, outputs, invariants, dependencies, related agents/commands, verification, failure behaviour, compatibility, example, anti-patterns, maintenance notes).
- Update `skill-catalogue.md` and (if stage/trigger-related) `skill-routing-matrix.md` / `lifecycle-to-skill-map.md`.
- Update `docs/SUMMARY.md` and the category tables in `docs/03-reference/skills/README.md`.

## Required Evaluations (Recommended)

If the skill has behavioural expectations, add `evals/<skill-name>/scenario-01-<topic>.json` (see [adding-an-evaluation.md](adding-an-evaluation.md)).

## Required Validation

- `npm run validate`
- `npm run doctor`
- `npm run docs:validate`

## Example (Based on an Existing Skill)

`skills/skill-routing/SKILL.md` shows the full structure including a routing table; `skills/acceptance-criteria-writing/SKILL.md` shows the concise form.

## Common Mistakes

- Directory name ≠ frontmatter `name`.
- Missing `compatibility: opencode` (breaks OpenCode discovery).
- Not updating the routing table (skill is never activated).

## Completion Checklist

- [ ] `skills/<name>/SKILL.md` created
- [ ] Manifest regenerated
- [ ] Routing updated
- [ ] Reference page + catalogue updated
- [ ] Evaluation added (recommended)
- [ ] All three validators pass
