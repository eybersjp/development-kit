# Install Antigravity Global

Installing Development Kit globally makes its commands, agents, and skills available across all projects opened in your Antigravity environment.

## Command

```bash
node scripts/install-antigravity.mjs --global
```
Or via npx:
```bash
npx development-kit --global
```

## Destination Paths

* **Windows**: `%USERPROFILE%\.gemini\config\plugins\development-kit\`
* **macOS / Linux**: `~/.gemini/config/plugins/development-kit/`

## Installed Files & Structure

```text
~/.gemini/config/
├── AGENTS.md
└── plugins/
    └── development-kit/
        ├── plugin.json
        ├── skills/
        ├── agents/
        ├── hooks/
        └── commands/
```

## Overwrite Rules

* Creates `plugins/development-kit/` and copies all skills, agents, hooks, and commands.
* Rewrites relative paths in `plugin.json` from `../../../` to `./`.
* If `AGENTS.md` already exists in `~/.gemini/config/`, it is **skipped** unless `--force` is specified.
