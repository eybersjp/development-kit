# sync-plugin

**Source**: `scripts/sync-plugin.mjs` · **Package entry**: `npm run doctor` (with `--check`)

## Purpose

Synchronises the Development Kit plugin manifest (`.agents/plugins/development-kit/plugin.json`) with the actual skills, agents, and hooks directories. Updates references, checks for missing files, and reports status.

## Syntax

```bash
node scripts/sync-plugin.mjs          # Sync and report (writes plugin.json)
node scripts/sync-plugin.mjs --check  # Check only, no changes
node scripts/sync-plugin.mjs --fix    # Fix issues automatically (writes plugin.json)
```

## Behavior

| Mode | Writes? | Output |
| :--- | :--- | :--- |
| *(none)* | Yes | Regenerates `plugin.json` from `skills/`, `agents/`, `hooks/`; prints counts |
| `--check` | No | Compares the committed manifest against the generated one; prints "Skills: N defined, M available", missing lists, and "✓ Plugin is in sync" when they match |
| `--fix` | Yes | Regenerates and prints counts |

## Generated Paths

References are computed **relative to the plugin directory** (`.agents/plugins/development-kit/`), e.g. `../../../skills/<name>`. The installer rewrites this prefix to `./` for installed copies.

## Exit Codes

- `--check` **always exits 0** — it reports drift but is not a failing gate (see [known-limitations.md](../../11-appendices/known-limitations.md)).

## Known Drift Issue

The committed `plugin.json` currently uses `./` prefixed paths, so `--check` reports all 43 skills and 18 agents as "missing" (path-prefix mismatch) even though the files exist. Run `node scripts/sync-plugin.mjs` (no flag) to regenerate the manifest in the canonical `../../../` form and restore a clean doctor report.

## Error Handling

- Missing `plugin.json` in `--check` mode prints "Plugin manifest not found" (does not fail).
- No other error paths.

## Idempotency

Regeneration is deterministic — repeated runs produce identical output.

## Security & Path Safety

- Only reads directories and writes the manifest; no other files touched.

See [plugin-sync-internals.md](../../06-internals/plugin-sync-internals.md) and [canonical-source-and-plugin-mirror.md](../../04-architecture/canonical-source-and-plugin-mirror.md).
