# Testing Installer Changes

## Principles

- **Never test installs in the active project** — use scratch/temporary directories.
- **Prefer `--dry-run`** for logic previews; it performs no writes.
- **Verify file placement, guards, and path rewriting** — the three risky areas.

## Safe Test Recipe

```bash
# 1. Create a scratch project
mkdir -p /tmp/dk-install-test && cd /tmp/dk-install-test

# 2. Preview every mode (no writes)
node /path/to/development-kit/scripts/install-antigravity.mjs --all --dry-run
node /path/to/development-kit/scripts/install-antigravity.mjs --opencode --dry-run
node /path/to/development-kit/scripts/install-antigravity.mjs --all-platforms --dry-run

# 3. Install project-local plugin
node /path/to/development-kit/scripts/install-antigravity.mjs --project

# 4. Verify placement and manifest rewriting
ls -R .agents
cat .agents/plugins/development-kit/plugin.json   # expect ./ paths

# 5. Verify the AGENTS.md guard
echo "# existing rules" > AGENTS.md
node /path/to/development-kit/scripts/install-antigravity.mjs --project
cat AGENTS.md    # unchanged (guard worked)
node /path/to/development-kit/scripts/install-antigravity.mjs --project --force
cat AGENTS.md    # overwritten (force worked)
```

## What to Test After Installer Changes

| Behavior | How |
| :--- | :--- |
| Copy completeness | `ls -R` the target; compare counts with `scripts/` expectations (45 skills, 18 agents, 4 hooks, 14 commands) |
| Manifest path rewrite | `cat` the installed `plugin.json` — `../../../` must be `./` |
| AGENTS.md/README.md guard | Pre-create the file; confirm skip without `--force`, overwrite with `--force` |
| `--dry-run` writes nothing | `git status`/`find` before & after in the scratch dir — no new files |
| Invalid `--dry-run` usage | Expect exit 1 + usage |
| Auto-detect fallback | Run with no flags in a dir without `.agents`/`.gemini` — expect "not found" + exit 1 |
| `--all` skips `package.json` | Pre-create `package.json` in scratch; confirm untouched |
| Windows path handling | Test on Windows: `~` must resolve via `USERPROFILE` |
| Platform destination contract | Run `npm run platform:validate`; confirm only official native paths are produced |
| Adapter preservation and force | Pre-create each destination; confirm preservation by default and replacement with `--force` |
| Adapter dry-run | Confirm all missing destinations remain absent after `--all-platforms --dry-run` |

## Regression Guard

The `.gitignore` contains `.agents/AGENTS.md` — a test artifact from `--project` installer testing — confirming this testing pattern is established. Keep using scratch dirs; do not commit install artifacts.

## Cleanup

```bash
rm -rf /tmp/dk-install-test
```

See [installer-internals.md](../06-internals/installer-internals.md) and [installer-architecture.md](../04-architecture/installer-architecture.md).
