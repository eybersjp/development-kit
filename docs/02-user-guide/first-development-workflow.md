# First Development Workflow

This page walks a new user through a complete first workflow with Development Kit, from a rough idea to a finished, reviewed change.

## Prerequisites

- Development Kit installed (see [getting-started.md](getting-started.md))
- A project directory (new or existing)

## The Full Sequence

### 1. Understand — `/dk-idea`

Start with your rough idea:

```bash
/dk-idea
```

The conductor runs idea discovery, interviews you **one question at a time** with numbered options, challenges assumptions, and produces an idea brief.

> **Your role**: answer each question (reply with the option number or describe your own answer). Do not skip ahead to implementation.

### 2. Define — `/dk-spec`

Once the concept is approved:

```bash
/dk-spec
```

The artifact selector picks the minimum documents for your change, and the specification agent writes a testable specification with explicit exclusions.

### 3. Design — `/dk-design`

```bash
/dk-design
```

The solution architect produces the smallest compatible design, reusing existing code wherever possible.

### 4. Plan — `/dk-tasks`

```bash
/dk-tasks
```

The task planner breaks the work into small, verifiable tasks ordered by dependency and risk.

### 5. Implement & Verify — `/dk-build`

```bash
/dk-build
```

One task at a time: a fresh implementation agent implements it, tests are written first, and the full gate sequence runs (spec review → code quality review → simplicity review → re-test).

Repeat `/dk-build` until all tasks are done — or use `/dk-build-auto` to process the whole plan automatically (it pauses on failures).

### 6. Test — `/dk-test`

```bash
/dk-test
```

Runs task-specific verification: browser runtime checks, regression testing, and edge case testing.

### 7. Review — `/dk-review`

```bash
/dk-review
```

Runs the full review cycle: specification compliance, code quality, and conditional security / accessibility / design reviews.

### 8. Simplify — `/dk-simplify`

```bash
/dk-simplify
```

Applies the Ponytail ladder — removes code, abstractions, and dependencies that are not needed (never tests, security, or validation).

### 9. Ship — `/dk-ship`

```bash
/dk-ship
```

Final verification: task completion gate, branch completion, and release readiness assessment.

### Status — anytime

```bash
/dk-status
```

Shows the active lifecycle stage, current task, completed tasks, and blocked items.

## What You Should See

- A spec file (e.g. `spec/feature.md`), design and task plan artefacts in your repo
- Tests written before implementation code
- Review verdicts after each gate
- A final completion report

## Common First-Time Mistakes

- **Skipping stages** — `/dk-build` before `/dk-spec` will be rejected; the lifecycle is enforced.
- **Answering vaguely** — concrete answers produce better specs.
- **Ignoring failures** — a failing gate stops the workflow deliberately; fix and re-run rather than bypassing.

## Next Steps

- [choosing-the-correct-command.md](choosing-the-correct-command.md) — which command for which situation
- [command-workflow-recipes.md](command-workflow-recipes.md) — real workflow combinations
- [troubleshooting.md](troubleshooting.md) — when things go wrong
