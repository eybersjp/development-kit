# Release Notes: Development Kit v0.7.1

**Release Date:** 2026-08-15  
**Release Type:** Corrective Patch Release  
**Target Package:** `development-kit@0.7.1`  

---

## Executive Summary

Development Kit `v0.7.1` is a corrective patch release addressing two critical human acceptance defects observed during public testing of `development-kit@0.7.0`:

1. **Project-Local State Bootstrapping Defect (Fix)**: Resolved the condition where visible lifecycle interactions progressed in chat sessions without establishing persistent project runtime state. Introduced deterministic project bootstrap runtime logic (`runtime/bootstrap/project-bootstrap.mjs`) and CLI script (`scripts/bootstrap.mjs`) ensuring `.development-kit/` state (identity, workspace ID, settings, memory, and autopilot) is established on first interaction or explicitly initialized.
2. **Control Center User Launch Path Defect (Fix)**: Provided a canonical, user-facing `/dk-control` command (`commands/dk-control.md`) and runtime CLI adapter (`scripts/control-center.mjs`), ensuring users can easily launch the local Control Center UI in offline mode while maintaining the secure `autoOpen: false` default setting.

---

## Detailed Changes

### 1. Runtime Project State Bootstrap
- **`runtime/bootstrap/project-bootstrap.mjs`**: Implemented `bootstrapProject(rootDir)` and `getProjectBootstrapStatus(rootDir)`. Automatically creates and verifies:
  - `.development-kit/project.json`
  - `.development-kit/workspace-id`
  - `.development-kit/settings.json`
  - `.development-kit/autopilot/state/`
  - `.development-kit/intelligence/memory/`
- **`scripts/bootstrap.mjs`**: Standalone CLI runner with idempotent execution and status inspection.

### 2. Control Center Canonical Launch Path
- **`commands/dk-control.md`**: Canonical command prompt definition for `/dk-control`.
- **`scripts/control-center.mjs`**: CLI runner supporting `--no-browser` and custom `--port`.
- Registered `/dk-control` in `runtime/next-step/command-registry.mjs` and updated conductor routing.

### 3. Installer & Platform Integration
- Added `/dk-control` to `scripts/install-antigravity.mjs` command display and mirror synchronizer.
- Registered `/dk-control` across all platform adapter templates: Claude Code (`CLAUDE.md`), Cursor (`.cursor/rules/dkf.mdc`), VS Code (`.github/copilot-instructions.md`), Cline (`.clinerules/dkf.md`), and Windsurf (`.windsurf/rules/dkf.md`).

### 4. Regression & Verification Suite
- Implemented `scripts/v071-regression.test.mjs` covering Tests A through M.
- Verified zero memory leak between isolated projects.
- Confirmed memory records cannot bypass human approval gates for `/dk-ship` or consequential actions.
