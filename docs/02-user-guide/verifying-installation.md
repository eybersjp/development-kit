# Verifying Installation

Use the checks below after installing Development Kit v0.9.0.

## Verify the published package

```bash
npm view development-kit version
```

Expected current version:

```text
0.9.0
```

## Verify framework integrity

From a Development Kit source checkout, run:

```bash
npm run release:validate
```

This includes:

1. Framework component and Antigravity workflow-discovery validation.
2. Plugin synchronization and package/plugin/runtime version consistency.
3. Documentation validation and regression tests.
4. OpenCode configuration regression tests.
5. Platform adapter template and CLI validation tests.
6. Research trust boundary contract tests.
7. Next-step guidance unit and CLI validation tests.
8. Standalone installer and distribution tests.
9. Development Contract and source-fingerprint validation.
10. Execution-safety and blast-radius policy validation.
11. Evidence/control coverage and no-self-certification validation.
12. Core orchestration, command integration, acceptance, correction, drift, and canonical reconciliation validation.
13. Proposal Builder adversarial reliability regressions, including incomplete security coverage and inconsistent PLAN detection.
14. DK Intelligence and v0.7.1 regression validation.
15. DKF Design Authority validation.
16. Autopilot unit tests and lifecycle evaluations.

## Verify an OpenCode installation

Confirm the project contains:

```text
.opencode/skills/
opencode.json
AGENTS.md
```

The current `opencode.json` must be:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

It must not contain a `rules` key. OpenCode loads the root `AGENTS.md` automatically.

Open the project in OpenCode and confirm that:

- The project opens without a configuration warning.
- Development Kit skills are discoverable.
- `AGENTS.md` instructions are active.

## Verify an Antigravity installation

Run:

```bash
npm run doctor
```

Confirm that the plugin is synchronized and contains 47 engineering skills plus 16 Antigravity-native workflow-entry skills, 18 agents, and 4 hooks. The plugin manifest version must match `package.json`.

Then open Antigravity and type:

```text
/dk
```

Confirm that all 16 Development Kit workflows appear in slash discovery, including `/dk-design-system`.

For an existing project upgrade, verify that the project's pre-existing `AGENTS.md` remains unchanged unless `--force` was intentionally used.

## Verify the v0.9 reliability control plane

From the source repository:

```bash
npm run v09-reliability:validate
```

This must execute the Proposal Builder regression fixture, the fail-closed derived-gate tests, canonical amendment fingerprint tests, and version-consistency checks.

## Verify Autopilot

From the source repository:

```bash
npm run autopilot:validate
```

Then start the workflow in a safe test project with:

```text
/dk-autopilot
```

Confirm that it reports a valid lifecycle state, records framework version `0.9.0`, and stops at required approval/evidence gates.

## Failure handling

Do not ignore a failed gate. Follow [Troubleshooting](troubleshooting.md), repair the named issue, and rerun the same command before proceeding.
