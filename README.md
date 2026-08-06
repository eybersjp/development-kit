<div align="center">

# Development Kit

### A disciplined AI software-development team, installed into your coding agent.

[![CI](https://github.com/eybersjp/development-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/eybersjp/development-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/eybersjp/development-kit?display_name=tag&sort=semver)](https://github.com/eybersjp/development-kit/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](package.json)

**Plan deliberately. Build in small verified steps. Review against the specification. Simplify before shipping.**

[Get started](#quick-start) · [Automated workflow](#automated-guided-workflow) · [Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md) · [Releases](https://github.com/eybersjp/development-kit/releases)

</div>

---

## Why Development Kit?

AI coding agents are fast, but speed without engineering discipline creates rework: unclear requirements, oversized diffs, unverified claims, fragile abstractions, and skipped reviews.

Development Kit installs a repeatable senior-engineering workflow into supported AI coding environments. It gives the agent explicit lifecycle stages, specialist roles, verification gates, reusable skills, and a persistent automated workflow that can pause, resume, recover, and ask for approval before consequential actions.

It is **not** a project-management dashboard and it does not replace engineering judgment. It is an execution discipline for turning an idea or change request into tested, reviewed, release-ready work.

## What you get

| Capability | What it provides |
|---|---|
| **Automated Guided Workflow** | `/dk-autopilot` coordinates the complete lifecycle and persists progress between sessions. |
| **13 workflow commands** | Discovery, specification, design, planning, implementation, testing, review, debugging, simplification, status, and shipping. |
| **18 specialist agents** | Focused personas for discovery, architecture, implementation, testing, security, accessibility, design, and review. |
| **43 engineering skills** | Reusable instructions covering the full software-development lifecycle. |
| **Verification-first execution** | Tests, runtime checks, specification review, quality review, and simplification gates before completion. |
| **Safety controls** | Human approval gates for remote, destructive, security-sensitive, deployment, and release operations. |
| **Antigravity and OpenCode support** | Plugin installation for Antigravity and auto-discoverable skill installation for OpenCode. |

## Automated Guided Workflow

```text
UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT
     → VERIFY → REVIEW → SIMPLIFY → COMPLETE
```

Start with:

```text
/dk-autopilot
```

Development Kit selects the next lifecycle action, routes the appropriate command, agent, and skills, records progress, and stops when it needs a decision or approval.

The recommended entry experience is intentionally explicit:

```text
╔══════════════════════════════════════════════════════════════╗
║  🚀 AUTOMATED GUIDED WORKFLOW — RECOMMENDED                 ║
║                                                              ║
║  Take me through the complete Development Kit lifecycle.     ║
║  Select the correct commands, agents, and skills, and pause  ║
║  for important decisions and approval gates.                 ║
╚══════════════════════════════════════════════════════════════╝
```

Manual commands remain available at every stage.

## Quick start

### Antigravity

```bash
# Automatic environment detection
npx development-kit init

# Install project-locally
npx development-kit init --project

# Preview a standalone installation
npx development-kit init --all --dry-run
```

### OpenCode

```bash
# Install AGENTS.md, opencode.json, and all compatible skills
npx development-kit init --opencode

# Preview first
npx development-kit init --opencode --dry-run
```

### Available installer modes

| Flag | Purpose |
|---|---|
| *(none)* | Detect Antigravity and install the plugin. |
| `--global` | Install to the global Antigravity configuration. |
| `--project` | Install to the current project's `.agents/` directory. |
| `--all` | Copy the complete standalone framework into the project. |
| `--opencode` | Install the OpenCode-compatible rules and skill library. |
| `--dry-run` | Preview changes without writing files. |
| `--force` | Explicitly allow replacement where safety guards normally preserve user files. |

The installer preserves an existing `AGENTS.md` by default.

## Core commands

| Command | Outcome |
|---|---|
| `/dk-autopilot` | Run the complete lifecycle through the automated guided workflow. |
| `/dk-idea` | Turn a rough idea into a clear, challenged, scoped concept. |
| `/dk-spec` | Produce the minimum sufficient specification and acceptance criteria. |
| `/dk-design` | Define the smallest compatible technical and user-experience design. |
| `/dk-tasks` | Create ordered, independently verifiable implementation tasks. |
| `/dk-build` | Implement the next task through the required verification gates. |
| `/dk-build-auto` | Process an approved task plan automatically, stopping on failures. |
| `/dk-test` | Run targeted functional, regression, runtime, and edge-case verification. |
| `/dk-review` | Review specification compliance, code quality, security, accessibility, and design. |
| `/dk-debug` | Reproduce, localise, identify root cause, fix, and protect. |
| `/dk-simplify` | Remove unnecessary code, files, abstractions, and dependencies. |
| `/dk-ship` | Perform final release-readiness and branch-completion checks. |
| `/dk-status` | Inspect the current lifecycle stage, task, blockers, and recommended action. |

## How the discipline works

Every non-trivial change follows the same principles:

1. **Inspect before editing.** Understand the repository and reuse what already exists.
2. **Clarify before assuming.** Make material product decisions explicit.
3. **Specify before implementing.** Define observable acceptance criteria.
4. **Work in small slices.** Keep tasks and diffs independently verifiable.
5. **Prove behaviour.** Test before claiming completion.
6. **Review the right thing first.** Specification compliance precedes style opinions.
7. **Simplify after correctness.** Remove unnecessary complexity before shipping.
8. **Stop on unresolved failure.** Do not advance the lifecycle by hiding broken gates.

## Supported environments

| Environment | Integration |
|---|---|
| **Antigravity** | Plugin, agents, commands, hooks, skills, templates, evaluations, and runtime utilities. |
| **OpenCode** | `AGENTS.md`, `opencode.json`, and 43 progressively loaded compatible skills. |
| **Standalone repositories** | Full framework copy through `--all`. |

## Quality and safety

Development Kit includes:

- Persistent, versioned Autopilot state with transaction locking.
- Replay-resistant approval and cancellation tokens.
- Artifact fingerprints and downstream staleness invalidation.
- Mandatory approval gates for Git pushes, pull requests, merges, releases, production deployments, package publication, destructive changes, and security-risk acceptance.
- Unit tests, behavioural evaluation scenarios, documentation validation, and plugin-manifest synchronization.

Run the complete local verification suite:

```bash
npm run validate
npm run doctor
npm run docs:validate
npm run docs:validate:test
npm run autopilot:validate
```

## Documentation

- [Documentation home](docs/README.md)
- [Full table of contents](docs/SUMMARY.md)
- [Command reference](docs/03-reference/commands/README.md)
- [Agent reference](docs/03-reference/agents/README.md)
- [Skill reference](docs/03-reference/skills/README.md)
- [Architecture](docs/04-architecture/system-context.md)
- [Automated Guided Workflow](docs/02-user-guide/automated-guided-workflow.md)
- [Changelog](CHANGELOG.md)

## Project status

Development Kit is actively developed. The current release includes the production Autopilot foundation and complete framework documentation. Public feedback, integration reports, focused improvements, and well-scoped contributions are welcome.

See [SUPPORT.md](SUPPORT.md) for help, [SECURITY.md](SECURITY.md) for vulnerability reporting, and [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes.

## License

Development Kit is available under the [MIT License](LICENSE).
