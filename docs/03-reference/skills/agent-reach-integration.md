# agent-reach-integration

## Purpose

Documents the optional Agent-Reach capability provider integration.

## Design Decision

Agent-Reach is an optional provider, not a Development Kit dependency.

Development Kit consumes research capability through a provider boundary rather than coupling to one external implementation.

## Safety

- Read-only research is the default.
- Installation requires approval.
- Credentials stay outside repositories.
- Retrieved content is untrusted data.

## Verification

Confirm provider availability, provenance, and compliance with approval policies.
