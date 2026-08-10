# sync-plugin

**Source**: `scripts/sync-plugin.mjs` · **Package entry**: `npm run doctor` (with `--check`)

## Purpose

Synchronises the committed Antigravity plugin mirror with canonical root content and keeps `.agents/plugins/development-kit/plugin.json` aligned with canonical skills, agents, and hooks.

The mirror contract covers:

- `skills/`
- `agents/`
- `commands/`
- `hooks/`
- `plugin.json`

## Syntax

```bash
node scripts/sync-plugin.mjs          # Synchronise mirror + manifest
node scripts/sync-plugin.mjs --check  # Verify only, no changes
node scripts/sync-plugin.mjs --fix    # Synchronise mirror + manifest
```

## Behavior

| Mode | Writes? | Output |
| :--- | :--- | :--- |
| *(none)* | Yes | Replaces mirrored content from canonical directories, regenerates `plugin.json`, then verifies the result |
| `--check` | No | Compares canonical and mirror inventories/content plus the generated manifest; exits nonzero on drift |
| `--fix` | Yes | Same synchronization behavior as the no-flag mode |

## Manifest Generation

References are computed relative to `.agents/plugins/development-kit/`, for example `../../../skills/<name>`. The installer rewrites this prefix to `./` for self-contained installed plugin copies.

The manifest remains intentionally separate from npm package versioning and currently retains the plugin-manifest version contract `0.1.0`.

## Mirror Verification

For each canonical mirror directory, `--check` verifies:

- the mirror directory exists
- every canonical file exists in the mirror
- no unexpected extra mirror files exist
- corresponding files are content-equivalent after normalizing CRLF and LF line endings

The check also compares the entire committed `plugin.json` object with the deterministically generated canonical manifest.

## Exit Codes

- `0`: manifest and committed mirror are synchronized.
- `1`: any manifest, inventory, missing-file, extra-file, or content mismatch is detected.

Because `npm run doctor` is part of `npm run release:validate`, plugin mirror drift is release-blocking.

## Error Handling

Invalid or missing `plugin.json` is reported as synchronization drift and causes `--check` to fail. Missing mirror directories, missing files, extra files, and material content differences also fail the check; CRLF/LF-only differences do not.

## Idempotency

Synchronization is deterministic. Repeated runs with unchanged canonical content produce the same mirror and manifest.

## Security & Path Safety

- Synchronization is restricted to the repository's `.agents/plugins/development-kit/` mirror and its four controlled content directories.
- `--check` is read-only.
- Write modes replace only the controlled mirror directories and `plugin.json`.

See [plugin-sync-internals.md](../../06-internals/plugin-sync-internals.md), [synchronising-the-plugin-mirror.md](../../05-developer-guide/synchronising-the-plugin-mirror.md), and [canonical-source-and-plugin-mirror.md](../../04-architecture/canonical-source-and-plugin-mirror.md).
