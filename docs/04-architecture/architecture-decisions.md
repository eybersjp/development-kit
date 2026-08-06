# Architecture Decisions

Recorded decisions derived from repository evidence (git history, source, manifests). These are observations of existing design choices, not new proposals.

## AD-01: Plugin-as-directory with manifest (Antigravity)

- **Decision**: Package as a plugin directory (`plugins/development-kit/`) with `plugin.json` declaring skills, agents, and hooks.
- **Evidence**: `plugin.json` structure, installer target layout.
- **Consequence**: Content must be copied into the plugin dir on install; manifest references are relative.

## AD-02: Copy-based installer, no junctions

- **Decision**: The installer copies files (`cpSync`/`copyFileSync`) rather than creating symlinks or junctions.
- **Evidence**: `scripts/install-antigravity.mjs` contains no link APIs.
- **Consequence**: Installed copies are independent; re-runs overwrite library content unconditionally.

## AD-03: Four install modes with auto-detect

- **Decision**: `--global`, `--project`, `--all`, `--opencode` + auto-detect fallback; `--force` and `--dry-run` modifiers.
- **Evidence**: Installer flag parsing and `HELP` text.

## AD-04: Guarded root files, unconditional library content

- **Decision**: `AGENTS.md`/`README.md`/existing skills are skipped unless `--force`; library dirs are refreshed unconditionally.
- **Evidence**: existsSync guards in the installer.
- **Consequence**: Reinstalls preserve customisations but refresh methodology content.

## AD-05: Manifest path prefix `../../../` canonical, `./` installed

- **Decision**: Generated manifest paths are relative to the plugin dir pointing back to root; the installer rewrites them to `./` for installed copies.
- **Evidence**: `sync-plugin.mjs` `getRelativePath`, installer regex rewrite.
- **Consequence**: The committed manifest can drift from generated form (current known drift).

## AD-06: OpenCode compatibility via frontmatter + `.opencode/skills/`

- **Decision**: All skills declare `compatibility: opencode`; the `--opencode` mode installs to OpenCode's auto-discovery path with progressive loading.
- **Evidence**: Frontmatter scan (43/43), `opencode.json`.

## AD-07: Three independent validators

- **Decision**: Structural (`validate-skills`), manifest (`sync-plugin --check`), and documentation (`validate-docs`) validation are separate scripts with separate package entries.
- **Evidence**: `package.json` scripts.

## AD-08: Fresh sub-agents as the isolation mechanism

- **Decision**: Assumption drift is prevented by spawning a fresh implementation agent per task rather than managing long-lived agent state.
- **Evidence**: Agent definitions, `subagent-driven-implementation` skill, always-on rule 7.

## AD-09: Hooks are pure CommonJS function modules

- **Decision**: Hooks export plain functions/objects with no load-time side effects.
- **Evidence**: `hooks/*.js` module exports.

## Unresolved

- `plugin.json` version (`0.1.0`) vs package version (`0.3.0`) — see [unresolved-decisions.md](../00-documentation/unresolved-decisions.md).
- Whether `docs:validate` should be wired into CI — see [known-limitations.md](../11-appendices/known-limitations.md).
