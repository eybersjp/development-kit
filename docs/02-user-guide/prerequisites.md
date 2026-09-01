# Prerequisites

Before installing Development Kit (`development-kit@0.9.0`), ensure your environment meets the following requirements:

## System & Software Requirements

* **Operating System**: Windows, macOS, or Linux.
* **Node.js**: Version `18.0.0` or higher (`node -v`).
* **npm**: Version `8.0.0` or higher (`npm -v`).
* **Git**: Version `2.20.0` or higher (`git --version`).

## Supported AI Agent Runtimes

1. **Antigravity AI Platform**:
   - Supports global configuration directory (`~/.gemini/config/` or `%USERPROFILE%\.gemini\config\`).
   - Supports project-local directory (`./.agents/`).
   - Discovers the 16 Development Kit `/dk-*` workflows through native skill adapters.
2. **OpenCode Environment**:
   - Supports project-local configuration directory (`./.opencode/skills/`).

## v0.9 Runtime Requirements

Project and standalone installations include the Development Kit orchestration runtime and schemas used for Development Contracts, source fingerprints, evidence/control manifests, execution-safety checks, deterministic acceptance, bounded correction, and persisted run state. These assets are installed by Development Kit; no separate database or orchestration service is required.

Hosts without native sub-agent support may use sequential fresh/rehydrated verifier contexts. Mandatory verification is not silently skipped when host capabilities are limited.

## Local Development Requirements (For Framework Contributors)

If contributing to Development Kit itself, no external runtime dependencies outside standard Node.js built-in modules are required.
