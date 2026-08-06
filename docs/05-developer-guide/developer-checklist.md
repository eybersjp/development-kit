# Developer Checklist

Pre-submission checklist for any change to the Development Kit repository.

## Content Changes

- [ ] Edited **canonical** locations only (never `.agents/plugins/development-kit/`)
- [ ] Frontmatter valid (`name`, `description`, `compatibility: opencode` where required)
- [ ] Required sections present per component type (see [frontmatter-and-schema-contracts.md](frontmatter-and-schema-contracts.md))
- [ ] No uncompleted placeholder markers in shipped content/docs
- [ ] No local absolute `file://` protocol URLs; relative links only

## Docs Changes

- [ ] Reference page exists/updated under `docs/03-reference/<type>/`
- [ ] Index pages updated (`README.md`, catalogues, matrices)
- [ ] `docs/SUMMARY.md` includes every new/renamed page
- [ ] Root `README.md` / `AGENTS.md` updated when commands/agents/skills inventory changes
- [ ] CHANGELOG updated for user-visible changes (per [changelog-policy.md](../08-maintenance-release/changelog-policy.md))

## Validation

- [ ] `npm run validate` passes (0 errors)
- [ ] `npm run doctor` clean (regenerate manifest if inventory changed)
- [ ] `npm run docs:validate` passes (0 errors)
- [ ] For installer changes: scratch-dir install test per [testing-installer-changes.md](testing-installer-changes.md)
- [ ] For behaviour-affecting skill changes: the `evals/<skill>/` scenario still matches

## Commit

- [ ] Conventional, concise commit message
- [ ] One logical change per commit
- [ ] No install artifacts, secrets, or unrelated files in the diff

## Definition of Done

All three validators green **and** the change is consistent with the architecture invariants (see [architecture-invariants.md](../04-architecture/architecture-invariants.md)) — especially: canonical-only edits, generated manifests, and never removing the Ponytail exclusions.
