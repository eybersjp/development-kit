# Synchronising the Plugin Mirror

## When to Sync

Run the sync after **any canonical change** inside:

- `skills/`
- `agents/`
- `commands/`
- `hooks/`

This includes content edits, not only additions/removals/renames. The committed mirror is required to match canonical inventory and file bytes.

## Commands

```bash
# Synchronise mirror directories and regenerate plugin.json
node scripts/sync-plugin.mjs

# Read-only release-gate check
npm run doctor
# equivalent: node scripts/sync-plugin.mjs --check

# Explicit fix mode
node scripts/sync-plugin.mjs --fix
```

## What Sync Does

| Operation | Done by sync? |
| :--- | :--- |
| Copy canonical `skills/` into mirror | Yes |
| Copy canonical `agents/` into mirror | Yes |
| Copy canonical `commands/` into mirror | Yes |
| Copy canonical `hooks/` into mirror | Yes |
| Remove stale/extra files in those controlled mirror directories | Yes |
| Regenerate `plugin.json` references | Yes |
| Rewrite manifest paths for installed target copies | No, the installer does this at install time |
| Edit canonical root content | No |

## Verification

```bash
npm run doctor
npm run validate
```

A clean doctor run reports that the plugin manifest and committed mirror are in sync. Any missing, extra, or byte-different file or manifest mismatch causes a nonzero exit code.

Because `npm run doctor` is part of `npm run release:validate`, mirror drift blocks CI and release publication.

## Contributor Workflow

1. Edit canonical root files only.
2. Run `node scripts/sync-plugin.mjs` after canonical skills/agents/commands/hooks change.
3. Review both canonical and derived mirror diffs.
4. Run `npm run doctor` and the complete applicable validation suite.
5. Commit canonical and synchronized mirror changes together.

## Never Do

- Make a feature change only in `.agents/plugins/development-kit/`.
- Hand-edit `plugin.json` entries or path forms to bypass generation.
- Ignore a doctor failure as informational.

See [canonical-source-and-plugin-mirror.md](../04-architecture/canonical-source-and-plugin-mirror.md), [plugin-sync-internals.md](../06-internals/plugin-sync-internals.md), and [sync-plugin.md](../03-reference/scripts/sync-plugin.md).
