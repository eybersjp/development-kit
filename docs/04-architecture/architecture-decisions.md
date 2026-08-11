# Architecture Decisions

Recorded decisions derived from repository evidence (git history, source, manifests). These describe implemented design choices.

## AD-01: Plugin-as-directory with manifest (Antigravity)

- **Decision**: Package as a plugin directory (`plugins/development-kit/`) with `plugin.json` declaring skills, agents, and hooks.
- **Evidence**: `plugin.json` structure, installer target layout.
- **Consequence**: Content must be copied into the plugin dir on install; manifest references are relative.

## AD-02: Copy-based installer, no junctions

- **Decision**: The installer copies files (`cpSync`/`copyFileSync`) rather than creating symlinks or junctions.
- **Evidence**: `scripts/install-antigravity.mjs` contains no link APIs.
- **Consequence**: Installed copies are independent; re-runs refresh library content according to installer rules.

## AD-03: Four install modes with auto-detect

- **Decision**: `--global`, `--project`, `--all`, `--opencode` + auto-detect fallback; `--force` and `--dry-run` modifiers.
- **Evidence**: Installer flag parsing and `HELP` text.

## AD-04: Guarded root files, refreshed library content

- **Decision**: `AGENTS.md`/`README.md`/existing skills are skipped unless `--force`; library dirs are refreshed according to installer mode.
- **Evidence**: `existsSync` guards in the installer.
- **Consequence**: Reinstalls preserve guarded user customisations while refreshing methodology content where allowed.

## AD-05: Manifest path prefix `../../../` canonical, `./` installed

- **Decision**: Generated manifest paths are relative to the plugin dir pointing back to root; the installer rewrites them to `./` for installed copies.
- **Evidence**: `sync-plugin.mjs` path generation and installer regex rewrite.
- **Consequence**: The committed manifest must stay synchronized with canonical skill/agent inventory and is checked by `npm run doctor`.

## AD-06: OpenCode compatibility via frontmatter + `.opencode/skills/`

- **Decision**: All 45 skills declare `compatibility: opencode`; the `--opencode` mode installs to OpenCode's auto-discovery path with progressive loading.
- **Evidence**: Skill frontmatter and `opencode.json`.

## AD-07: Independent validators composed into one release gate

- **Decision**: Structural, manifest, documentation, OpenCode, platform adapter, external research contract, Autopilot, and evaluation validation remain independently runnable but are composed by `npm run release:validate`.
- **Evidence**: `package.json` scripts and `.github/workflows/ci.yml`.

## AD-08: Fresh sub-agents as the isolation mechanism

- **Decision**: Assumption drift is prevented by spawning a fresh implementation agent per task rather than managing long-lived implementation-agent state.
- **Evidence**: Agent definitions, `subagent-driven-implementation` skill, and always-on rules.

## AD-09: Hooks are pure CommonJS function modules

- **Decision**: Hooks export plain functions/objects with no load-time side effects.
- **Evidence**: `hooks/*.js` module exports.

## AD-10: External capability providers are optional adapters

- **Decision**: External research is provider-neutral. Providers extend available observation/tooling but do not become trusted instruction authorities or core dependencies by default.
- **Evidence**: `/dk-research`, `external-research`, `agent-reach-integration`, `AGENTS.md`, conductor routing, Autopilot routing, and the External Capability Providers architecture page.
- **Consequence**: Native and already-connected capabilities are preferred; provider installation is never silent; authenticated reads, writes, system changes, and destructive actions retain Development Kit approval controls.

## AD-11: Agent-Reach is the first documented provider, not a dependency

- **Decision**: Agent-Reach is supported through integration guidance rather than an npm/Python dependency declaration in Development Kit.
- **Evidence**: `skills/agent-reach-integration/SKILL.md` and `package.json`.
- **Consequence**: Development Kit stays Node-based and can operate without Agent-Reach. If Agent-Reach is used, installation/system changes require approval and pinned tagged releases/commits are preferred over mutable installation sources.

## AD-12: External content remains outside the trusted control plane

- **Decision**: Retrieved pages, posts, comments, transcripts, documents, source metadata, and provider output are treated as untrusted data.
- **Evidence**: `AGENTS.md`, `/dk-research`, conductor, Autopilot, security trust boundaries, threat model, and research contract test.
- **Consequence**: Retrieved content may inform conclusions but cannot override user intent, Development Kit rules, repository policy, or approval gates and cannot authorize execution merely by containing instructions.

## Unresolved

- `plugin.json` retains its plugin-manifest versioning contract separately from the npm package version. See [unresolved-decisions.md](../00-documentation/unresolved-decisions.md) for the historical discussion.
