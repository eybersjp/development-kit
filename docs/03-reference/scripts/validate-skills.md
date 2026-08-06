# validate-skills

**Source**: `scripts/validate-skills.mjs` · **Package entry**: `npm run validate`

## Purpose

Validates the structural integrity of the framework: every `SKILL.md` frontmatter, every agent file, every command file, and every plugin-manifest reference.

## Syntax

```bash
node scripts/validate-skills.mjs
npm run validate
```

## What It Checks

| Area | Checks |
| :--- | :--- |
| **Skills** | `SKILL.md` exists per skill dir; valid YAML frontmatter; `name` present; `description` present; recommended `Overview`/`Process` sections (warning if missing) |
| **Agents** | File exists; has a top-level heading and a Role/Responsibilities section (warning otherwise) |
| **Commands** | File exists; has YAML frontmatter with `name`; has `## Purpose` or `## Workflow` section |
| **Plugin manifest** | `plugin.json` exists at `.agents/plugins/development-kit/`; every `skills` and `agents` reference resolves to an existing file relative to the manifest |

## Output

Per-item `✓`/`⚠`/`✗` lines, then a summary: `N checks passed`, `M warnings`, `K errors`.

## Exit Codes

- 0 when there are no errors (warnings allowed)
- 1 when any error is present

## Error Handling

Errors are collected and printed; the process exits with the collected status.

## Idempotency

Read-only.

## Security & Path Safety

- Resolves manifest paths with `resolve()` within the repository only; no writes.

See [validator-internals.md](../../06-internals/validator-internals.md) and [validation-reference.md](../../07-testing-quality-security/validation-reference.md).
