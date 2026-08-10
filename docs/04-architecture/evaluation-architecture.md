# Evaluation Architecture

## Purpose

Evaluations measure whether agents applying the skills produce the **expected behaviour** — distinct from structural validation (which only checks file shapes).

## Structure

```text
evals/
├── <skill-name>/              # 11 suites
│   └── scenario-<nn>-<topic>.json
```

Each scenario JSON declares:

| Field | Meaning |
| :--- | :--- |
| `skill` | The skill under evaluation |
| `scenario` | Human description of the case |
| `input` / `implementation` | The case presented to the agent |
| `expected` | Behavioural expectations (`must`, `must_not`, `verdict_contains`, minimums) |

## Execution Model

```mermaid
flowchart TD
    A["load scenario JSON"] --> B["run agent applying the skill"]
    B --> C["compare output vs expected"]
    C --> D{"expectations met?"}
    D -->|yes| E["pass"]
    D -->|no| F["fail: inspect which expectation was missed"]
```

`scripts/validate-evals.mjs` provides automated structural validation: it parses every scenario JSON file and requires the top-level `skill`, `scenario`, and `expected` keys. It runs through `npm run evals:validate`, which is included in `npm run autopilot:validate` and `npm run release:validate`.

There is no automated live-agent evaluation runner. Scenarios are executed manually or semi-automatically against a live agent/model, then scored against their behavioural expectations. See [evaluation-strategy.md](../07-testing-quality-security/evaluation-strategy.md).

## Coverage

11 suites with 25 scenarios. Ten skill suites contain one scenario each; `autopilot-lifecycle` contains 15 scenarios. Evaluated suites: acceptance-criteria-writing, autopilot-lifecycle, code-quality-review, dependency-restraint, idea-discovery, scope-definition, simplicity-review, specification-compliance-review, subagent-driven-implementation, task-decomposition, test-driven-development.

## Relationship to Validation

- `npm run validate` validates skills and repository structure.
- `npm run evals:validate` validates evaluation JSON structure and required top-level keys.
- Live-agent evaluation measures behaviour (does the agent produce the right output?).
- Both are required for confidence; neither replaces the other.

See [evaluation-internals.md](../06-internals/evaluation-internals.md) and [adding-an-evaluation.md](../05-developer-guide/adding-an-evaluation.md).
