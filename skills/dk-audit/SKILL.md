---
name: dk-audit
description: Run an independent read-only engineering and release assurance audit with traceable evidence.
---

# DK Audit

## Overview

Antigravity-native workflow entry point for `/dk-audit`. The authoritative
workflow definition remains `commands/dk-audit.md`.

## Process

1. Before taking workflow action, read `../../commands/dk-audit.md` relative to this `SKILL.md`.
2. Treat that command document as the single authoritative workflow specification for routing, evidence, authority boundaries and output.
3. Apply any user scope arguments to that workflow; default to read-only complete audit.
4. Do not duplicate or reinterpret the workflow in this adapter.
5. If the authoritative command document cannot be read, stop and report an incomplete Development Kit installation.
