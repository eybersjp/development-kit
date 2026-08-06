# Philosophy & Engineering Principles

Development Kit operates under 12 mandatory, non-negotiable engineering rules embedded directly into agent prompts (`AGENTS.md`):

1. **Inspect before editing**: Understand architecture and existing code before modifying.
2. **Clarify before assuming**: Ask focused questions when requirements are ambiguous.
3. **Specify before implementing non-trivial work**: Create specifications before code.
4. **Reuse before creating**: Search codebase for existing patterns and utilities.
5. **Prefer native capability**: Prioritize standard library and platform features over new dependencies.
6. **Break work into small, testable tasks**: Scope each task to an independently verifiable concern.
7. **Use a fresh sub-agent for each task**: Prevent context bloat and assumption drift.
8. **Write or identify verification before implementation**: Establish acceptance criteria first.
9. **Review specification compliance before code style**: Confirm feature requirements pass first.
10. **Test before declaring completion**: Gather empirical proof of passing tests.
11. **Simplify after correctness**: Apply the Ponytail Simplicity Ladder to remove bloat.
12. **Do not start next task with unresolved failures**: The pipeline is gated and sequential.

---

## The Ponytail Simplicity Ladder

Before creating new abstractions or dependencies, traverse this 8-rung ladder:

1. Does this need to exist? (YAGNI)
2. Is the required behaviour already present?
3. Can existing project code be reused?
4. Can the standard library do it?
5. Can the native platform do it?
6. Can an installed dependency do it?
7. Can a small local change do it?
8. Only then create a new abstraction.

> [!IMPORTANT]
> The simplicity review must **never** remove security protections, input validation, error handling, accessibility features, data integrity protections, or tests.
