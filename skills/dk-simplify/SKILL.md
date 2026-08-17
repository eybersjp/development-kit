---
name: dk-simplify
description: Applies the Development Kit simplicity review after correctness and verification are established.
---

# DK Simplify

## Overview

Antigravity-native workflow entry point for `/dk-simplify`. The authoritative workflow definition remains `commands/dk-simplify.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-simplify.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, skills, gates, state, and output requirements.
3. Apply any user arguments or text supplied with `/dk-simplify` to that workflow.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report that the Development Kit installation is incomplete.
