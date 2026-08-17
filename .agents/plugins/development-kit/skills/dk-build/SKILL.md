---
name: dk-build
description: Implements the next approved Development Kit task through the required implementation and verification gates.
---

# DK Build

## Overview

Antigravity-native workflow entry point for `/dk-build`. The authoritative workflow definition remains `commands/dk-build.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-build.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, skills, gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-build` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
