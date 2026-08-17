---
name: dk-status
description: Inspects the current Development Kit lifecycle stage, task, blockers, design authority, and recommended action.
---

# DK Status

## Overview

Antigravity-native workflow entry point for `/dk-status`. The authoritative workflow definition remains `commands/dk-status.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-status.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for inspection fields, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-status` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
