# Validation Reference

## Validator commands

| Command | Implementation | Checks | Failure behaviour |
|---|---|---|---|
| `npm run validate` | `scripts/validate-skills.mjs` | Skills, agents, commands, compatibility metadata, and manifest references | Exits 1 on errors |
| `npm run doctor` | `scripts/sync-plugin.mjs --check` | Plugin manifest synchronization and component counts | Reports synchronization state |
| `npm run docs:validate` | `scripts/validate-docs.mjs` | Reference coverage, links, placeholders, local paths, and `SUMMARY.md` registration | Exits 1 on errors |
| `npm run docs:validate:test` | `scripts/validate-docs.test.mjs` | Documentation validator regression suite | Exits 1 on failure |
| `npm run opencode:validate` | `scripts/validate-opencode-config.test.mjs` | OpenCode JSON schema declaration, obsolete-key rejection, and optional instructions shape | Exits 1 on failure |
| `npm run autopilot:test` | `scripts/autopilot.test.mjs` | Autopilot runtime, persistence, policy, security, and lifecycle behaviour | Exits 1 on failure |
| `npm run evals:validate` | `scripts/validate-evals.mjs` | Evaluation suite structure and scenario validity | Exits 1 on errors |
| `npm run autopilot:validate` | Chained npm script | Autopilot tests and evaluation validation | Exits 1 when either gate fails |
| `npm run release:validate` | Chained npm script | Complete release gate suite | Exits 1 when any required gate fails |

## Current v0.4.2 release gate

Run the authoritative pre-release suite with:

```bash
npm run release:validate
```

The chain executes:

```text
validate
→ doctor
→ docs:validate
→ docs:validate:test
→ opencode:validate
→ autopilot:test
→ evals:validate
```

Do not rely on old v0.3.0 pass counts as a current acceptance criterion. Source-derived counts can increase when validated components or documentation pages are added. The authoritative requirement is that every current gate completes successfully with zero errors or failed tests.

## Current component coverage

| Component | Current count | Reference location | Primary validation |
|---|---:|---|---|
| Commands | 13 | `docs/03-reference/commands/` | `validate` and `docs:validate` |
| Agents | 18 | `docs/03-reference/agents/` | `validate` and `docs:validate` |
| Skills | 43 | `docs/03-reference/skills/` | `validate` and `docs:validate` |
| Hooks | 4 | `docs/03-reference/hooks/` | `docs:validate` |
| Templates | 6 | `docs/03-reference/templates/` | `docs:validate` |
| Evaluation suites | 11 | `docs/03-reference/evaluations/` | `docs:validate` and `evals:validate` |
| Framework scripts | 6 non-test scripts | `docs/03-reference/scripts/` | `docs:validate` |
| OpenCode configuration | 1 project configuration | `docs/03-reference/configuration/` | `opencode:validate` |

## OpenCode regression gate

The v0.4.2 regression suite verifies that `opencode.json`:

- Is valid JSON.
- Is an object.
- Declares `https://opencode.ai/config.json` through `$schema`.
- Does not contain the obsolete `rules` key.
- Uses an array of strings when optional `instructions` are present.

## CI and release wiring

- `.github/workflows/ci.yml` runs framework, plugin, documentation, OpenCode, Autopilot, and evaluation gates for pull requests and pushes to `main`.
- `.github/workflows/release-command.yml` runs `npm run release:validate` before creating or verifying a release tag, creating the GitHub Release, and attempting npm publication.
- `.github/workflows/publish.yml` validates tag-driven releases when triggered directly by a `v*` tag push.

## Interpreting failures

- `validate` failure: repair the named framework component or manifest reference.
- `doctor` drift: inspect and regenerate the plugin manifest with `node scripts/sync-plugin.mjs`.
- `docs:validate` failure: create the missing reference page, register it in `docs/SUMMARY.md`, or repair the named link or placeholder.
- `opencode:validate` failure: repair `opencode.json`; never restore the obsolete `rules` key.
- `autopilot:test` failure: repair runtime behaviour before advancing the release.
- `evals:validate` failure: repair the named scenario or evaluation structure.

See [Running Validation](../05-developer-guide/running-validation.md), [OpenCode Integration](../04-architecture/opencode-integration.md), and [Release Quality Gates](release-quality-gates.md).
