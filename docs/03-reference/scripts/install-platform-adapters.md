# install-platform-adapters

**Source**: `scripts/install-platform-adapters.mjs` · **CLI entry**: `scripts/install-antigravity.mjs`

## Purpose

Installs native project instruction files for Claude Code, Cursor, VS Code with GitHub Copilot, Cline, and Windsurf. The module supplies the adapter map, platform selection, guarded writes, and dry-run planning used by the package CLI.

## CLI flags

| Flag | Destination |
|---|---|
| `--claude` | `CLAUDE.md` plus `.claude/skills/<dk-command>/SKILL.md` for all 14 DK commands |
| `--cursor` | `.cursor/rules/dkf.mdc` |
| `--vscode` | `.github/copilot-instructions.md` |
| `--cline` | `.clinerules/dkf.md` |
| `--windsurf` | `.windsurf/rules/dkf.md` |
| `--all-platforms` | All five adapters above; not Antigravity or OpenCode |

Multiple individual platform flags are deduplicated. When an adapter flag is present, the CLI performs the selected adapter installation and exits; use the separate explicit modes for Antigravity and OpenCode.

## Write contract

- All destinations are relative to the current working directory.
- Existing files return `preserved` and remain unchanged unless `--force` is used.
- Missing parent directories are created only during a real write.
- `--dry-run` returns `planned` for missing files and `preserved` for existing files, and performs no writes.
- `--force` replaces existing adapter destinations with their packaged templates.

Claude skills are native, invokable skill packages. The four rule-based adapters expose DK workflow names as instructions where the host does not provide native slash-command packaging. The installer does not write `.vscode/settings.json` or legacy root rule files.

## Module API

- `PLATFORM_ADAPTERS`: immutable platform-to-template and destination mapping.
- `resolvePlatformSelection(args)`: resolves explicit flags or all five adapter names.
- `installPlatformAdapters(options)`: validates the target and platform list, then returns one result per destination with `sourcePath`, `targetPath`, and `status`.

Unsupported platform names and invalid option shapes throw errors. File-system errors surface to the caller.

## Verification

Run `npm run platform:validate`. It executes the adapter CLI integration tests and packaged-template validation tests under the normal Node test runner.

See [Platform Integrations](../../02-user-guide/platform-integrations.md) and [Installer Architecture](../../04-architecture/installer-architecture.md).
