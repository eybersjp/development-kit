# Evaluation Strategy

## Purpose

Evaluations measure whether an agent applying a skill produces the **expected behaviour**. They complement structural validation: structure says the files are right; evaluations say the agent behaves right.

## What Is Evaluated

10 suites, one per evaluated skill:

- acceptance-criteria-writing, code-quality-review, dependency-restraint, idea-discovery, scope-definition, simplicity-review, specification-compliance-review, subagent-driven-implementation, task-decomposition, test-driven-development

The set covers the most behaviour-heavy lifecycle stages (discovery, definition, planning, implementation, verification, review).

## How Evaluations Are Run

There is no automated runner in the repository. Procedure:

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

- 1 scenario per suite; no multi-domain coverage.
- No automated execution or CI wiring (see [known-limitations.md](../11-appendices/known-limitations.md)).
- Behaviour is model-dependent — results are indicative, not guarantees.

See [evaluation-architecture.md](../04-architecture/evaluation-architecture.md) and [evaluation-internals.md](../06-internals/evaluation-internals.md).
