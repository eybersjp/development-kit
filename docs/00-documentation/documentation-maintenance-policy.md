# Documentation Maintenance Policy

## Governance & Maintenance Rules

1. **Synchronisation Gate**: Any commit adding, deleting, or renaming a command, agent, skill, hook, template, or script MUST update the corresponding reference documentation page in `docs/03-reference/` simultaneously.
2. **Automated Validation**: CI pipelines and pre-release gates MUST run `npm run docs:validate`. No release may occur if `npm run docs:validate` fails.
3. **Source of Truth Enforcement**: Never edit generated plugin manifest paths in `.agents/plugins/` directly. Always run `node scripts/sync-plugin.mjs --fix`.
4. **Version Bump Alignment**: Whenever `package.json` version is updated, update the framework version metadata across doc landing pages.
