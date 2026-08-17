---
name: dk-autopilot
description: Runs the complete Development Kit lifecycle through the automated guided workflow.
---

# DK Autopilot

## Overview

Antigravity-native workflow entry point for `/dk-autopilot`. The authoritative workflow definition remains `commands/dk-autopilot.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-autopilot.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, skills, gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-autopilot` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
