# Troubleshooting

## Installation

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| "Antigravity configuration not found" | No Antigravity config detected in auto mode | Use an explicit flag: `--global`, `--project`, `--all`, or `--opencode` |
| "`--dry-run` must be used with `--all` or `--opencode`" | `--dry-run` without a copy mode | Add the mode: `npx development-kit init --all --dry-run` |
| Files "already exists (skipped)" on reinstall | Safety guard for `AGENTS.md`/`README.md`/skills | Expected. Pass `--force` only if you intend to overwrite |
| Plugin commands not available after install | Wrong install mode or plugin not discovered | Verify the plugin dir (`<target>/plugins/development-kit/`) and manifest; reinstall |
| `npx development-kit init` fails | npm bin resolution / network | Check npm connectivity; run `node scripts/install-antigravity.mjs` directly from the repo |

## Validation

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `npm run doctor` prints "Missing skills/agents" | Committed manifest uses `./` paths vs generated `../../../` paths | Regenerate: `node scripts/sync-plugin.mjs` (see [sync-plugin.md](../03-reference/scripts/sync-plugin.md)) |
| `npm run validate` errors | Broken frontmatter or unresolvable manifest reference | Fix the offending `SKILL.md`/agent file or run the sync script |
| `npm run docs:validate` errors | Missing reference page or broken link | Create the page / fix the link per the error message |

## Workflow

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `/dk-build` refuses to start | No approved spec/design/tasks yet | Complete `/dk-spec`, `/dk-design`, `/dk-tasks` first |
| Review gate keeps failing | Implementation genuinely out of compliance or low quality | Fix per the review report and re-run; do not bypass |
| Implementer reports a blocker | Task mis-specified or impossible as stated | Revise via `/dk-spec` + `/dk-tasks`, then resume |
| Tests failing after simplification | Simplification removed something needed | Restore the removed item; re-run tests; the never-remove list protects tests/validation/security |

## Environment

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Node version too old | `package.json` requires `>=18.0.0` | Upgrade Node (CI uses 22) |
| Windows path issues in examples | Bash vs PowerShell quoting | Use the platform examples in [platform-path-reference.md](../11-appendices/platform-path-reference.md) |

## Still Stuck?

1. Run `/dk-status` to confirm the workflow state.
2. Run the validators and read the exact error lines.
3. If it is an installation issue, uninstall cleanly ([uninstalling.md](uninstalling.md)) and reinstall.
4. File an issue per [issue-reporting.md](../09-contributing/issue-reporting.md).
