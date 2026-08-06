# Terminology & Concepts

Core terms used across the Development Kit framework:

* **Conductor (`development-conductor`)**: The orchestrating agent responsible for advancing the lifecycle, packing context, and enforcing completion gates.
* **Canonical Source**: The authoritative source files located in root directories (`skills/`, `agents/`, `commands/`, `hooks/`).
* **Plugin Mirror**: The plugin manifest and synced references in `.agents/plugins/development-kit/`.
* **Fresh Sub-agent**: A newly spawned sub-agent initialized with clean context specifically for a single task, preventing context bloat and assumption drift.
* **Context Packing**: The process of assembling only the necessary source files, specs, and interfaces needed for a task into a lightweight sub-agent prompt.
* **Ponytail Simplicity Ladder**: An 8-step evaluation framework prioritizing standard libraries and existing code over new code abstractions and external dependencies.
* **Two-Stage Review**: A sequential code review process where Specification Compliance is verified first before Code Quality review begins.
* **Doctor (`npm run doctor`)**: The integrity verification command (`node scripts/sync-plugin.mjs --check`) that detects drift between canonical files and plugin manifests.
