# Evaluation Strategy

## Purpose

Evaluations measure whether an agent applying a skill produces the **expected behaviour**. They complement structural validation: structure says the files are right; evaluations say the agent behaves right.

## What Is Evaluated

11 suites:

- acceptance-criteria-writing, autopilot-lifecycle, code-quality-review, dependency-restraint, idea-discovery, scope-definition, simplicity-review, specification-compliance-review, subagent-driven-implementation, task-decomposition, test-driven-development

Ten skill suites contain one scenario each. `autopilot-lifecycle` contains 15 scenarios covering lifecycle transitions, approvals, task dispatch, verification, review, simplification, completion, recovery, cancellation, and related state controls. The set covers the most behaviour-heavy lifecycle stages (discovery, definition, planning, implementation, verification, review, and lifecycle orchestration).

## How Evaluations Are Run

Structural validation is automated. `npm run evals:validate` runs `scripts/validate-evals.mjs`, which parses every scenario JSON file and checks for the required `skill`, `scenario`, and `expected` keys. The command is included in `npm run autopilot:validate` and `npm run release:validate`.

There is no automated live-agent evaluation runner. Behavioural procedure:

1. Load the scenario JSON (`evals/<skill>/scenario-*.json`).
2. Present the `input`/`implementation` to an agent applying the skill.
3. Score the output against `expected` (positives met, `must_not` items absent, `verdict_contains` present, minimums satisfied).

## Scoring Rules

- **All positives met AND no `must_not` violated** → pass.
- Any `must_not` violation → fail regardless of positives.
- Minimums (task counts, sub-agents, criteria) are lower bounds.

## Interpreting Failures

| Pattern | Meaning |
| :--- | :--- |
| Missing `should_identify` item | Review coverage gap |
| Wrong verdict token | Severity/classification misjudgement |
| `must_not` violated | Critical behavioural error (e.g. removing protected items) |
| Below minimum count | Under-decomposition / under-coverage |

## Adding Coverage

Follow [adding-an-evaluation.md](../05-developer-guide/adding-an-evaluation.md). Prefer scenarios with concrete inputs and explicit `must_not` items.

## Limitations

- Ten suites have only one scenario and therefore limited domain coverage; `autopilot-lifecycle` has 15 scenarios.
- Structural scenario validation is automated, but live-agent execution and behavioural scoring are not.
- Behaviour is model-dependent — results are indicative, not guarantees.

See [evaluation-architecture.md](../04-architecture/evaluation-architecture.md) and [evaluation-internals.md](../06-internals/evaluation-internals.md).
