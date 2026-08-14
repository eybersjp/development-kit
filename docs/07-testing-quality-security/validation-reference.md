# Validation Reference

## Validator commands

| Command | Implementation | Checks | Failure behaviour |
|---|---|---|---|
| `npm run validate` | `scripts/validate-skills.mjs` | Skills, agents, commands, compatibility metadata, and manifest references | Exits 1 on errors |
| `npm run doctor` | `scripts/sync-plugin.mjs --check` | Plugin manifest plus canonical/mirror inventory and line-ending-normalized content synchronization for skills, agents, commands, and hooks | Exits 1 on any material drift |
| `npm run docs:validate` | `scripts/validate-docs.mjs` | Reference coverage, links, placeholders, local paths, and `SUMMARY.md` registration | Exits 1 on errors |
| `npm run docs:validate:test` | `scripts/validate-docs.test.mjs` | Documentation validator regression suite | Exits 1 on failure |
| `npm run opencode:validate` | `scripts/validate-opencode-config.test.mjs` | OpenCode JSON schema declaration, obsolete-key rejection, and optional instructions shape | Exits 1 on failure |
| `npm run platform:validate` | Two platform adapter test files | Adapter selection, CLI behavior, official paths, preservation/force, dry-run safety, and packaged templates | Exits 1 on failure |
| `npm run research:validate` | `scripts/research-contract.test.mjs` | External research command/skill integration, trust boundaries, plugin registration, documentation navigation, and package wiring | Exits 1 on failure |
| `npm run next-step:test` | `scripts/next-step.test.mjs` | Next-Step guidance unit, policy, safety gate, schema, and CLI validation suite | Exits 1 on failure |
| `npm run installer:validate:test` | `scripts/install-antigravity.test.mjs` | Standalone installer completeness, runtime packaging, and distribution isolation | Exits 1 on failure |
| `npm run autopilot:test` | `scripts/autopilot.test.mjs` | Autopilot runtime, persistence, policy, security, and lifecycle behaviour | Exits 1 on failure |
| `npm run evals:validate` | `scripts/validate-evals.mjs` | Evaluation suite structure and scenario validity | Exits 1 on errors |
| `npm run autopilot:validate` | Chained npm script | Autopilot tests and evaluation validation | Exits 1 when either gate fails |
| `npm run release:validate` | Chained npm script | Complete release gate suite | Exits 1 when any required gate fails |

## Current v0.6.1 release gate

Run the authoritative pre-release suite with:

```bash
npm run release:validate
```

The chain executes:

```text
validate
-> skills:validate:test
-> doctor
-> sync:validate:test
-> docs:validate
-> docs:validate:test
-> opencode:validate
-> platform:validate
-> research:validate
-> next-step:test
-> installer:validate:test
-> autopilot:test
-> evals:validate
```

The authoritative requirement is that every current gate completes successfully with zero errors or failed tests.

## Current component coverage

| Component | Current count | Reference location | Primary validation |
|---|---:|---|---|
| Commands | 14 | `docs/03-reference/commands/` | `validate`, `doctor`, and `docs:validate` |
| Agents | 18 | `docs/03-reference/agents/` | `validate`, `doctor`, and `docs:validate` |
| Skills | 46 | `docs/03-reference/skills/` | `validate`, `doctor`, `docs:validate`, `research:validate`, and `next-step:test` |
| Hooks | 4 | `docs/03-reference/hooks/` | `doctor` and `docs:validate` |
| Templates | 6 | `docs/03-reference/templates/` | `docs:validate` |
| Evaluation suites | 11 | `docs/03-reference/evaluations/` | `docs:validate` and `evals:validate` |
| Framework scripts | 7 non-test scripts plus test suites | `docs/03-reference/scripts/` | `docs:validate` and targeted test scripts |
| OpenCode configuration | 1 project configuration | `docs/03-reference/configuration/` | `opencode:validate` |
| Platform adapters | 5 project integrations | `docs/03-reference/scripts/install-platform-adapters.md` | `platform:validate` |

## Plugin mirror gate

`npm run doctor` is a release-blocking, read-only synchronization check. It verifies:

- the generated `plugin.json` exactly matches the committed manifest
- each canonical `skills/`, `agents/`, `commands/`, and `hooks/` file exists in the mirror
- no extra mirror file exists
- matching canonical and mirror files are content-equivalent after normalizing CRLF and LF line endings; material differences still fail

Repair drift with `node scripts/sync-plugin.mjs` or `node scripts/sync-plugin.mjs --fix`, review the derived mirror diff, then rerun `npm run doctor`.

## External research contract

The v0.5 research contract verifies that:

- `/dk-research` is present and exposes the external-content trust boundary.
- `external-research` remains provider-neutral and includes provenance/uncertainty handling.
- `agent-reach-integration` remains optional, approval-gated, and explicit about installation/session risks.
- `AGENTS.md`, the development conductor, and `/dk-autopilot` expose consistent research trust and approval behavior.
- The Antigravity plugin manifest registers the two research skills.
- Documentation navigation includes the command, skills, and External Capability Provider architecture page.
- `package.json` remains on the v0.5 release line and includes the research gate inside `release:validate`.

The test does not contact or install an external provider.

## OpenCode regression gate

The OpenCode regression suite verifies that `opencode.json`:

- Is valid JSON.
- Is an object.
- Declares `https://opencode.ai/config.json` through `$schema`.
- Does not contain the obsolete `rules` key.
- Uses an array of strings when optional `instructions` are present.

## CI and release wiring

- `.github/workflows/ci.yml` runs framework, plugin mirror, documentation, OpenCode, research contract, Autopilot, and evaluation gates for pull requests and pushes to `main`.
- `.github/workflows/release-command.yml` runs `npm run release:validate` before creating or verifying a release tag, creating the GitHub Release, and attempting npm publication.
- `.github/workflows/publish.yml` validates tag-driven releases when triggered directly by a `v*` tag push.

## Interpreting failures

- `validate` failure: repair the named framework component or manifest reference.
- `doctor` drift: synchronize canonical content into the committed plugin mirror and regenerate the manifest with `node scripts/sync-plugin.mjs`.
- `docs:validate` failure: create the missing reference page, register it in `docs/SUMMARY.md`, or repair the named link or placeholder.
- `opencode:validate` failure: repair `opencode.json`; never restore the obsolete `rules` key.
- `platform:validate` failure: repair the official adapter paths, template contents, CLI selection, or safe write behavior.
- `research:validate` failure: restore provider-neutral routing, trust boundaries, approval behavior, plugin registration, or documentation navigation.
- `autopilot:test` failure: repair runtime behaviour before advancing the release.
- `evals:validate` failure: repair the named scenario or evaluation structure.

See [Running Validation](../05-developer-guide/running-validation.md), [External Capability Providers](../04-architecture/external-capability-providers.md), [OpenCode Integration](../04-architecture/opencode-integration.md), and [Release Quality Gates](release-quality-gates.md).
