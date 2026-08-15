---
name: dk-control
description: >-
  Launch the Development Kit Control Center web interface for inspecting workflow state,
  project memory, settings, and runtime health.
---

# /dk-control

## Purpose

Launches the project-scoped Development Kit Control Center web interface. Provides a local, offline visual interface to inspect active lifecycle state, review memory records and architectural decisions, verify runtime health, and manage settings.

## Workflow

### 1. Ensure Project Bootstrap
Ensures the project runtime state is initialized under `.development-kit/`.

### 2. Launch Control Center Service
Starts the local loopback Control Center service (`http://127.0.0.1:<port>/`) powered by the governing `RuntimeApiService` and `ControlCenterService`.

### 3. Open Web Interface
Opens the Control Center in the default web browser (or provides the local URL and session capability token).

## Skills Activated

Primary:
- `skill-routing` — Maps control center launch to runtime service

Supporting:
- `using-development-kit` — Methodology context and safety boundaries

## Sub-Agents

None. This command operates directly through the local runtime service.

## Output

```
Development Kit Control Center is running at: http://127.0.0.1:<port>/
- Runtime API: http://127.0.0.1:<port>/
- Project Identity: [projectId]
- Intelligence Provider: [provider]
- Active Memories: [count]
```
