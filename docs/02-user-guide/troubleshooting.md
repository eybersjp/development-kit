# Troubleshooting

## Installation

| Symptom | Cause | Fix |
|---|---|---|
| `Antigravity configuration not found` | No Antigravity configuration was detected in automatic mode | Use an explicit flag: `--global`, `--project`, `--all`, or `--opencode` |
| `--dry-run must be used with --all or --opencode` | `--dry-run` was supplied without a copy mode | Run `npx development-kit init --all --dry-run` or `npx development-kit init --opencode --dry-run` |
| Files report `already exists (skipped)` | Installer safety guards preserved existing project files | Expected. Use `--force` only after reviewing what will be overwritten |
| Plugin commands are unavailable | The wrong install mode was used or the plugin was not discovered | Verify the target plugin directory and manifest, then reinstall with the correct mode |
| `npx development-kit init` fails | npm resolution or connectivity problem | Confirm Node.js and npm connectivity, then retry with `npx development-kit@latest init ...` |

## OpenCode

| Symptom | Cause | Fix |
|---|---|---|
| `Unrecognized key: rules` | A v0.4.1 installation left an obsolete `opencode.json` | Replace the file with the v0.4.2 schema configuration shown below, then reload OpenCode |
| OpenCode cannot parse `opencode.json` | Invalid JSON syntax | Restore the exact valid JSON below |
| `AGENTS.md` appears not to load | The file is missing, renamed, or not at the project root | Place `AGENTS.md` in the root directory and reload the project |
| Skills are not discovered | `.opencode/skills/` is missing or the installation was skipped | Rerun `npx development-kit@latest init --opencode` and inspect the destination |
| Reinstall does not replace old configuration | Existing-file protection skipped `opencode.json` | Repair the file manually or rerun with `--force` after reviewing the replacement |

Current valid configuration:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads the root `AGENTS.md`. Do not restore the obsolete `rules` key.

## Validation

| Symptom | Cause | Fix |
|---|---|---|
| `npm run doctor` reports missing components | Plugin manifest drift | Run `node scripts/sync-plugin.mjs`, inspect the diff, and rerun `npm run doctor` |
| `npm run validate` fails | Broken frontmatter, structure, compatibility metadata, or manifest reference | Fix the named component |
| `npm run docs:validate` fails | Missing reference page, missing `SUMMARY.md` entry, broken link, placeholder, or local URL | Follow the exact validator message |
| `npm run opencode:validate` fails | Invalid schema declaration, obsolete `rules` key, or invalid optional `instructions` field | Repair `opencode.json` |
| `npm run autopilot:test` fails | Runtime, state, lease, policy, or security behaviour regressed | Fix the failing scenario before release |
| `npm run release:validate` fails | At least one required release gate failed | Run the failing subcommand directly, repair it, and rerun the complete suite |

## Workflow

| Symptom | Cause | Fix |
|---|---|---|
| `/dk-build` refuses to start | No approved specification, design, or task plan exists | Complete the required planning stages first |
| Review gate keeps failing | The implementation remains out of compliance or below the quality threshold | Repair the reported findings and rerun the gate |
| Implementer reports a blocker | The task is underspecified, incompatible, or impossible as written | Revise the specification and task plan before resuming |
| Tests fail after simplification | Required behaviour was removed | Restore the required behaviour and rerun verification |

## Environment

| Symptom | Cause | Fix |
|---|---|---|
| Node.js version is too old | Development Kit requires Node.js 18 or newer | Upgrade Node.js; CI currently uses Node.js 22 |
| Windows examples fail because of quoting | Bash and PowerShell quoting differ | Use platform-appropriate quoting and file-based JSON inputs where supported |

## Still stuck?

1. Confirm the installed package version with `npm view development-kit version`.
2. Run `npm run release:validate` from a source checkout.
3. Run `/dk-status` for workflow-state problems.
4. Review [Installing OpenCode](install-opencode.md) and [Verifying Installation](verifying-installation.md).
5. File a sanitized issue using the repository issue template when the problem remains reproducible.
