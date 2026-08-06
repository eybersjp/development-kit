# Framework at a Glance

A quick-reference summary of **Development Kit** (`v0.3.0`):

| Aspect | Summary Metric / Value |
| :--- | :--- |
| **Framework Version** | `0.3.0` |
| **Node Requirement** | `>=18.0.0` |
| **Commands** | 12 commands (`/dk-idea`, `/dk-spec`, `/dk-design`, `/dk-tasks`, `/dk-build`, `/dk-build-auto`, `/dk-test`, `/dk-review`, `/dk-simplify`, `/dk-debug`, `/dk-ship`, `/dk-status`) |
| **Agents** | 18 specialized roles (`development-conductor`, `repository-scout-agent`, `specification-agent`, `implementation-agent`, `code-reviewer`, `security-reviewer`, etc.) |
| **Skills** | 43 core skills across discovery, design, planning, implementation, review, and shipping |
| **Hooks** | 4 execution hooks (`session-start.js`, `before-task.js`, `after-task.js`, `before-completion.js`) |
| **Templates** | 6 standardized document templates (`feature-spec.md`, `technical-design.md`, `task-plan.md`, etc.) |
| **Supported Platforms** | Antigravity (`~/.gemini/config` or `.agents/`), OpenCode (`.opencode/skills/`), Standalone Project Root |
| **Verification Tools** | `npm run validate`, `npm run doctor`, `npm run docs:validate` |
