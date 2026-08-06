# Debugging the Framework

## Common Failure Areas

| Symptom | Likely Cause | Where to Look |
| :--- | :--- | :--- |
| `npm run validate` fails | Broken frontmatter/structure | The named file; fix per [frontmatter-and-schema-contracts.md](frontmatter-and-schema-contracts.md) |
| `npm run doctor` reports missing | Manifest path drift | Regenerate; see [synchronising-the-plugin-mirror.md](synchronising-the-plugin-mirror.md) |
| `npm run docs:validate` fails | Missing page / broken link | The named file; check SUMMARY and relative links |
| Installer behaves unexpectedly | Flag misuse or guard state | `--dry-run` to preview; read `scripts/install-antigravity.mjs` |
| Hook not firing | Not in manifest / wrong target | Check `plugin.json` hooks list and installed plugin dir |

## Debugging Scripts

All scripts are plain Node with no dependencies — run them directly with extra visibility:

```bash
node scripts/validate-skills.mjs     # full output
node scripts/sync-plugin.mjs --check # drift report
node scripts/validate-docs.mjs       # doc errors
node scripts/install-antigravity.mjs --help
```

## Debugging the Manifest

```bash
# Inspect the generated vs committed manifest
node -e "import('./scripts/sync-plugin.mjs').catch(()=>{})" 2>/dev/null
# or simply:
node scripts/sync-plugin.mjs          # regenerates — compare with git diff
git diff .agents/plugins/development-kit/plugin.json
```

## Debugging the Installer

```bash
# Preview without side effects
node scripts/install-antigravity.mjs --all --dry-run
node scripts/install-antigravity.mjs --opencode --dry-run

# Inspect what a plugin install produces (use a scratch dir)
mkdir -p /tmp/dk-test && cd /tmp/dk-test
node /path/to/development-kit/scripts/install-antigravity.mjs --project
ls -R .agents
```

## Debugging Hooks

Hooks are pure modules — unit-test the exported functions directly:

```bash
node -e "const h = require('./hooks/before-task.js'); console.log(h.validateTaskReadiness({}));"
```

## Debugging Doc Links

```bash
npm run docs:validate   # reports every broken relative link with the file
```

## Systematic Approach

Apply the framework's own `systematic-debugging` skill: **reproduce → locate → fix → protect**. Reproduce with the failing command, locate the failing file/line, fix minimally, and protect with the relevant validator.

See [systematic-debugging.md](../03-reference/skills/systematic-debugging.md) and [error-handling-and-failure-states.md](../06-internals/error-handling-and-failure-states.md).
