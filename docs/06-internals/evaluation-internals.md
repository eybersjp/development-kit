# Evaluation Internals

## Model

Evaluations are **behavioural test cases** stored as JSON scenarios under `evals/<skill-name>/`. Each scenario describes an input and the expected agent behaviour.

## Scenario Structure

```json
{
  "skill": "the skill under test",
  "scenario": "description",
  "input": { ... },            // or "implementation": { ... }
  "expected": {
    "should_identify": [...],  // things the agent must find
    "should_pass": [...],
    "should_fail": [...],
    "must_not": [...],         // things the agent must not do
    "verdict_contains": "...", // expected verdict substring
    "min_...": n               // minimum counts
  }
}
```

## Expected-Behaviour Patterns

| Pattern | Meaning | Example |
| :--- | :--- | :--- |
| `verdict_contains` | Verdict string must include the token | `"FAIL"`, `"SIMPLIFICATIONS_RECOMMENDED"` |
| `must_not` | Prohibited behaviours | "approve without changes", "remove validation" |
| `should_identify` | Findings that must be surfaced | code-review issues list |
| Minimums | Lower bounds | `task_count_min: 3`, `minimum_sub_agents: 3` |

## Execution

The repository automates structural scenario validation with `scripts/validate-evals.mjs`. The validator parses every scenario JSON file and requires the top-level `skill`, `scenario`, and `expected` keys. It runs through `npm run evals:validate`, is included in `npm run autopilot:validate`, and therefore runs as part of `npm run release:validate`.

There is no automated live-agent evaluation runner. Behavioural execution remains manual or semi-automated: an evaluator presents the scenario input to an agent applying the skill and scores the output against `expected`.

## Scoring Semantics

Pass = every positive expectation met AND no `must_not` violated. Any `must_not` violation fails the scenario regardless of positives (e.g. removing a protected item).

## Adding a Scenario

1. Create `evals/<skill>/scenario-0N-<topic>.json` per the contract.
2. Update `docs/03-reference/evaluations/<skill>.md`.
3. Run `npm run evals:validate` to validate JSON parsing and required top-level keys.
4. Execute the scenario against a live agent and score its behaviour manually or semi-automatically.

## Coverage

11 suites with 25 scenarios. Ten skill suites contain one scenario each, while `autopilot-lifecycle` contains 15 lifecycle scenarios. Not all 45 skills are evaluated — the evaluated set covers the most behaviour-heavy lifecycle stages. See [evaluation-strategy.md](../07-testing-quality-security/evaluation-strategy.md).
