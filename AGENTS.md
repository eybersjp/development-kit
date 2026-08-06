# Development Kit — Agent Rules

These rules are loaded at session start and apply to all work in this repository.

## Always-On Rules

1. **Inspect before editing.** Read the relevant code and understand the architecture before making changes.

2. **Clarify before assuming.** When requirements are ambiguous, ask focused questions rather than guessing.

3. **Specify before implementing non-trivial work.** Non-trivial changes require a specification before implementation begins.

4. **Reuse before creating.** Search the existing codebase for reusable code, components, utilities, and patterns before writing new code.

5. **Prefer native capability before adding dependencies.** Browser, runtime, framework, and language-native capabilities take priority over external packages.

6. **Break work into small, testable tasks.** Each task should be independently verifiable and scoped to a single concern.

7. **Use a fresh sub-agent for each implementation task.** Do not reuse a long-running agent for multiple implementation tasks. Fresh sub-agents prevent assumption drift.

8. **Write or identify verification before implementation.** Test cases or acceptance criteria must exist before implementation begins.

9. **Review specification compliance before code style.** First verify that the implementation satisfies the specification. Code quality review comes second.

10. **Test before declaring completion.** Run the verification suite and confirm all tests pass before marking a task complete.

11. **Simplify after correctness.** Once the implementation is correct and tested, review for unnecessary complexity, abstractions, and dependencies.

12. **Do not start the next task while the current task has unresolved failures.** The task loop is sequential and gated.

## Workflow

The **development-conductor** agent coordinates the following lifecycle:

```
UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE
```

Do not skip stages. Do not implement before defining. Do not claim completion before all gates pass.

## The Ponytail Simplicity Ladder

Before writing new code, traverse this ladder:

1. Does this need to exist?
2. Is the required behaviour already present?
3. Can existing project code be reused?
4. Can the standard library do it?
5. Can the native platform do it?
6. Can an installed dependency do it?
7. Can a small local change do it?
8. Only then create a new abstraction.

## Ponytail Exclusions (Never Remove)

The simplicity review must never recommend removing:
- Security protections
- Input validation
- Error handling
- Accessibility
- Data integrity protections
- Tests

## Commands

The following commands are available. Each command activates a specific workflow bundle with primary and supporting skills from the Development Kit skill library.

- `/dk-autopilot` — Run the complete Development Kit software-development lifecycle in Automated Guided Workflow mode
- `/dk-idea` — Refine a rough idea into a concrete concept with requirements interview, idea challenge, and scope definition
- `/dk-spec` — Create the minimum required specification artifacts for the approved concept
- `/dk-design` — Produce technical and visual design including data models, API contracts, user flows, and design direction
- `/dk-tasks` — Break approved work into small, verifiable tasks with subtask decomposition and dependency ordering
- `/dk-build` — Implement the next task through every verification gate using fresh sub-agents and TDD
- `/dk-build-auto` — Process the entire approved task plan automatically, pausing on failures
- `/dk-test` — Run task-specific verification with browser runtime checks, regression testing, and edge case testing
- `/dk-review` — Run the full review cycle: specification compliance, code quality, security, accessibility, and design quality
- `/dk-simplify` — Apply the Ponytail simplicity ladder to remove unnecessary code, abstractions, and dependencies
- `/dk-debug` — Systematic root-cause analysis: reproduce, localise, identify root cause, fix, protect
- `/dk-ship` — Final verification and release preparation: task completion gate, branch completion, release readiness assessment
- `/dk-status` — Show the current workflow state: active lifecycle stage, current task, completed tasks, and blocked items

## Agents

The following specialist agents can be spawned:
**development-conductor** **repository-scout-agent** **product-discovery-agent** **specification-agent** **artifact-selector-agent** **solution-architect-agent** **task-planner-agent** **implementation-agent** **test-engineer** **spec-reviewer** **code-reviewer** **security-reviewer** **simplicity-reviewer** **accessibility-reviewer** **design-reviewer** **frontend-implementer** **backend-implementer** **database-implementer**
