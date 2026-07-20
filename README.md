# Development Kit

> An opinionated AI software-development methodology and skill collection for Antigravity.

Installable senior-engineering discipline. Not a project management tool — a disciplined development team that lives inside your AI agent.

## Philosophy

Development Kit merges three proven approaches:

- **Superpowers' workflow discipline** — brainstorm, design, plan, fresh sub-agents, TDD, two-stage review
- **Agent Skills' lifecycle library** — production engineering skills, specialist personas, verification gates
- **Ponytail's aggressive simplicity** — reuse existing code, prefer native capabilities, write minimal code

The result: an AI development methodology that produces correct, simple, well-tested code without overengineering.

## Quick Start

```bash
# Install in your Antigravity project
npx development-kit init

# Or install globally
npx development-kit init --global

# Or install project-local
npx development-kit init --project

# Or copy everything to project root for standalone use
npx development-kit init --all

# Preview what --all would do without copying
npx development-kit init --all --dry-run
```

### Installer Flags

| Flag | Behavior |
|------|----------|
| *(none)* | Auto-detect Antigravity and install the plugin |
| `--global` | Install plugin to global Antigravity config (`~/.gemini/config/`) |
| `--project` | Install plugin to project-local `.agents/` |
| `--all` | **Standalone mode** — copy all 7 directories (agents, skills, commands, hooks, templates, evals, scripts), root files (AGENTS.md, README.md), and the plugin manifest to the project root |
| `--all --dry-run` | Preview what `--all` would copy without writing any files |
| `--force` | Override safety guards — overwrite existing `AGENTS.md` and `README.md` even if they already exist |

**Preserving customizations:** The installer never overwrites an existing `AGENTS.md` at the target. If you reinstall, your rules are preserved. Root files (`AGENTS.md`, `README.md`) in `--all` mode follow the same guard — existing files are skipped, only new ones are installed. Library content (skills, agents, commands, hooks, templates, evals, scripts) is updated unconditionally on re-run.

## Commands

| Command | Purpose |
|---------|---------|
| `/idea` | Refine a rough idea into a concrete concept with requirements interview, idea challenge, and scope definition |
| `/spec` | Create the minimum required specification artifacts for the approved concept |
| `/design` | Produce technical and visual design including data models, API contracts, user flows, and design direction |
| `/tasks` | Break approved work into small, verifiable tasks with subtask decomposition and dependency ordering |
| `/build` | Implement the next task through every verification gate using fresh sub-agents and TDD |
| `/build-auto` | Process the entire approved task plan automatically, pausing on failures |
| `/test` | Run task-specific verification with browser runtime checks, regression testing, and edge case testing |
| `/review` | Run the full review cycle: specification compliance, code quality, security, accessibility, and design quality |
| `/simplify` | Apply the Ponytail simplicity ladder to remove unnecessary code, abstractions, and dependencies |
| `/debug` | Systematic root-cause analysis: reproduce, localise, identify root cause, fix, protect |
| `/ship` | Final verification and release preparation: task completion gate, branch completion, release readiness assessment |
| `/status` | Show the current workflow state: active lifecycle stage, current task, completed tasks, and blocked items |

## The Development Lifecycle

```
UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE
```

Each stage activates one or more skills. The **development-conductor** agent coordinates the entire workflow.

### Stage 1: Understand
Inspect the repository. Understand the architecture. Identify the actual user need. Ask focused questions. Determine whether the requested feature needs to exist.

### Stage 2: Define
Create a concise specification defining problem, users, behaviour, scope, exclusions, acceptance criteria, constraints, and risks.

### Stage 3: Design
Determine the smallest appropriate design. Reuse existing architecture, components, utilities, and dependencies.

### Stage 4: Plan
Break implementation into small, independently verifiable tasks.

### Stage 5: Implement
A fresh sub-agent implements one task at a time.

### Stage 6: Verify
Tests and runtime checks prove the task works.

### Stage 7: Review
Specification compliance review first, then code quality review.

### Stage 8: Simplify
Check whether any code, abstraction, dependency, or file can be removed.

### Stage 9: Complete
Only after all gates pass may the next task begin.

## The Mandatory Task Loop

```
1. Conductor selects next task
2. Repository scout gathers task context
3. Task-readiness agent validates task
4. Fresh implementation sub-agent starts
5. Test is written first where behaviour changes
6. Minimal implementation is produced
7. Local tests are run
8. Spec reviewer checks compliance
9. Code reviewer checks quality
10. Test engineer performs bug and regression testing
11. Simplicity reviewer removes overengineering
12. Tests run again
13. Task is committed
14. Only then does the next task begin
```

**Critical rule:** A task is not complete because the implementation agent says it is complete.

## Always-On Rules

1. Inspect before editing.
2. Clarify before assuming.
3. Specify before implementing non-trivial work.
4. Reuse before creating.
5. Prefer native capability before adding dependencies.
6. Break work into small, testable tasks.
7. Use a fresh sub-agent for each implementation task.
8. Write or identify verification before implementation.
9. Review specification compliance before code style.
10. Test before declaring completion.
11. Simplify after correctness.
12. Do not start the next task while the current task has unresolved failures.

## Repository Structure

```
development-kit/
├── .agents/plugins/development-kit/   # Plugin manifest
├── agents/                             # Agent personas
├── skills/                             # Lifecycle skills
├── commands/                           # Slash commands
├── hooks/                              # Lifecycle hooks
├── templates/                          # Reusable templates
├── evals/                              # Skill evaluations
└── scripts/                            # CLI and utilities
```

## Agent Personas

| Agent | Role |
|-------|------|
| **development-conductor** | Coordinates the entire workflow |
| **repository-scout-agent** | Inspects codebase, finds reusable code |
| **product-discovery-agent** | Clarifies ideas and requirements |
| **specification-agent** | Writes concise specifications |
| **artifact-selector-agent** | Chooses minimum required documents |
| **solution-architect-agent** | Designs smallest compatible solution |
| **task-planner-agent** | Breaks work into small tasks |
| **implementation-agent** | Fresh sub-agent per task implementation |
| **test-engineer** | Writes and runs verification |
| **spec-reviewer** | Checks specification compliance |
| **code-reviewer** | Assesses code quality |
| **security-reviewer** | Security-focused review |
| **simplicity-reviewer** | Ponytail-style simplicity inspection |
| **accessibility-reviewer** | Accessibility audit and WCAG compliance review |
| **design-reviewer** | Visual design quality review |
| **frontend-implementer** | Frontend implementation specialist |
| **backend-implementer** | Backend implementation specialist |
| **database-implementer** | Database implementation specialist |

## Full Skill Library

The Development Kit ships with 43 skills covering the complete software-development lifecycle from idea discovery through release readiness.

### A. Meta Skills
| Skill | Purpose |
|-------|---------|
| **using-development-kit** | How to use this methodology, loaded at session start |
| **skill-routing** | Maps user intent to the appropriate skill or workflow |
| **repository-orientation** | Inspects unfamiliar repos before changes begin |
| **context-packing** | Gathers only relevant context for sub-agents |

### B. Idea & Definition Skills
| Skill | Purpose |
|-------|---------|
| **idea-discovery** | Turn rough ideas into concrete concepts |
| **requirements-interview** | Focused questions to surface requirements |
| **idea-challenge** | Tests whether the solution solves the real problem |
| **scope-definition** | Defines must-have/should-have/could-have/excluded |
| **acceptance-criteria-writing** | Converts requirements into testable conditions |

### C. Artifact Skills
| Skill | Purpose |
|-------|---------|
| **adaptive-artifact-planning** | Selects minimum required documents |
| **feature-specification** | Writes concise feature specs |
| **technical-design** | Creates implementation-oriented design docs |
| **data-model-design** | Designs schemas and migrations |
| **api-contract-design** | Designs API contracts and module boundaries |
| **user-flow-design** | Designs user-facing workflows |
| **design-direction** | Premium UI direction and visual language |
| **test-strategy** | Defines how features are proven correct |

### D. Planning Skills
| Skill | Purpose |
|-------|---------|
| **task-decomposition** | Breaks work into small, verifiable tasks |
| **subtask-decomposition** | Breaks tasks into atomic ordered steps |
| **dependency-ordering** | Determines correct execution order |
| **task-readiness-check** | Verifies tasks are clear enough to implement |
| **risk-first-planning** | Prioritises risky work before cosmetic work |

### E. Implementation Skills
| Skill | Purpose |
|-------|---------|
| **subagent-driven-implementation** | Dispatches fresh sub-agents per task |
| **incremental-implementation** | Implements one thin vertical slice at a time |
| **test-driven-development** | Red-green-refactor discipline |
| **existing-code-first** | Searches for reusable code before writing new code |
| **native-platform-first** | Prefers built-in capabilities over packages |
| **dependency-restraint** | Justifies every new dependency |
| **minimal-diff** | Keeps changes tightly scoped to the task |

### F. Verification Skills
| Skill | Purpose |
|-------|---------|
| **verification-before-completion** | Proves it works before claiming done |
| **systematic-debugging** | Reproduce → Locate → Fix → Protect |
| **browser-runtime-verification** | Checks console, network, DOM, responsive, a11y |
| **regression-testing** | Ensures existing behaviour remains intact |
| **edge-case-testing** | Actively searches for failure scenarios |

### G. Review Skills
| Skill | Purpose |
|-------|---------|
| **specification-compliance-review** | Did we build the right thing? |
| **code-quality-review** | Did we build it well? |
| **security-review** | Vulnerability assessment for sensitive work |
| **accessibility-review** | WCAG compliance for UI work |
| **design-quality-review** | Prevents generic AI-generated visual language |
| **simplicity-review** | Can we remove anything? |

### H. Completion Skills
| Skill | Purpose |
|-------|---------|
| **task-completion-gate** | Every task passes all gates before completion |
| **branch-completion** | Final test suite, diff inspection, commit prep |
| **release-readiness** | Broader pre-release check (security, perf, docs) |

## License

MIT
