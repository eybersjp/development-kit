# install-antigravity

**Source**: `scripts/install-antigravity.mjs` · **Package entries**: `npx development-kit init`, `npm run init`, `bin.development-kit`

## Purpose

Installs or links the Development Kit plugin into Antigravity, copies everything to a project root for standalone use, installs skills/rules for OpenCode, or dispatches project-local platform adapters.

## Syntax

```bash
node scripts/install-antigravity.mjs [options]
npx development-kit init [options]
```

## Flags

| Flag | Behavior |
| :--- | :--- |
| *(none)* | Auto-detect Antigravity config (`~/.gemini/config`, `./.agents`, `./.gemini`) and install the plugin; exit 1 and print help if not found |
| `--global` | Install plugin to `~/.gemini/config/plugins/development-kit/` (creates the dir if missing) |
| `--project` | Install plugin to `./.agents/plugins/development-kit/` (creates `./.agents/` if missing) |
| `--all` | Standalone: copy `agents, skills, commands, hooks, templates, evals, scripts` dirs + `AGENTS.md` + `README.md` + plugin manifest to the project root |
| `--opencode` | Install compatible skills to `.opencode/skills/`, plus `opencode.json` and `AGENTS.md` at the project root |
| `--claude`, `--cursor`, `--vscode`, `--cline`, `--windsurf` | Install the selected platform adapter(s) at their native project paths |
| `--all-platforms` | Install all five platform adapters only; Antigravity and OpenCode remain explicit modes |
| `--force` | Override existsSync guards — overwrite existing `AGENTS.md` / `README.md` |
| `--dry-run` | Preview without copying; valid with `--all`, `--opencode`, or platform adapter flags |
| `--help` | Print help and exit 0 |

Platform adapter flags may be combined with one another, but they are mutually exclusive with the legacy target flags `--global`, `--project`, `--all`, and `--opencode`. A mixed platform-and-legacy invocation is rejected before any files are written.

## What Gets Copied

| Mode | Destinations | Files |
| :--- | :--- | :--- |
| `--global` / `--project` | `<target>/plugins/development-kit/` | `skills/`, `agents/`, `hooks/`, `commands/` copies; `plugin.json` with `../../../` paths rewritten to `./`; `AGENTS.md` (guarded) |
| `--all` | project root | all 7 directories; `AGENTS.md` and `README.md` (guarded); `.agents/plugins/development-kit/plugin.json` (copied unmodified) |
| `--opencode` | `.opencode/skills/` + root | 45 skill dirs (guarded); `opencode.json` (guarded); `AGENTS.md` (guarded) |
| platform adapters | project root | `CLAUDE.md` plus Claude command skills, or the selected native rule files; see [install-platform-adapters.md](install-platform-adapters.md) |

## Overwrite Rules

- Existing `AGENTS.md` / `README.md` at target are **skipped unless `--force`**.
- Existing platform adapter destinations are **preserved unless `--force`**; forced writes replace rather than merge.
- Library content (skills, agents, commands, hooks, templates, evals, scripts) is **copied unconditionally** (overwrites on re-run).
- `--dry-run` performs no writes.

## Guard Conditions

- `--dry-run` requires `--all`, `--opencode`, or at least one platform adapter.
- Auto-detect mode exits 1 when nothing is detected.

## Exit Codes

- 0 on success/help; 1 on invalid `--dry-run` usage or no target found.

## Error Handling

- `plugin.json` path-rewrite failure falls back to a direct copy (logged, non-fatal).
- File-system errors are not caught — they surface as thrown exceptions.

## Idempotency

Re-running is safe: guarded files are preserved; library content is refreshed.

## Platform Behavior

Paths use `path.join` (cross-platform). On Windows, `~` resolves via `USERPROFILE`; on macOS/Linux via `HOME`.

## Security & Path Safety

- Copies only repository content; no symlink/junction creation.
- Does not touch `package.json` in `--all` mode (explicitly skipped to preserve project config).
- `--force` is the only way to overwrite user files — used deliberately.

## Verification

- After install, verify per [verifying-installation.md](../../02-user-guide/verifying-installation.md) (e.g. `ls <target>/plugins/development-kit/`, check the manifest, run a command).

## Common Errors & Recovery

- **"Antigravity configuration not found"** → use an explicit flag or run in the intended directory.
- **`--dry-run` without `--all`/`--opencode`** → add the required flag.
- **Files skipped on reinstall** → intentional guard; use `--force` only if you intend to overwrite.

See [installer-architecture.md](../../04-architecture/installer-architecture.md) and [testing-installer-changes.md](../../05-developer-guide/testing-installer-changes.md).
