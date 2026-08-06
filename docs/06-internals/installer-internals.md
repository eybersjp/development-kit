# Installer Internals

## Entry & Flow

`scripts/install-antigravity.mjs` — a zero-dependency Node ESM script. `ROOT` is resolved from the script location (`fileURLToPath(import.meta.url)`), so it works from any working directory.

```mermaid
flowchart TD
    A["parse args"] --> B{"--help?"}
    B -->|yes| Z["print help, exit 0"]
    B -->|no| C{"--dry-run without --all/--opencode?"}
    C -->|yes| Y["usage error, exit 1"]
    C -->|no| D{"mode?"}
    D -->|--opencode| E["installOpencode(dryRun, force)"]
    D -->|--all| F["installAll(dryRun, force)"]
    D -->|--global| G["installPlugin(~/.gemini/config, force)"]
    D -->|--project| H["installPlugin(./.agents, force)"]
    D -->|none| I["detectAntigravity()"]
    I -->|found| J["installPlugin(path, force)"]
    I -->|not found| K["usage, exit 1"]
```

## Key Mechanics

| Mechanic | Implementation |
| :--- | :--- |
| Directory copies | `cpSync(src, dst, { recursive: true })` — plain copies, no symlinks |
| File copies | `copyFileSync` |
| Manifest path rewrite | `JSON.parse` → map arrays → `s.replace(/^\.\.\/\.\.\/\.\.\//, './')` → write |
| Rewrite fallback | On parse failure: direct copy + logged error (non-fatal) |
| Guards | `existsSync(target) && !force` → skip + message |
| Dry-run | `dryRun` flag gates every write + changes `✓` to `→` |

## Guard Matrix

| File/Dir | Without `--force` | With `--force` |
| :--- | :--- | :--- |
| Target `AGENTS.md` (plugin modes) | skipped | overwritten |
| Root `AGENTS.md` / `README.md` (`--all`, `--opencode`) | skipped | overwritten |
| Existing `.opencode/skills/<name>` | skipped | overwritten |
| `opencode.json` | skipped | overwritten |
| Library dirs (skills/agents/commands/hooks/templates/evals/scripts) | **unconditionally copied** | same |
| `package.json` (`--all`) | **never touched** | same |

## Path Resolution

- `~` → `process.env.HOME || process.env.USERPROFILE || '~'` (cross-platform)
- All paths via `join()` (Windows-safe)
- Auto-detect candidates: `~/.gemini/config`, `./.agents`, `./.gemini` (first existing)

## Exit Codes

- 0: success or `--help`
- 1: invalid `--dry-run` usage, or no target detected

## Failure & Rollback

- No transactional rollback exists — a mid-copy failure leaves partial files (acceptable for the small file set; re-running completes the install).
- Manifest rewrite failure degrades to an unmodified copy.

## Testing

See [testing-installer-changes.md](../05-developer-guide/testing-installer-changes.md) — always test in scratch directories with `--dry-run` first.
