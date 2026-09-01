# Framework at a Glance

A quick-reference summary of **Development Kit** (`v0.9.0`):

| Aspect | Summary Metric / Value |
| :--- | :--- |
| **Framework Version** | `0.9.0` |
| **Node Requirement** | `>=18.0.0` |
| **Commands** | 16 commands (`/dk-autopilot`, `/dk-idea`, `/dk-research`, `/dk-spec`, `/dk-design`, `/dk-design-system`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, `/dk-control`, `/dk-status`) |
| **Agents** | 18 specialized roles (`development-conductor`, `repository-scout-agent`, `specification-agent`, `implementation-agent`, `code-reviewer`, `security-reviewer`, etc.) |
| **Skills** | 47 core engineering skills plus 16 Antigravity-native workflow-entry skill adapters |
| **Hooks** | 4 execution hooks (`session-start.js`, `before-task.js`, `after-task.js`, `before-completion.js`) |
| **Templates** | 7 standardized document templates plus 5 platform adapter templates |
| **Supported Platforms** | Antigravity, OpenCode, Claude Code, Cursor, VS Code (Copilot), Cline, Windsurf |
| **Reliability Control Plane** | Development Contracts, source fingerprints, independent verification, deterministic acceptance, bounded correction, structured reviews, execution safety, PLAN validation, canonical amendment reconciliation |
| **Verification Tools** | `npm run release:validate`, `npm run validate`, `npm run doctor`, `npm run docs:validate`, `npm run v09-reliability:validate` |
