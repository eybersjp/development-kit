# Working with Existing Projects

Development Kit is designed to be applied to existing codebases. The methodology's first rule is **inspect before editing** — the repository-scout and `repository-orientation` skill handle this automatically.

## Installation on an Existing Project

```bash
# Install project-local (plugin under ./.agents/)
npx development-kit init --project

# Or standalone (copies components to the project root)
npx development-kit init --all --dry-run   # preview first
npx development-kit init --all             # then install

# Or for OpenCode
npx development-kit init --opencode --dry-run
npx development-kit init --opencode
```

**Safety**: the installer never overwrites an existing `AGENTS.md` or `README.md` without `--force`. Your project's existing rules and docs are preserved.

## How the Methodology Adapts

| Existing-Project Concern | Behavior |
| :--- | :--- |
| Unknown architecture | `/dk-idea` and `/dk-build` spawn the repository-scout to map it first |
| Existing conventions | Scout findings are handed to implementers; `existing-code-first` and `minimal-diff` prevent disruption |
| Existing tests | `regression-testing` protects them; no previously passing test may fail |
| Existing dependencies | `dependency-restraint` requires justification for any *new* dependency |
| Existing docs | Kept as-is; only the artifacts this work requires are created |

## Recommended First Steps on an Existing Codebase

1. **Orient**: run `/dk-status` to confirm the environment, then start with `/dk-idea` so the scout maps the relevant area.
2. **Scope small**: for a first change, choose a small, well-understood task to observe the workflow end-to-end.
3. **Trust the gates**: spec compliance and code quality reviews may flag mismatches with house style — that is the point; the implementer fixes them in scope.

## Caveats

- If the project already has its own `AGENTS.md` rules, Development Kit's rules are *not* forced in — the installer skips the file unless you pass `--force` deliberately.
- Do not run `--all` in a directory where you cannot tolerate file copies into `agents/`, `skills/`, `commands/`, etc. at the root — preview with `--dry-run` first.

## Next Steps

- [starting-new-projects.md](starting-new-projects.md)
- [recovering-from-failed-workflows.md](recovering-from-failed-workflows.md)
