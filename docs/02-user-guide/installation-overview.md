# Installation Overview

Development Kit provides flexible installation modes via `scripts/install-antigravity.mjs` (invoked via `npx development-kit` or `npm run init`).

## Installation Modes Summary

| Mode Flag | Target Path | Installed Contents | Typical Use Case |
| :--- | :--- | :--- | :--- |
| `--global` | `~/.gemini/config/` | `plugins/development-kit/` + `AGENTS.md` | Make framework available to all projects in Antigravity |
| `--project` | `./.agents/` | `plugins/development-kit/` + `AGENTS.md` | Install framework into specific project directory |
| `--all` | `./` | Root directories (`skills/`, `agents/`, `commands/`, `hooks/`, etc.) | Standalone deployment or framework development |
| `--opencode` | `./` + `./.opencode/skills/` | `.opencode/skills/` + `opencode.json` + `AGENTS.md` | Install into OpenCode AI assistant workspace |

## Global Installer Flags

* `--force`: Override existsSync guards and overwrite existing `AGENTS.md` or `README.md` files.
* `--dry-run`: Show what files would be copied/installed without making actual file system changes (must be used with `--all` or `--opencode`).
* `--help`: Display CLI help text and available command listings.
