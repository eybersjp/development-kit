# Validator Internals

## validate-skills.mjs

**Structure validator** — checks the shape of content, not behaviour.

| Check | Mechanism |
| :--- | :--- |
| Skill frontmatter | Regex-parsed `---\n...\n---` block; `name`/`description` required |
| Skill sections | `Overview`/`Process` presence (warning, not error) |
| Agent structure | Top-level `#` heading + `Role`/`Responsibilities` (warning) |
| Command structure | Frontmatter with `name`; `## Purpose`/`## Workflow` |
| Manifest references | `resolve(dirname(pluginJson), ref)` → `existsSync` |

Exit 1 on any error; warnings don't fail.

## sync-plugin.mjs --check

**Manifest drift reporter** — compare committed vs generated manifest. Reports missing entries; never fails. See [plugin-sync-internals.md](plugin-sync-internals.md).

## validate-docs.mjs

**Documentation validator** — coverage + integrity:

| Check | Mechanism |
| :--- | :--- |
| Reference coverage | For each component in `commands/agents/skills/hooks/templates/evals/scripts` → page exists under `docs/03-reference/<type>/` |
| Broken links | Markdown link resolution → `resolve(dirname(file), target)` → `existsSync`; skips `http(s)`, `#`, `mailto:` |
| Placeholders | Uncompleted placeholder pattern check |
| Local URLs | Local `file://` protocol URL check |
| SUMMARY navigation | Page not mentioned in `docs/SUMMARY.md` → warning |

Exit 1 on any error.

## Why Dependency-Free

All three validators use only `node:fs`, `node:path`, and `node:url` — consistent with [dependency-policy.md](../05-developer-guide/dependency-policy.md). CI installs nothing beyond the repo itself.

## Known Gaps

- `validate-docs.mjs` currently checks script coverage via `.mjs` extension only.
- Mermaid blocks are not syntax-validated (see [known-limitations.md](../11-appendices/known-limitations.md)).
- `docs:validate` is not wired into CI.

See [validation-reference.md](../07-testing-quality-security/validation-reference.md).
