# Platform Integrations

Development Kit can install project-local instructions for Claude Code, Cursor, VS Code with GitHub Copilot, Cline, and Windsurf. Run the installer from the project that should receive the adapter.

## Install an adapter

Preview first, then repeat without `--dry-run`:

```bash
npx development-kit init --claude --dry-run
npx development-kit init --claude
```

Use `--cursor`, `--vscode`, `--cline`, or `--windsurf` for another platform. Multiple platform flags can be selected in one invocation. `--all-platforms` selects these five adapters only; it does not install Antigravity or OpenCode, which retain the explicit `--project`, `--global`, and `--opencode` modes.

## Installed paths

| Platform flag | Project-local path | Integration behavior |
|---|---|---|
| `--claude` | `CLAUDE.md` and `.claude/skills/<dk-command>/SKILL.md` | Claude Code receives project instructions plus native, invokable skills for all 14 DK commands. |
| `--cursor` | `.cursor/rules/dkf.mdc` | Cursor receives a project rule containing the DK workflow instructions. |
| `--vscode` | `.github/copilot-instructions.md` | VS Code with GitHub Copilot receives repository instructions. |
| `--cline` | `.clinerules/dkf.md` | Cline receives a project rule containing the DK workflow instructions. |
| `--windsurf` | `.windsurf/rules/dkf.md` | Windsurf receives a project rule containing the DK workflow instructions. |

The adapter does not create `.vscode/settings.json` or legacy root rule files. On platforms without native slash-command packaging, the rules expose names such as `/dk-autopilot` as workflow instructions to follow, not as registered slash commands.

## Safety

Existing destination files are preserved unless `--force` is supplied. This applies to the platform rule file and every generated Claude skill file independently. `--dry-run` reports planned or preserved destinations without creating directories or writing files.

Use `--force` only after reviewing the existing project instructions, because it replaces adapter-managed destination files rather than merging their contents.

See the [installer reference](../03-reference/scripts/install-platform-adapters.md) for the complete flag and file contract.
