# FAQ

## General

**What is Development Kit?**
An opinionated AI software-development methodology and skill collection for Antigravity and OpenCode. It installs senior-engineering discipline into agent workflows: discovery, minimal artifacts, task planning, fresh sub-agent implementation, verification, review, and simplification. See [what-is-development-kit.md](../01-overview/what-is-development-kit.md).

**Is it a project-management tool?**
No. It is a disciplined development process that runs inside your AI agent.

**Which environments are supported?**
Antigravity (global, project, or standalone install) and OpenCode (skills installed to `.opencode/skills/`). Requires Node.js `>=18`.

## Installation

**Will it overwrite my files?**
`AGENTS.md` and `README.md` at the target are **never** overwritten without `--force`. Library content (skills, agents, commands, hooks, templates, evals, scripts) is updated unconditionally on re-run. `package.json` is never touched in `--all` mode.

**What does `--all` do?**
Copies all 7 component directories plus root files and the plugin manifest to the project root for standalone use. Preview with `--all --dry-run`.

**How do I install for OpenCode?**
`npx development-kit init --opencode` installs the 43 skills to `.opencode/skills/` plus `opencode.json` and `AGENTS.md`.

**How do I uninstall?**
See [uninstalling.md](uninstalling.md). Remove the installed directories/files per your install mode.

## Workflow

**Why does the workflow refuse to implement my feature directly?**
The lifecycle is enforced: UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE. Implementation before definition is prevented deliberately.

**Why a fresh sub-agent per task?**
Fresh sub-agents prevent assumption drift — a long-running agent accumulates assumptions from earlier work. Each task gets a clean, self-contained context package.

**Why is spec review before code review?**
Correctness first, style second. If the wrong thing was built, code quality does not matter.

**Why so many reviews?**
The review cycle (spec compliance, code quality, conditional security/accessibility/design, simplicity) is the quality engine. Each gate is fast and specific.

**What is the Ponytail ladder?**
The simplicity model: does this need to exist? Is it already present? Can project code, the standard library, the native platform, or an installed dependency do it? Only then create a new abstraction. The never-remove list protects tests, validation, security, accessibility, error handling, and data integrity.

## Bugs & Failures

**My task is blocked. What do I do?**
Run `/dk-status` to see the blocker, then `/dk-debug` for root-cause analysis, or revise the spec if the task is mis-specified.

**A test fails after simplification.**
Restore the removed item — the simplicity reviewer must never remove tests, validation, or security protections. Re-run the suite.

## Compatibility

**Does it work with OpenCode?**
Yes. All 43 skills declare `compatibility: opencode` and OpenCode auto-discovers them from `.opencode/skills/`.

**Which Node versions?**
`>=18.0.0` per `package.json`; CI validates on Node 22.
