# Installation Overview

Development Kit provides flexible installation modes via `scripts/install-antigravity.mjs` (invoked via `npx development-kit` or `npm run init`).

## Installation Modes Summary

| Mode Flag | Target Path | Installed Contents | Typical Use Case |
| :--- | :--- | :--- | :--- |
| `--global` | `~/.gemini/config/` | `plugins/development-kit/` + `AGENTS.md` | Make framework available to all projects in Antigravity |
| `--project` | `./.agents/` | `plugins/development-kit/` + `AGENTS.md` | Install framework into specific project directory |
| `--all` | `./` | Root directories (`skills/`, `agents/`, `commands/`, `hooks/`, etc.) | Standalone deployment or framework development |
| `--opencode` | `./` + `./.opencode/skills/` | `.opencode/skills/` + `opencode.json` + `AGENTS.md` | Install into OpenCode AI assistant workspace |
| `--claude` | `./` | `CLAUDE.md` + `.claude/skills/<dk-command>/SKILL.md` | Install native Claude Code project instructions and skills |
| `--cursor` / `--vscode` / `--cline` / `--windsurf` | `./` | The selected platform's native project rule file | Install a rule-based platform adapter |
| `--all-platforms` | `./` | All five platform adapters | Install the five new adapters only; Antigravity and OpenCode remain separate modes |

## Global Installer Flags

* `--force`: Override destination guards and replace existing installer-managed files.
* `--dry-run`: Show planned or preserved files without writing (use with `--all`, `--opencode`, or platform adapter flags).
* `--help`: Display CLI help text and available command listings.
