# v0.9.1 Stable-Release Acceptance Checklist

**Target Version**: v0.9.1  
**Target Branch**: fix/v0.9.1-field-hardening  
**Status**: PENDING FINAL GATES (DO NOT MERGE / DO NOT RELEASE YET)  

---

## Phase 1: Engineering & Regression Validation
- [x] All 87 field-hardening unit and regression tests pass (`node --test scripts/v091-field-hardening.test.mjs`).
- [x] Full evaluation test suite passes: 384 checks, 35 evaluation scenarios (`npm test`).
- [x] Production release validation gate passes (`npm run release:validate`).
- [x] Plugin mirror is fully synchronized with canonical sources (`npm run doctor`).
- [x] Package consumer integration tests pass (`node --test scripts/package-consumer.test.mjs`).

## Phase 2: Live Field Acceptance Testing
- [ ] Perform real-world end-to-end `/dk-idea` flow in a clean scratch project with human Product Owner interaction.
- [ ] Confirm that `idea-present-interaction` creates valid fingerprints.
- [ ] Verify that single-turn self-confirmation attempts fail closed with `DK_INTERACTION_FINGERPRINT_MISMATCH`.
- [ ] Verify that discovery candidates, questions, and decisions persist across restart/resume.
- [ ] Confirm that `idea-approve` locks the brief and unlocks `/dk-spec`.

## Phase 3: Documentation & Release Assets Audit
- [x] Version truthfulness maintained: `package.json` remains `0.9.0` until maintainer release step.
- [x] README reflects `Current release: v0.9.0` and contains accurate `v0.9.1 Field Hardening (In Progress)` section.
- [x] CHANGELOG prepared with complete `## [0.9.1] - Unreleased` section.
- [x] Documentation free of obsolete authority bypass examples or stale command counts.
- [x] Documentation validation passes without dead links or formatting errors (`npm run docs:validate`).
- [x] Draft release notes prepared with PENDING live acceptance status.
- [x] Marketing copy prepared for release day (GitHub, npm, LinkedIn, X).

## Phase 4: Release Cut (To be executed only upon final maintainer approval)
- [ ] Bump version in `package.json` from `0.9.0` to `0.9.1`.
- [ ] Run `node scripts/sync-plugin.mjs` to align manifest.
- [ ] Update CHANGELOG heading from `## [0.9.1] - Unreleased` to `## [0.9.1] - <RELEASE_DATE>`.
- [ ] Commit release changes: `chore(release): cut v0.9.1`.
- [ ] Merge PR #35 into `main`.
- [ ] Tag release `v0.9.1` and push to GitHub.
- [ ] Verify GitHub Actions `publish.yml` completes and publishes to npm registry.

## Phase 5: Post-Release Marketing Execution
- [ ] Publish GitHub Release with prepared release notes.
- [ ] Verify npm package page displays updated version and README.
- [ ] Post announcement to LinkedIn and X/Twitter using prepared copy.
