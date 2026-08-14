# Framework at a Glance

A quick-reference summary of **Development Kit** (`v0.6.1`):

| Aspect | Summary Metric / Value |
| :--- | :--- |
| **Framework Version** | `0.6.1` |
| **Node Requirement** | `>=18.0.0` |
| **Commands** | 14 commands (`/dk-autopilot`, `/dk-idea`, `/dk-research`, `/dk-spec`, `/dk-design`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, `/dk-status`) |
| **Agents** | 18 specialized roles (`development-conductor`, `repository-scout-agent`, `specification-agent`, `implementation-agent`, `code-reviewer`, `security-reviewer`, etc.) |
| **Skills** | 46 core skills across discovery, research, design, planning, implementation, verification, review, and shipping |
| **Hooks** | 4 execution hooks (`session-start.js`, `before-task.js`, `after-task.js`, `before-completion.js`) |
| **Templates** | 6 standardized document templates plus 5 platform adapter templates |
| **Supported Platforms** | Antigravity, OpenCode, Claude Code, Cursor, VS Code (Copilot), Cline, Windsurf |
| **Verification Tools** | `npm run release:validate`, `npm run validate`, `npm run doctor`, `npm run docs:validate` |
