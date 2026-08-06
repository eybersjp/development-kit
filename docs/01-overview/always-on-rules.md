# Always-On Rules

Whenever Development Kit is installed into a project, `AGENTS.md` is loaded at session start and applies to all agent activities in the repository.

```markdown
1. Inspect before editing. Read the relevant code and understand the architecture before making changes.
2. Clarify before assuming. When requirements are ambiguous, ask focused questions rather than guessing.
3. Specify before implementing non-trivial work. Non-trivial changes require a specification before implementation begins.
4. Reuse before creating. Search the existing codebase for reusable code, components, utilities, and patterns before writing new code.
5. Prefer native capability before adding dependencies. Browser, runtime, framework, and language-native capabilities take priority over external packages.
6. Break work into small, testable tasks. Each task should be independently verifiable and scoped to a single concern.
7. Use a fresh sub-agent for each implementation task. Do not reuse a long-running agent for multiple implementation tasks. Fresh sub-agents prevent assumption drift.
8. Write or identify verification before implementation. Test cases or acceptance criteria must exist before implementation begins.
9. Review specification compliance before code style. First verify that the implementation satisfies the specification. Code quality review comes second.
10. Test before declaring completion. Run the verification suite and confirm all tests pass before marking a task complete.
11. Simplify after correctness. Once the implementation is correct and tested, review for unnecessary complexity, abstractions, and dependencies.
12. Do not start the next task while the current task has unresolved failures. The task loop is sequential and gated.
```

These rules cannot be bypassed by sub-agents or automated task runners.
