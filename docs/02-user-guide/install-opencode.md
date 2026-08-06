# Install OpenCode

The `--opencode` installation flag configures Development Kit skills and rules for use in the **OpenCode** AI assistant environment.

## Command

```bash
node scripts/install-antigravity.mjs --opencode
```
With dry-run:
```bash
node scripts/install-antigravity.mjs --opencode --dry-run
```

## Installed Content & Destination Paths

* `./.opencode/skills/`: All 43 skills copied recursively into `.opencode/skills/<skill_name>/SKILL.md`.
* `./opencode.json`: Contains `{"rules": ["AGENTS.md"]}`.
* `./AGENTS.md`: Mandatory engineering rules copied to project root.

## Skill Compatibility Metadata

All 43 skills contain OpenCode compatibility metadata in their `SKILL.md` frontmatter:
```yaml
compatibility:
  opencode: true
  antigravity: true
```
OpenCode automatically discovers skills in `.opencode/skills/` and loads root rules referenced in `opencode.json`.
