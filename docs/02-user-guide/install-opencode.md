# Install OpenCode

The `--opencode` installation flag configures Development Kit for the OpenCode AI coding environment.

## Prerequisites

- Node.js 18 or newer.
- OpenCode installed and able to open the target project.
- Development Kit v0.4.2 or newer.

## Commands

Install the current public package:

```bash
npx development-kit@latest init --opencode
```

Preview without writing files:

```bash
npx development-kit@latest init --opencode --dry-run
```

When working from a cloned Development Kit repository:

```bash
node scripts/install-antigravity.mjs --opencode
```

## Installed content and destinations

- `./.opencode/skills/`: all 43 compatible skills, copied to `.opencode/skills/<skill-name>/SKILL.md`.
- `./opencode.json`: the OpenCode project configuration.
- `./AGENTS.md`: the Development Kit rules loaded automatically by OpenCode.

The current generated `opencode.json` is:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads the root `AGENTS.md`. The file does not need to be listed in `opencode.json`.

## Existing file protection

The installer skips existing skills, `opencode.json`, and `AGENTS.md` unless `--force` is supplied. This protects project-specific customizations.

Use `--force` only after reviewing the files that will be replaced:

```bash
npx development-kit@latest init --opencode --dry-run --force
npx development-kit@latest init --opencode --force
```

## Upgrade from v0.4.1

Development Kit v0.4.1 generated an obsolete OpenCode configuration:

```json
{
  "rules": ["AGENTS.md"]
}
```

Current OpenCode versions reject that file with:

```text
Unrecognized key: rules
```

Repair an existing project by replacing its entire `opencode.json` with:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

Then restart or reload OpenCode.

## Skill compatibility metadata

All 43 skills contain OpenCode compatibility metadata in their `SKILL.md` frontmatter:

```yaml
compatibility:
  opencode: true
  antigravity: true
```

OpenCode discovers skills under `.opencode/skills/` and loads their full instructions only when needed.

## Verification

From a Development Kit source checkout, run:

```bash
npm run opencode:validate
npm run release:validate
```

For an installed project, verify that `opencode.json` parses as JSON, contains the official `$schema`, does not contain a `rules` key, and that OpenCode opens the project without a configuration warning.

See [OpenCode Integration](../04-architecture/opencode-integration.md), [Troubleshooting](troubleshooting.md), and the [Migration Guide](../08-maintenance-release/migration-guide.md).
