# Install Antigravity Project

Installing Development Kit into a specific project directory scopes the framework rules and plugins to that codebase.

## Command

```bash
node scripts/install-antigravity.mjs --project
```
Or via npx:
```bash
npx development-kit --project
```

## Destination Paths

* `./.agents/plugins/development-kit/`
* `./.agents/AGENTS.md`

## Installed Content

```text
./.agents/
├── AGENTS.md
└── plugins/
    └── development-kit/
        ├── plugin.json
        ├── skills/
        ├── agents/
        ├── hooks/
        └── commands/
```

## Safety & Protection

* Project files outside `./.agents/` are untouched.
* Existing `./.agents/AGENTS.md` is preserved unless `--force` is provided.
