---
name: dk-control
description: Launches and governs the local Development Kit Control Center workflow.
---

# DK Control

## Overview

Antigravity-native workflow entry point for `/dk-control`. The authoritative workflow definition remains `commands/dk-control.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-control.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, skills, gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-control` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
