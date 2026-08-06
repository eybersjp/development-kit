# Modifying Existing Components

## General Rules

1. **Edit canonical only** — never the mirror under `.agents/plugins/development-kit/`.
2. **Keep contracts intact** — frontmatter fields, required sections, and exported hook APIs are validated.
3. **Update the docs in the same change** — the documentation-maintenance-policy requires it.
4. **Run validation** before finishing.

## By Component Type

### Modifying a Skill (`skills/<name>/SKILL.md`)

- Keep `name` and `description` consistent (name is used for routing; description for discovery).
- Update `compatibility: opencode` if behaviour differs by environment (it should not).
- Keep the `Overview`/`When to Use`/`Process` structure; update the routing table if triggers change.
- Check the corresponding `evals/<name>/` scenario still matches expected behaviour.

### Modifying an Agent (`agents/<name>.md`)

- Keep the role/responsibilities contract — the conductor relies on the documented handoff.
- Update the agent's reference page (`docs/03-reference/agents/<name>.md`) and, if handoffs change, [agent-handoff-map.md](../03-reference/agents/agent-handoff-map.md).

### Modifying a Command (`commands/dk-<name>.md`)

- Frontmatter `name` must match the filename.
- Update the skills-activated list and sub-agents; keep stopping conditions accurate.
- Update `skill-routing`'s routing table if the skill bundle changes.
- Update the command's reference page.

### Modifying a Hook (`hooks/<name>.js`)

- Preserve exported function signatures (other hooks/tools call them by name).
- Keep hooks side-effect-free at load time.
- Update the hook reference page and related internals docs.

### Modifying a Template / Evaluation / Script

- Templates: keep frontmatter `name`/`description`.
- Evaluations: keep the JSON contract (`skill`, `scenario`, `input`/`implementation`, `expected`).
- Scripts: keep CLI flags and exit-code contracts documented.

## After Modifying

```bash
npm run validate
npm run doctor
npm run docs:validate
node scripts/sync-plugin.mjs   # only if manifest-relevant content changed
```

See [running-validation.md](running-validation.md).
