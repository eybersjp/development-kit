---
name: dk-test
description: Runs targeted Development Kit functional, regression, runtime, edge-case, and design-system verification.
---

# DK Test

## Overview

Antigravity-native workflow entry point for `/dk-test`. The authoritative workflow definition remains `commands/dk-test.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-test.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for verification scope, skills, gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-test` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
