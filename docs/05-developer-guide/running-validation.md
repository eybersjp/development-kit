# Running Validation

## Validation commands

| Command | What it validates | Required for release |
|---|---|---|
| `npm run validate` | Skills, agents, commands, compatibility metadata, and manifest references | Yes |
| `npm run doctor` | Plugin manifest synchronization | Yes |
| `npm run docs:validate` | Documentation coverage, relative links, placeholders, local URLs, and navigation | Yes |
| `npm run docs:validate:test` | Documentation validator regression behaviour | Yes |
| `npm run opencode:validate` | Current OpenCode project configuration compatibility | Yes |
| `npm run platform:validate` | Platform adapter CLI behavior, official paths, templates, preservation, force, and dry-run safety | Yes |
| `npm run autopilot:test` | Autopilot runtime behaviour | Yes |
| `npm run evals:validate` | Evaluation suite structure and scenarios | Yes |
| `npm run autopilot:validate` | Autopilot tests plus evaluation validation | Yes |
| `npm run release:validate` | The complete release gate suite | Yes |

## Standard developer workflow

For a focused OpenCode configuration change:

```bash
npm run opencode:validate
npm run docs:validate
```

For a complete repository verification:

```bash
npm run release:validate
git diff --check
```

`release:validate` is the authoritative command before merging release-sensitive changes or creating a version tag.

## Reading output

- `✓` means the check passed.
- `⚠` means a warning that should be reviewed.
- `✗` means the gate failed and must be repaired.

## When to run each gate

| Change | Minimum focused gates | Final gate |
|---|---|---|
| Skill, agent, or command content | `validate`, relevant tests, `docs:validate` when docs change | `release:validate` |
| Skill, agent, hook, or command added or removed | `validate`, `doctor`, `docs:validate` | `release:validate` |
| Documentation only | `docs:validate`, `docs:validate:test` when validator behaviour changes | `release:validate` |
| OpenCode configuration or installer integration | `opencode:validate`, installer verification, `docs:validate` | `release:validate` |
| Platform adapter or template integration | `platform:validate`, `docs:validate` | `release:validate` |
| Autopilot runtime | `autopilot:test`, `evals:validate` | `release:validate` |
| Release workflow or package metadata | Targeted workflow review plus all gates | `release:validate` |

## CI equivalents

The CI workflow runs the same framework, plugin, documentation, OpenCode, Autopilot, and evaluation gates for pull requests and pushes to `main`.

The maintainer release workflow runs `npm run release:validate` before it creates or verifies a release tag and publishes release artifacts.

## OpenCode configuration failure

The v0.4.2 gate rejects the obsolete configuration:

```json
{
  "rules": ["AGENTS.md"]
}
```

Use:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads the root `AGENTS.md`.

## Troubleshooting

- `validate` errors: repair the named frontmatter, structure, or manifest reference.
- `doctor` reports drift: run `node scripts/sync-plugin.mjs`, review the diff, and rerun `doctor`.
- `docs:validate` errors: create the missing reference page, register it in `docs/SUMMARY.md`, or fix the named link.
- `opencode:validate` errors: repair `opencode.json` and remove any obsolete `rules` key.
- `platform:validate` errors: repair the adapter selection, official destination mapping, guarded write behavior, or packaged templates.
- Autopilot failures: isolate the failing state, security, policy, or lifecycle scenario before proceeding.

See [Validation Reference](../07-testing-quality-security/validation-reference.md) and [Testing Installer Changes](testing-installer-changes.md).
