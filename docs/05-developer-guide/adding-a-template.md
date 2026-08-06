# Adding a Template

## Canonical Location

`templates/<noun>.md`.

## Naming Rules

- Kebab-case noun matching the artifact (`task-plan.md`, `feature-spec.md`).
- The frontmatter `name` should be the full artifact name (`feature-spec.md` declares `name: feature-specification`).

## Required Structure

```markdown
---
name: <artifact-name>
description: Template for <purpose>.
---

# <Artifact Title>: [Placeholder]

## <Section 1>
[Guidance in brackets]

## <Section 2>
...
```

Bracket placeholders (`[What problem are we solving?]`) are the convention for template instructions — these are fine in templates, but completed documents must not retain them.

## Registration & Discovery

- Templates are used by agents (per the artifact level); there is no manifest entry for templates. Register usage in the relevant agent/skill docs.

## Required Docs

- `docs/03-reference/templates/<name>.md` — lifecycle stage, intended user/agent, required/optional sections, selection, completion guidance, validation expectations, related components.
- Update `docs/03-reference/templates/README.md` and `docs/SUMMARY.md`.

## Required Validation

- `npm run docs:validate` (template reference page required)
- `npm run validate` (templates are not structurally validated — only the reference coverage is enforced)

## Example (Based on an Existing Template)

`templates/technical-design.md` demonstrates the table-driven sections (Reused Components, New Components, Dependencies, Alternatives Considered) that the design reviewers expect.

## Common Mistakes

- Forgetting frontmatter (breaks the naming contract).
- Adding uncompleted placeholder markers that trip the docs validator (use bracketed guidance instead).

## Completion Checklist

- [ ] `templates/<name>.md` created
- [ ] Reference page + README updated
- [ ] `npm run docs:validate` passes
