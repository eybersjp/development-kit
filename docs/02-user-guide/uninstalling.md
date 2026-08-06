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
