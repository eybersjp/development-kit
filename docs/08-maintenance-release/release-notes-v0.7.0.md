# Development Kit v0.7.0 Release Notes

## Overview

Development Kit `v0.7.0` is a major milestone release introducing **DK Intelligence** (durable local-first engineering memory, provenance, and lifecycle-aware context assembly) and **DK Control Center** (an integrated local browser management interface and secure loopback Runtime API).

> [!NOTE]
> **Status:** Release-ready. Publication pending release tag approval.

---

## What's New

### DK Intelligence
- **Persistent Local Engineering Memory:** Records facts, architectural decisions, constraints, lessons, and incidents locally in `.development-kit/intelligence/memory/`.
- **Strict Authority & Trust Model:** Explicit authority tiers (`user-approved`, `repository-verified`, `system-verified`, `inferred`, `imported-untrusted`) prevent unauthorized self-promotion.
- **Provenance & Staleness Fingerprinting:** Computes SHA-256 hashes of source files to identify and invalidate stale memory records automatically.
- **Decision Supersession Chains:** Preserves complete historical lineages when technical decisions evolve over time.
- **Lifecycle-Aware Context Assembly:** Assembles token-budgeted memory summaries customized to the active Autopilot lifecycle stage.
- **Candidate Extraction & Secrets Filtering:** Extracts candidates from high-signal workflows (`/dk-design`, `/dk-debug`, `/dk-review`, `/dk-ship`) while strictly stripping API keys, tokens, and passwords.

### DK Control Center
- **Integrated Local Management Surface:** Lightweight zero-dependency HTML/CSS/JS interface served on loopback (`127.0.0.1`).
- **Unified Views:** Overview, 9-stage Autopilot Workflow, Memory Register, Architectural Decisions, Provider Health, and Settings.
- **Configurable Auto-Open Engine:** Automatic browser opening defaults to `Off`, with project-over-global precedence and complete launch suppression in CI/headless/test environments.

### Secure Local Runtime API
- **Local Loopback Endpoint:** Binds strictly to `127.0.0.1` with auto-allocated ports.
- **Session Capability Protection:** Governed write operations require `X-DK-Session-Token` headers and enforce anti-CSRF / origin validation.

### Agent Loadouts & Skill Governance
- **Role-Scoped Loadouts:** Enforces memory scope partitions (USER, PROJECT, WORKSPACE) and bindings per specialist agent role.
- **Skill Governance:** Extracted or third-party provider skill candidates require explicit user confirmation before being executed as trusted procedures.

### Import, Export & Recovery
- **Portable Memory Bundles:** Export and import project memory with default `imported-untrusted` classification.
- **Corrupt File Isolation:** Automatically detects and isolates corrupt memory files without crashing the provider.

### Knowledge & Code Intelligence
- **Native Filesystem Providers:** Lightweight Markdown document search and symbol discovery without external services.
- **Optional TencentDB Agent Memory Adapter:** Optional adapter for remote memory services with graceful degradation when unconfigured.

---

## Security and Trust Model

1. **Memory is Informational Only:** Memory records never authorize consequential actions or bypass mandatory Autopilot approval tokens.
2. **Deterministic Project Isolation:** Cross-project records are strictly filtered out before retrieval or context assembly.
3. **No Credential Persistence:** Secrets and tokens are filtered prior to candidate creation or storage.

---

## Installation

### Antigravity Global / Project
```bash
npx development-kit@0.7.0 init
```

### OpenCode Integration
```bash
npx development-kit@0.7.0 init --opencode
```

### Multi-Platform Adapters
```bash
npx development-kit@0.7.0 init --all-platforms
```

### Upgrade Existing Project
```bash
npx development-kit@0.7.0 init --force
```

---

## Compatibility

- **Node.js:** `>=18`
- **Supported Hosts:** Antigravity, OpenCode, Claude Code, Cursor, VS Code (GitHub Copilot), Cline, Windsurf, Standalone.

---

## Verification Evidence

- **91 Intelligence Tests:** Passing (0 failures)
- **Release Validation (`release:validate`):** Passing
- **Package Distribution (`npm pack --dry-run`):** Verified (all 4 runtime directories bundled)

---

## Rollback Guidance

For rollback, install the previous stable release:
```bash
npx development-kit@0.6.1 init --force
```
