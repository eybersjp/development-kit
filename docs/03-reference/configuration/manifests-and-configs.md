# Manifests and Configuration

Reference for the configuration files that define Development Kit packaging and host integration.

## package.json

**Source:** `package.json`

| Field | Current value | Notes |
|---|---|---|
| `name` | `development-kit` | Public npm package name |
| `version` | `0.9.0` | Current package version and `v0.9.0` release |
| `description` | Disciplined AI software-development workflow for Antigravity and OpenCode | Public package description |
| `license` | `MIT` | Root license file is included in the package |
| `bin` | `development-kit` to `scripts/install-antigravity.mjs` | Enables `npx development-kit init` |
| `files` | `.agents/`, `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `runtime/`, `schemas/`, `scripts/`, `AGENTS.md`, `README.md`, `LICENSE`, `opencode.json` | Published npm contents |
| `engines.node` | `>=18.0.0` | CI and release workflows currently run Node.js 22 |

### Package scripts

| Script | Purpose |
|---|---|
| `validate` | Validate framework components, release workflow contract, and Antigravity workflow discovery coverage |
| `doctor` | Check canonical plugin synchronization and package/manifest version alignment |
| `docs:validate` / `docs:validate:test` | Validate documentation coverage, links, and active release consistency |
| `installer:validate:test` | Validate standalone/project installation, distribution packaging, runtime/schema presence, and stale-owned-file cleanup |
| `orchestration:validate` | Validate Development Contracts and authoritative-source fingerprints |
| `execution-safety:validate` | Validate destructive/remote command classification, scope, approvals, and blast-radius protections |
| `evidence:validate` | Validate criterion evidence, control coverage, immutable evidence records, and no-self-certification |
| `orchestration-core:validate` | Validate context rehydration, deterministic acceptance, bounded correction, review results, architecture drift, Design Authority binding, host strategy, and persisted runs |
| `orchestration-integration:validate` | Validate canonical artifact amendment/reconciliation, Autopilot result gating, and orchestration CLI safety behavior |
| `v09-reliability:validate` | Run Proposal Builder adversarial regressions, fail-closed derived-gate tests, amendment fingerprint tests, and package/plugin/Autopilot version consistency |
| `intelligence:validate` | Validate DK Intelligence and memory behavior |
| `design-authority:validate` | Validate DKF Design Authority |
| `autopilot:validate` | Run Autopilot tests and lifecycle evaluations |
| `release:validate` | Run the complete chained release gate; required before tagging or publication |

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
| `version` | `0.9.0` |
| `skills` | 63 references: 47 engineering skills plus 16 native `/dk-*` workflow-entry adapters |
| `agents` | 18 references |
| `hooks` | 4 references |

The 16 `/dk-*` skill entries are Antigravity discovery adapters. They route to the matching canonical `commands/dk-*.md` workflow definitions rather than duplicating workflow semantics.

- `node scripts/sync-plugin.mjs` derives plugin metadata from `package.json` and regenerates canonical references from the root directories.
- Canonical references use `../../../<directory>/<name>` relative to the plugin directory.
- The installer rewrites those prefixes for self-contained installed plugin copies.
- `npm run doctor`, sync regression tests, installer tests, and `v09-version-consistency.test.mjs` fail when package and plugin version state diverge.

## Autopilot version state

New Autopilot workflow state records the framework release version in `frameworkVersion`. For v0.9.0 this value is `0.9.0`. The v0.9 version-consistency regression checks that this value remains aligned with both `package.json` and the plugin manifest.

## Validation rules

- `npm run validate` verifies frontmatter, manifest reference resolution, release workflow contract, and Antigravity workflow discovery coverage.
- `npm run doctor` checks plugin synchronization and release metadata alignment.
- `npm run docs:validate` verifies component documentation, relative links, and active version consistency while avoiding duplicate documentation for workflow adapters.
- `npm run v09-reliability:validate` verifies the reliability control plane against known field failures and fail-closed invariants.
- `npm run release:validate` runs every release gate before a release issue may create/tag/publish a version.

See [Frontmatter and Schema Contracts](../../05-developer-guide/frontmatter-and-schema-contracts.md), [Orchestration Runtime CLI](../scripts/orchestration.md), [Validation Reference](../../07-testing-quality-security/validation-reference.md), and [Reliability Control-Plane Amendment](../../04-architecture/dk-reliability-control-plane-amendment.md).
