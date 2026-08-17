# Manifests and Configuration

Reference for the configuration files that define Development Kit packaging and host integration.

## package.json

**Source:** `package.json`

| Field | Current value | Notes |
|---|---|---|
| `name` | `development-kit` | Public npm package name |
| `version` | `0.8.1` | Current package version and `v0.8.1` release |
| `description` | Disciplined AI software-development workflow for Antigravity and OpenCode | Public package description |
| `license` | `MIT` | Root license file is included in the package |
| `bin` | `development-kit` to `scripts/install-antigravity.mjs` | Enables `npx development-kit init` |
| `files` | `.agents/`, `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `runtime/`, `scripts/`, `AGENTS.md`, `README.md`, `LICENSE`, `opencode.json` | Published npm contents |
| `engines.node` | `>=18.0.0` | CI and release workflows currently run Node.js 22 |

### Package scripts

| Script | Command | Purpose |
|---|---|---|
| `validate` | `node scripts/validate-skills.mjs && node --test scripts/antigravity-command-discovery.test.mjs` | Validate framework component structure, manifest references, and one-to-one Antigravity workflow discovery coverage |
| `init` | `node scripts/install-antigravity.mjs` | Install Development Kit |
| `doctor` | `node scripts/sync-plugin.mjs --check` | Check plugin manifest synchronization |
| `docs:validate` | `node runtime/validation/validate-docs-antigravity.mjs` | Validate documentation while treating `/dk-*` skill directories as transport adapters documented by the command references |
| `docs:validate:test` | `node --test scripts/validate-docs.test.mjs` | Run documentation validator regression tests |
| `opencode:validate` | `node --test scripts/validate-opencode-config.test.mjs` | Validate current OpenCode configuration compatibility |
| `platform:validate` | `node --test scripts/validate-platform-templates.test.mjs scripts/install-platform-adapters-cli.test.mjs` | Validate platform adapter templates and CLI flags |
| `research:validate` | `node --test scripts/research-contract.test.mjs` | Validate external research integration contract |
| `next-step:test` | `node --test scripts/next-step.test.mjs` | Run Next-Step guidance unit and CLI tests |
| `installer:validate:test` | `node --test scripts/install-antigravity.test.mjs` | Run installer and distribution packaging tests |
| `autopilot:test` | `node --test scripts/autopilot.test.mjs` | Run Autopilot runtime tests |
| `evals:validate` | `node scripts/validate-evals.mjs` | Validate lifecycle evaluation fixtures |
| `autopilot:validate` | `npm run autopilot:test && npm run evals:validate` | Run Autopilot tests and evaluations |
| `release:validate` | Complete chained validation suite | Required release gate |

## opencode.json

**Source:** `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

The file declares the official OpenCode project configuration schema. OpenCode automatically loads the root `AGENTS.md`, so Development Kit does not register it through a custom configuration key.

The obsolete form below is invalid and must not be generated:

```json
{
  "rules": ["AGENTS.md"]
}
```

`npm run opencode:validate` prevents regression to the obsolete key and verifies the supported `instructions` array shape when that optional field is present.

## plugin.json

**Source:** `.agents/plugins/development-kit/plugin.json`

| Field | Current value |
|---|---|
| `name` | `development-kit` |
| `version` | `0.1.0` |
| `skills` | 63 references: 47 engineering skills plus 16 native `/dk-*` workflow-entry adapters |
| `agents` | 18 references |
| `hooks` | 4 references |

The 16 `/dk-*` skill entries are Antigravity discovery adapters. They route to the matching canonical `commands/dk-*.md` workflow definitions rather than duplicating workflow semantics.

- `node scripts/sync-plugin.mjs` regenerates the manifest from canonical root directories.
- Canonical references use `../../../<directory>/<name>` relative to the plugin directory.
- The installer rewrites those prefixes for self-contained installed plugin copies.
- The plugin manifest version is currently independent from the npm package version. This is recorded in [Known Limitations](../../11-appendices/known-limitations.md).

## Validation rules

- `npm run validate` verifies frontmatter, manifest reference resolution, and Antigravity workflow discovery coverage.
- `npm run doctor` checks plugin synchronization.
- `npm run docs:validate` verifies component documentation and relative links while avoiding duplicate documentation for workflow adapters.
- `npm run opencode:validate` verifies OpenCode project configuration compatibility.
- `npm run release:validate` runs all release gates, including Autopilot and evaluation validation.

See [Frontmatter and Schema Contracts](../../05-developer-guide/frontmatter-and-schema-contracts.md), [OpenCode Integration](../../04-architecture/opencode-integration.md), and [Validation Reference](../../07-testing-quality-security/validation-reference.md).
