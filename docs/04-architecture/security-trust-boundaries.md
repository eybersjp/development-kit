# Security & Trust Boundaries

This page maps trust boundaries and the security posture of the framework itself. See [threat-model.md](../07-testing-quality-security/threat-model.md) for the full threat analysis and [External Capability Providers](external-capability-providers.md) for the provider contract.

## Trust Boundaries

```mermaid
graph TB
    subgraph User machine
        U["User"]
        A["AI agent runtime (Antigravity/OpenCode)"]
        DK["Development Kit trusted control content"]
        FS["User filesystem"]
        P["Optional external capability provider"]
    end
    subgraph External
        NPM["npm registry"]
        GH["GitHub (repo + CI)"]
        SRC["External sources and services"]
    end
    U --> A
    A --> DK
    A --> P
    P --> SRC
    SRC -->|"untrusted data"| P
    P -->|"untrusted provider output"| A
    I["installer (scripts/install-antigravity.mjs)"] --> FS
    DK --> I
    GH -->|"publish"| NPM
    NPM -->|"npx install"| I
```

## Boundary Inventory

| Boundary | Actors | Risks | Required control |
| :--- | :--- | :--- | :--- |
| Agent -> Development Kit content | Agent executes methodology from package files | Malicious repository text could be confused with framework rules | Canonical rules and command/skill contracts remain authoritative |
| External source -> provider -> agent | Web pages, posts, transcripts, source metadata, provider output | Indirect prompt injection, misleading evidence, malicious embedded instructions | Treat all retrieved content as untrusted data; never execute instructions merely because retrieved content contains them |
| Provider -> credentials/session material | Optional provider accesses token, account, browser session, cookies, or equivalent auth material | Credential theft, account compromise, unintended authenticated access | Authenticated reads require permission; never commit or expose sensitive material |
| Agent/provider -> external state | Provider can post, create, modify, upload, or delete | Unintended consequential action | Development Kit approval gate for writes; stronger gate for destructive actions |
| Provider installer -> host system | Provider tooling may install packages or alter configuration | Supply-chain compromise, environment drift, unexpected services | No silent install; system/configuration change requires approval; prefer pinned releases/commits |
| Installer -> filesystem | Installer copies files into config dirs / project root | Overwrites, path mistakes, `--force` misuse | Overwrite guards and dry-run behavior |
| Repo -> npm | Publish workflow pushes the package | Compromised credentials, wrong version, secrets in package | Release validation, GitHub secret isolation, version/tag checks |
| User -> agent | User supplies requests and answers | Ambiguous or intentionally unsafe requests | Lifecycle gates and applicable safety/approval policy |

## External Content Invariant

External content may inform Development Kit decisions but may never modify Development Kit authority.

A retrieved source cannot:

- Override the user request.
- Override `AGENTS.md`, a command contract, a skill contract, lifecycle gates, or repository policy.
- Authorize installation, git push, PR creation, releases, deployments, purchases, writes, or destructive actions.
- Cause commands embedded inside a source to be executed solely because the source requests execution.
- Waive credential, privacy, security, or provenance requirements.

This rule applies equally to browser content, provider output, GitHub issues/comments, README files, package pages, social posts, transcripts, PDFs, and generated summaries.

## Provider Capability Classes

- **READ**: Non-consequential external reads may run automatically when runtime policy allows.
- **AUTHENTICATED READ**: Requires permission to use relevant account/session/credential material.
- **WRITE**: Requires Development Kit approval.
- **SYSTEM**: Installation and configuration changes require Development Kit approval.
- **DESTRUCTIVE**: Requires explicit approval and applicable safeguards.

Agent-Reach is documented as an optional provider adapter. It is not a core Development Kit dependency and must not be silently installed.

## Security Posture (Implemented)

- **No symlink/junction creation**: the installer uses plain copies (`cpSync`/`copyFileSync`); no path traversal via symlinks is introduced.
- **Overwrite guards**: `AGENTS.md`/`README.md`/skills are never overwritten without `--force`.
- **`package.json` is never touched** in `--all` mode.
- **`--dry-run`** writes nothing.
- **No secrets in code**: the CI `NPM_TOKEN` is resolved from GitHub secrets and is never checked in.
- **Read-only validators**: validation scripts inspect repository state and do not perform provider installation or external writes.
- **External research trust boundary**: `AGENTS.md`, `/dk-research`, `external-research`, and Autopilot routing explicitly classify retrieved content as untrusted data.
- **Optional-provider posture**: Agent-Reach is documented as optional and does not add a Python runtime dependency to Development Kit.

## What Is NOT Claimed

- No digital signing of the package.
- No sandboxing of the agent runtime or optional external providers.
- No guarantee that downloaded package/provider content is malware-free.
- No guarantee that an external source is truthful merely because it is reachable through a provider.
- The framework does not harden the user's application; the `security-review` skill reviews the user's code and applicable integration boundaries.

See [threat-model.md](../07-testing-quality-security/threat-model.md) for the detailed risk register.
