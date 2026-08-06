# Compatibility Guidelines

## Supported Environments

| Environment | Support | Mechanism |
| :--- | :--- | :--- |
| Antigravity (global) | ✅ | Plugin installed to `~/.gemini/config/plugins/development-kit/` |
| Antigravity (project) | ✅ | Plugin installed to `./.agents/plugins/development-kit/` |
| Standalone (no Antigravity) | ✅ | `--all` copies components to the project root |
| OpenCode | ✅ | `--opencode` installs skills + rules to `.opencode/` |
| Node.js | `>=18.0.0` | `package.json` engines; CI runs 22 |

## Rules for Content

1. **Skills must declare `compatibility: opencode`** — required for OpenCode auto-discovery. All 43 currently do.
2. **Skills must be environment-agnostic in behaviour** — the same skill content works in Antigravity and OpenCode; do not add environment-specific instructions to a `SKILL.md`.
3. **Cross-platform scripts** — use `node:path` (`join`, `resolve`, `relative`) and forward slashes; never hard-code OS separators. The installer already does this.
4. **Windows-aware examples in docs** — use PowerShell examples for Windows-specific behaviour and POSIX examples for cross-platform commands.

## Platform Path Differences

| Concern | Windows | macOS / Linux |
| :--- | :--- | :--- |
| Home dir | `USERPROFILE` | `HOME` |
| Installer global target | `%USERPROFILE%\.gemini\config` | `~/.gemini/config` |
| Path separators | `\` (handled by `path.join`) | `/` |
| Shell in examples | PowerShell | bash |

See [platform-path-reference.md](../11-appendices/platform-path-reference.md).

## Compatibility Testing

- `npm run validate` — frontmatter (compatibility field present)
- `npm run docs:validate` — documentation claims match the environment matrix
- Manual: install each mode in a scratch dir and verify discovery (see [testing-installer-changes.md](testing-installer-changes.md))

## Version Compatibility

- `package.json` version ↔ npm tag must match (enforced in `publish.yml`).
- `plugin.json` version (`0.1.0`) is intentionally static and does **not** track the package version (documented limitation).

See [compatibility-matrix.md](../08-maintenance-release/compatibility-matrix.md).
