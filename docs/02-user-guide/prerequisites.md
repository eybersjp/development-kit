# Prerequisites

Before installing Development Kit (`development-kit@0.6.1`), ensure your environment meets the following requirements:

## System & Software Requirements

* **Operating System**: Windows, macOS, or Linux.
* **Node.js**: Version `18.0.0` or higher (`node -v`).
* **npm**: Version `8.0.0` or higher (`npm -v`).
* **Git**: Version `2.20.0` or higher (`git --version`).

## Supported AI Agent Runtimes

1. **Antigravity AI Platform**:
   - Supports global configuration directory (`~/.gemini/config/` or `%USERPROFILE%\.gemini\config\`).
   - Supports project-local directory (`./.agents/`).
2. **OpenCode Environment**:
   - Supports project-local configuration directory (`./.opencode/skills/`).

## Local Development Requirements (For Framework Contributors)

If contributing to Development Kit itself, no external dependencies outside standard Node.js built-in modules (`node:fs`, `node:path`, `node:url`) are required.
