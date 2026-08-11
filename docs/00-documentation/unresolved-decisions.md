# Unresolved Decisions

## Open Items

This file explicitly records design or operational facts that cannot be determined strictly from source code evidence in the repository as of version `0.5.2`.

| Decision ID | Area | Unresolved Fact | Code Evidence | Default Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **UD-01** | Publishing | Official npm registry target permissions & token governance | `package.json` specifies `"name": "development-kit"`, `.github/workflows/publish.yml` references `NPM_TOKEN` secret | Maintain manual release readiness check; require release manager token setup |
| **UD-02** | Automated Sync | Automated npm tag publishing without manual verification gate | `package.json`, `.github/workflows/publish.yml` | Require explicit maintainer trigger for npm publish step |
| **UD-03** | Runtime | Dynamic runtime skill pruning based on language detection | `src/` directory, skill loading subsystem | Maintain static plugin/skill loading; evaluate dynamic pruning for future major versions |
| **UD-04** | Governance | Formal project steering committee / owner list | `package.json` specifies `"author": "development-kit contributors"` | Establish contributor-driven governance model in `GOVERNANCE.md` |

