# Install Standalone

The `--all` installation flag copies all framework directories (`agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `scripts/`) and root configuration files directly into the target project root.

## Command

```bash
node scripts/install-antigravity.mjs --all
```
With dry-run:
```bash
node scripts/install-antigravity.mjs --all --dry-run
```

## Installed Content

* Root directories: `agents/`, `skills/`, `commands/`, `hooks/`, `templates/`, `evals/`, `scripts/`
* Root files: `AGENTS.md`, `README.md`, `.agents/plugins/development-kit/plugin.json`

> [!NOTE]
> `package.json` in the target directory is explicitly **skipped** by `--all` to prevent overwriting existing project configuration.
