# Unresolved Decisions

## Open Items

This file explicitly records design or operational facts that cannot be determined strictly from source code evidence in the repository as of version `0.3.0`.

| Decision ID | Area | Unresolved Fact | Code Evidence | Default Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **UD-01** | Publishing | Official npm registry target permissions & token governance | `package.json` specifies `"name": "development-kit"`, `.github/workflows/publish.yml` references `NPM_TOKEN` secret | Maintain manual release readiness check; require release manager token setup |
| **UD-02** | Security | External security reporting email address | `SECURITY.md` not present in root prior to documentation update | Direct security disclosures to repository issue tracker with `security` label or security advisory tab |
| **UD-03** | Governance | Formal project steering committee / owner list | `package.json` specifies `"author": "development-kit contributors"` | Establish contributor-driven governance model in `GOVERNANCE.md` |
