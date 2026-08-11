# Installer Safety & Overwrite Rules

The installer script (`scripts/install-antigravity.mjs`) implements strict safety guards to protect existing user work.

## Protected Files

1. **`AGENTS.md`**: If `AGENTS.md` already exists at the target path, the installer skips copying it and prints:
   ` - AGENTS.md already exists at target (skipped)`
2. **`README.md`**: Skipped if present during `--all` installs.
3. **`package.json`**: Explicitly excluded from directory copies to avoid corrupting host project configurations.
4. **`opencode.json`**: Skipped if present during `--opencode` installs unless `--force` is provided.
5. **Platform adapters**: Existing `CLAUDE.md`, Claude skill files, `.cursor/rules/dkf.mdc`, `.github/copilot-instructions.md`, `.clinerules/dkf.md`, and `.windsurf/rules/dkf.md` are each preserved unless `--force` is provided.

## Overriding Safety Guards (`--force`)

Passing `--force` overrides `existsSync` protection and forces overwriting:
```bash
node scripts/install-antigravity.mjs --project --force
```

Platform adapter files are replaced, not merged, when forced. Review existing project instructions first.

## Previewing Changes (`--dry-run`)

Test installation steps without making file changes:
```bash
node scripts/install-antigravity.mjs --opencode --dry-run
```
Adapter dry runs also create no directories or files:

```bash
node scripts/install-antigravity.mjs --all-platforms --dry-run
```
Outputs `→` lines showing planned operations without modifying disk.
