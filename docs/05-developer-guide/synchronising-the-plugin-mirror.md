# Synchronising the Plugin Mirror

## When to Sync

Run the sync after **any change** to the inventory of:

- `skills/` (added/removed/renamed skill dirs)
- `agents/` (added/removed/renamed agent files)
- `hooks/` (added/removed/renamed hook files)

Command, template, eval, and script changes do **not** affect `plugin.json` (commands/templates/evals are not manifest entries; scripts are referenced from `package.json`).

## Commands

```bash
# Regenerate plugin.json from canonical dirs (writes)
node scripts/sync-plugin.mjs

# Check for drift (read-only, reports missing entries)
npm run doctor
# equivalent: node scripts/sync-plugin.mjs --check

# Fix mode (writes) — same output as no-flag mode
node scripts/sync-plugin.mjs --fix
```

## What Sync Does & Does Not Do

| Operation | Done by sync? |
| :--- | :--- |
| Regenerate `plugin.json` references | ✅ yes |
| Copy content files into the mirror dirs | ❌ no — done by the installer |
| Rewrite manifest paths for installed copies | ❌ no — done by the installer at install time |

The mirror **content** directories (`.agents/plugins/development-kit/{skills,agents,commands,hooks}`) are refreshed when the installer runs (e.g. `--project` into the repo's own `.agents/`); they are not maintained by the sync script itself.

## Verification

```bash
npm run doctor          # expect "✓ Plugin is in sync"
npm run validate        # manifest references resolve
```

## Known Drift Issue

If `npm run doctor` prints all skills/agents as "missing", the committed manifest has `./` path prefixes instead of the generated `../../../` form. Regenerate with `node scripts/sync-plugin.mjs` to restore canonical form. See [sync-plugin.md](../03-reference/scripts/sync-plugin.md).

## Never Do

- Hand-edit `plugin.json` paths or entries.
- Edit mirror content files directly.

See [canonical-source-and-plugin-mirror.md](../04-architecture/canonical-source-and-plugin-mirror.md) and [plugin-sync-internals.md](../06-internals/plugin-sync-internals.md).
