# OpenCode Workflow

This example shows how Development Kit v0.4.2 operates inside OpenCode.

## Install

```bash
mkdir dk-example
cd dk-example
npx development-kit@0.4.2 init --opencode
```

The resulting integration is:

```text
dk-example/
├── .opencode/skills/
├── AGENTS.md
└── opencode.json
```

`opencode.json` contains:

```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

OpenCode automatically loads `AGENTS.md` from the project root. Development Kit skills are discovered progressively from `.opencode/skills/`.

## Start a workflow

Open the project in OpenCode and start with:

```text
/dk-autopilot
```

The conductor should:

1. Inspect the repository.
2. Identify the current lifecycle stage.
3. Select the appropriate command, agent, and skills.
4. Record state through the Autopilot runtime.
5. Stop at consequential approval gates.

Manual commands such as `/dk-idea`, `/dk-spec`, `/dk-build`, and `/dk-status` remain available.

## Configuration regression check

Do not use:

```json
{
  "rules": ["AGENTS.md"]
}
```

That v0.4.1 configuration is obsolete and current OpenCode versions reject it.

From a Development Kit source checkout, verify the canonical configuration with:

```bash
npm run opencode:validate
```

## Related documentation

- [OpenCode Integration](../04-architecture/opencode-integration.md)
- [Install OpenCode](../02-user-guide/install-opencode.md)
- [Automated Guided Workflow](../02-user-guide/automated-guided-workflow.md)
- [Migration Guide](../08-maintenance-release/migration-guide.md)
