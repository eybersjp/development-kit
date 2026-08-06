# Glossary

Definitions of core terms and concepts used across the Development Kit framework documentation.

## Core Terminology

### Always-On Rules
Non-negotiable engineering constraints loaded at session start from `AGENTS.md` and enforced continuously.

### Canonical Source
The authoritative source-of-truth files located in root directories (`skills/`, `agents/`, `commands/`, `hooks/`, `templates/`).

### Development Conductor
The primary orchestrator agent that coordinates the development lifecycle and enforces gate transitions.

### Fresh Sub-Agent Isolation
The practice of spawning a clean, independent sub-agent for each implementation task to prevent assumption drift.

### Plugin Mirror
The generated plugin bundle located at `.agents/plugins/development-kit/` synchronized from canonical source files.

### Ponytail Simplicity Ladder
An 8-step decision ladder evaluated before introducing any new code, abstraction, or dependency.

### Task Loop
The mandatory sequence executed for every implementation task: Scout → Readiness → Implementation → Verification → Spec Review → Code Review → Simplicity Review.

## Related Documentation

- [Terminology & Concepts](../01-overview/terminology-and-concepts.md)
- [Framework at a Glance](../01-overview/framework-at-a-glance.md)
