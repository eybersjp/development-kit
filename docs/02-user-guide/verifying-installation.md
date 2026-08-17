# Verifying Installation

Use the checks below after installing Development Kit v0.8.0.

## Verify the published package

```bash
npm view development-kit version
```

Expected current version:

```text
0.8.0
```

## Verify framework integrity

From a Development Kit source checkout, run:

```bash
npm run release:validate
```

This includes:

1. Framework component validation.
2. Plugin synchronization verification.
3. Documentation validation and regression tests.
4. OpenCode configuration regression tests.
5. Platform adapter template and CLI validation tests.
6. Research trust boundary contract tests.
7. Next-step guidance unit and CLI validation tests.
8. Standalone installer and distribution tests.
9. Autopilot unit tests.
10. Lifecycle evaluation validation.

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

Confirm that the installed plugin manifest references the expected 46 skills, 18 agents, and 4 hooks and that the plugin is reported as synchronized.

## Verify Autopilot

From the source repository:

```bash
npm run autopilot:validate
```

Then start the workflow in a safe test project with:

```text
/dk-autopilot
```

Confirm that it reports a valid lifecycle state and stops at required approval gates.

## Failure handling

Do not ignore a failed gate. Follow [Troubleshooting](troubleshooting.md), repair the named issue, and rerun the same command before proceeding.
