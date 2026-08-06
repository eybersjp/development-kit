# Manifests & Configuration

Reference for the 3 configuration files that define the framework's packaging and integration contracts.

## package.json

**Source**: `package.json`

| Field | Value | Notes |
| :--- | :--- | :--- |
| `name` | `development-kit` | npm package name |
| `version` | `0.3.0` | Current version (tag `v0.3.0`) |
| `description` | Opinionated AI methodology for Antigravity | — |
| `license` | MIT | — |
| `bin` | `development-kit` → `scripts/install-antigravity.mjs` | Enables `npx development-kit init` |
| `files` | `.agents/`, `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `scripts/`, `AGENTS.md`, `README.md`, `opencode.json` | Published npm contents |
| `engines.node` | `>=18.0.0` | CI runs Node 22 |

### Package Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `validate` | `node scripts/validate-skills.mjs` | Validate component structure & manifest references |
| `init` | `node scripts/install-antigravity.mjs` | Install the plugin |
| `doctor` | `node scripts/sync-plugin.mjs --check` | Check manifest sync |
| `docs:validate` | `node scripts/validate-docs.mjs` | Validate documentation |

## opencode.json

**Source**: `opencode.json`

```json
{ "rules": ["AGENTS.md"] }
```

Instructs OpenCode to load `AGENTS.md` as always-on rules. Installed to the project root by `--opencode` mode (guarded by the exists check).

## plugin.json (`.agents/plugins/development-kit/plugin.json`)

| Field | Value |
| :--- | :--- |
| `name` | `development-kit` |
| `version` | `0.1.0` |
| `skills` | 43 references |
| `agents` | 18 references |
| `hooks` | 4 references |

- **Canonical generation**: `node scripts/sync-plugin.mjs` regenerates it from the root directories.
- **Path forms**: generated references use `../../../<dir>/<name>` (relative to the plugin dir); the installer rewrites the prefix to `./` for installed copies.
- **Manifest version vs package version**: `plugin.json` reports `0.1.0` while `package.json` reports `0.3.0` — a known inconsistency, see [known-limitations.md](../../11-appendices/known-limitations.md).

## Validation Rules

- `npm run validate` verifies frontmatter and that every manifest reference resolves.
- `npm run doctor` compares the manifest against generated content (see the known-drift note in [sync-plugin.md](../scripts/sync-plugin.md)).
- `npm run docs:validate` verifies the docs cover every component in these configs.

See [configuration contracts](../../05-developer-guide/frontmatter-and-schema-contracts.md) for developer-facing schema rules.
