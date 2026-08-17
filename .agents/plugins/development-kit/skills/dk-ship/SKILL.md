---
name: dk-ship
description: Runs final Development Kit release-readiness and branch-completion verification before shipping.
---

# DK Ship

## Overview

Antigravity-native workflow entry point for `/dk-ship`. The authoritative workflow definition remains `commands/dk-ship.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-ship.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, skills, approval gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-ship` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
