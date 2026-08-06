# Post-Release Verification

Complete these checks after every public Development Kit release.

## Verify repository publication

1. Confirm the canonical `vMAJOR.MINOR.PATCH` tag exists locally and remotely.
2. Dereference the annotated tag and confirm it points to the intended release commit.
3. Confirm the tagged commit is contained in `main`.
4. Confirm no duplicate alias tag exists.
5. Confirm `main` is synchronized with `origin/main`.

Example:

```bash
git tag --list "*MAJOR.MINOR.PATCH*"
git ls-remote --tags origin "*MAJOR.MINOR.PATCH*"
git rev-parse "vMAJOR.MINOR.PATCH^{}"
git merge-base --is-ancestor vMAJOR.MINOR.PATCH main
```

## Verify GitHub Release

- Confirm the release exists for the canonical tag.
- Confirm it is public, not a draft, and not an unintended prerelease.
- Review generated notes for accuracy.
- Confirm the release issue contains the final publication status and is closed as completed.

## Verify npm publication

```bash
npm view development-kit version
npm view development-kit@MAJOR.MINOR.PATCH version
```

Confirm the requested version is publicly available and the `latest` distribution tag points to the intended release when appropriate.

## Clean installation checks

Use a new temporary directory rather than a maintainer checkout.

### OpenCode

```bash
npx development-kit@MAJOR.MINOR.PATCH init --opencode
```

Verify:

- `.opencode/skills/` is populated.
- Root `AGENTS.md` exists.
- `opencode.json` declares `https://opencode.ai/config.json`.
- `opencode.json` does not contain `rules`.
- OpenCode opens the project without a configuration error.

### Antigravity

Run the intended installation mode and confirm plugin discovery, commands, agents, skills, and hooks are available.

## Validate the released source

From the release tag or an exact clean checkout:

```bash
npm run release:validate
```

Do not treat only the development branch CI result as sufficient evidence when release automation or packaging changed.

## Record evidence

Retain:

- Release workflow result.
- Release tag and dereferenced commit.
- GitHub Release location.
- npm version output.
- Clean installation result.
- Known limitations or follow-up issues.

## Related documentation

- [Release Process](release-process.md)
- [Pre-Release Checklist](pre-release-checklist.md)
- [npm Publishing](npm-publishing.md)
- [Verifying Installation](../02-user-guide/verifying-installation.md)
