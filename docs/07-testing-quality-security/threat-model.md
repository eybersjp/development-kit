# Threat Model

This document outlines the security architecture, trust boundaries, and threat analysis for the Development Kit framework.

## Trust Boundaries

1. **User Input / Shell Execution**: User invoking CLI commands (`npx development-kit`).
2. **AI Agent Code Execution**: AI agents generating code, writing files, and invoking commands on the host OS.
3. **Plugin Installation & Synchronization**: Copying files between canonical repository locations and user target environments.
4. **External Source / Provider Boundary**: Optional providers and connected tools returning content from external systems into the agent context.
5. **Credential / Session Boundary**: Optional authenticated providers using tokens, browser sessions, cookies, or equivalent identity material.
6. **External Write Boundary**: Provider actions capable of creating, modifying, posting, uploading, deleting, or otherwise changing external state.

## Primary Threat Vectors & Mitigations

### 1. Arbitrary Command Execution
- **Threat**: Untrusted LLM output or retrieved content injecting dangerous shell commands.
- **Mitigation**: Installer safety rules, strict parameter verification, explicit user approval gates for consequential modifications, and the invariant that retrieved external content is data rather than executable instruction.

### 2. Credential Exposure
- **Threat**: Accidental inclusion of API keys, browser cookies, access tokens, session material, or other secrets in generated files, logs, research artifacts, or commits.
- **Mitigation**: Never commit provider credentials/session material; authenticated provider access requires permission; release process includes secrets scanning and GitHub secret isolation.

### 3. File System Overwrite / Path Traversal
- **Threat**: Malicious or buggy script paths targeting system directories outside project context.
- **Mitigation**: Absolute path resolution restricted to workspace boundaries and explicit overwrite guards in installers.

### 4. Indirect Prompt Injection
- **Threat**: A web page, README, issue body, comment, social post, transcript, document, or provider response contains instructions intended to override the agent's task or cause tool execution.
- **Mitigation**: `AGENTS.md`, `/dk-research`, `external-research`, Autopilot, and the conductor explicitly classify external content as untrusted data. External content cannot override Development Kit rules, approvals, repository policy, or user intent and cannot authorize command execution merely by requesting it.

### 5. Provider Supply-Chain Compromise
- **Threat**: Installing a mutable or compromised provider package/script changes host behavior or exposes credentials.
- **Mitigation**: Optional providers are never silently installed. Installation and system configuration are approval-gated. Prefer pinned tagged releases or commits rather than mutable `main.zip` style installation paths. Agent-Reach remains an optional adapter rather than a package dependency of Development Kit.

### 6. Authenticated Session Abuse
- **Threat**: A provider reuses browser authentication, cookies, or tokens to access more data than the user intended, or exposes an account to provider/tool compromise.
- **Mitigation**: Authenticated reads require permission; session material is treated as sensitive; use least-privilege/secondary accounts where appropriate; do not place session material in research artifacts or commits.

### 7. Unintended External Writes
- **Threat**: Research tooling posts, uploads, edits, comments, follows, deletes, or otherwise modifies external state while the user expects a read-only operation.
- **Mitigation**: Read is the default capability class. All provider writes require the normal Development Kit approval gate. Destructive actions require explicit approval and applicable safeguards.

### 8. Research Provenance Loss or Evidence Confusion
- **Threat**: Findings are later treated as facts without traceability, conflicting sources are flattened, or stale evidence is mixed with current evidence.
- **Mitigation**: `/dk-research` records or recommends provenance artifacts under `.dk/research/`, including source identity, provider/retrieval context, timing when available, material findings, and uncertainty. Conflicts remain visible.

### 9. Provider Availability or Compatibility Failure
- **Threat**: Optional provider failure blocks the lifecycle or encourages fabricated evidence.
- **Mitigation**: Provider integrations degrade gracefully. Try an approved native/connected alternative, report unavailable capability and confidence impact, never fabricate evidence, and do not silently install replacement tooling.

## Security Review Trigger

The `security-review` skill should be activated when work involves any of the following:

- Provider credentials, browser cookies, tokens, or account/session material.
- External writes or destructive provider actions.
- Provider installation or host configuration.
- Research content that materially influenced a security-sensitive design or release decision.
- New external capability provider implementations.

## Related Documentation

- [Security Review](security-review.md)
- [Security & Trust Boundaries](../04-architecture/security-trust-boundaries.md)
- [External Capability Providers](../04-architecture/external-capability-providers.md)
- [dk-research](../03-reference/commands/dk-research.md)
- [external-research](../03-reference/skills/external-research.md)
- [agent-reach-integration](../03-reference/skills/agent-reach-integration.md)
