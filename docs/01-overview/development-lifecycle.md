# Development Lifecycle

The Development Kit coordinates software development across 9 ordered lifecycle stages managed by the `development-conductor` agent:

```text
UNDERSTAND → DEFINE → DESIGN → PLAN → IMPLEMENT → VERIFY → REVIEW → SIMPLIFY → COMPLETE
```

## Stage Descriptions

1. **UNDERSTAND** (`/dk-idea`): Refines raw requests into clear concepts using interactive interviews and scope boundaries.
2. **DEFINE** (`/dk-spec`): Generates minimum required specifications, acceptance criteria, and explicit exclusions.
3. **DESIGN** (`/dk-design` / `/dk-design-system`): Establishes data models, API contracts, user flows, visual direction, and the authoritative `design.md` frontend design system.
4. **PLAN** (`/dk-tasks`): Decomposes work into risk-ordered, independently testable tasks.
5. **IMPLEMENT** (`/dk-build` / `/dk-build-auto`): Executes tasks using isolated sub-agents and Test-Driven Development (TDD).
6. **VERIFY** (`/dk-test`): Runs unit tests, regression tests, edge-case tests, and browser runtime checks.
7. **REVIEW** (`/dk-review`): Conducts 2-stage reviews (Spec compliance first, Code quality second) plus specialist reviews.
8. **SIMPLIFY** (`/dk-simplify`): Applies the Ponytail Simplicity Ladder to eliminate bloat while preserving safety.
9. **COMPLETE** (`/dk-ship`): Runs final release readiness gates, branch verification, and release preparation.
