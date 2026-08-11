# Uninstalling Development Kit

To completely remove Development Kit from your workspace or global environment:

## Antigravity Project Uninstallation

```bash
# Remove project-local plugin and rules
rm -rf .agents/plugins/development-kit
rm -f .agents/AGENTS.md
```

## Antigravity Global Uninstallation

```bash
# Remove global plugin and rules (macOS/Linux)
rm -rf ~/.gemini/config/plugins/development-kit
rm -f ~/.gemini/config/AGENTS.md

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\config\plugins\development-kit"
Remove-Item -Force "$env:USERPROFILE\.gemini\config\AGENTS.md"
```

## OpenCode Uninstallation

```bash
rm -rf .opencode/skills/
rm -f opencode.json AGENTS.md
```

## Platform Adapter Uninstallation

Remove only files that Development Kit installed and that you no longer need:

```bash
rm -f CLAUDE.md
rm -rf .claude/skills/dk-*
rm -f .cursor/rules/dkf.mdc
rm -f .github/copilot-instructions.md
rm -f .clinerules/dkf.md
rm -f .windsurf/rules/dkf.md
```

The installer does not create `.vscode/settings.json` or legacy root rule files, so those are not part of adapter cleanup. If a destination existed before installation and was replaced using `--force`, uninstall cannot restore its earlier contents; recover it from version control or a backup.
