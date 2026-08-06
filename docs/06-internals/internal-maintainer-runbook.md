# Internal Maintainer Runbook

## Routine Tasks

### Add a skill / agent / hook

```bash
# 1. Create canonical file(s)
# 2. Regenerate the manifest
node scripts/sync-plugin.mjs
# 3. Validate
npm run validate && npm run doctor && npm run docs:validate
# 4. Docs: reference page + indexes + SUMMARY (same change)
```

### Rename a component

Rename the canonical file, regenerate the manifest, update `skill-routing` if the name is referenced, update docs, validate.

### Fix a docs link

```bash
npm run docs:validate   # names the broken link
```

### Regenerate the mirror

The mirror content under `.agents/plugins/development-kit/` is refreshed by installing the plugin into the repo:

```bash
node scripts/install-antigravity.mjs --project
```

(Verifies the copies stay byte-identical with `diff -rq agents .agents/plugins/development-kit/agents`.)

## Weekly / Pre-Release

1. `npm run validate`, `npm run doctor`, `npm run docs:validate` — all green.
2. Bump `package.json` version; ensure tag matches (see [release-process.md](../08-maintenance-release/release-process.md)).
3. Update `CHANGELOG.md` from the git log (see [changelog-policy.md](../08-maintenance-release/changelog-policy.md)).
4. Verify docs version references (`0.3.0` → new version) across landing pages.

## Incident Response

| Incident | Response |
| :--- | :--- |
| Doctor reports mass drift | Regenerate the manifest; investigate who hand-edited it |
| Validate fails in CI | Read the named file; fix frontmatter/structure |
| Publish fails tag check | Align `package.json` version with the tag |
| Installer overwrote user file (force misuse) | Restore from user's VCS; document the `--force` risk |

## Never

- Edit `.agents/plugins/development-kit/` by hand.
- Hand-edit `plugin.json` paths.
- Add a dependency without the [dependency-policy.md](../05-developer-guide/dependency-policy.md) process.
- Ship with any validator failing or any documented gap unfixed.

## Escalation

Unresolvable contradictions (e.g. conflicting evidence about intended behaviour) are recorded in [unresolved-decisions.md](../00-documentation/unresolved-decisions.md) rather than guessed.
