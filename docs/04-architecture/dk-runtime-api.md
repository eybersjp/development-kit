# DK Runtime API

> Status: Implemented in Development Kit v0.7.0.

## Purpose

The DK Runtime API is the internal boundary between DK Core / DK Intelligence and presentation surfaces such as DK Control Center. It exists so the browser UI, future IDE panels, and CLI controls can operate on one authoritative runtime without importing internal modules or maintaining separate state.

## Principles

1. Local-first and loopback-bound by default.
2. Versioned API namespace.
3. Read operations are the default surface.
4. Writes route through the same validation, policy, approval, locking, and staleness mechanisms as non-UI DK operations.
5. No UI-only bypass of DK Core.
6. No secret-bearing endpoint unless separately justified and security-reviewed.
7. Runtime responses distinguish current, stale, inferred, untrusted, unhealthy, and unavailable states.
8. The API is internal in v0.7. Public compatibility guarantees may be introduced later.

## Service Lifecycle

The service may be started lazily when required by Control Center or provider integrations, or eagerly during interactive DK activation where implementation benchmarks show negligible cost.

Default behaviour:

- bind to loopback only;
- select an available port automatically;
- expose runtime health through project-local runtime metadata;
- detect stale PID/endpoint metadata;
- prevent accidental duplicate runtime processes for the same project where practical;
- shut down cleanly when the owning environment exits, while tolerating browser sessions closing independently.

## Session Security

The browser must not gain privileged write access merely because it can reach localhost.

The implementation should use a runtime-generated session/capability token or equivalent local anti-forgery mechanism. The token must not be committed to the repository and should have runtime/session scope.

State-changing browser requests must be protected against cross-site request forgery and cross-origin abuse. CORS should be deny-by-default except for the expected local Control Center origin.

## Baseline Endpoint Families

Exact payload schemas may evolve during implementation, but v0.7 should preserve these functional boundaries.

### Runtime

```text
GET  /v1/status
GET  /v1/health
GET  /v1/project
```

Provides project identity, runtime version, service health, effective settings, and provider summaries.

### Workflow

```text
GET  /v1/workflow
GET  /v1/workflow/stages
GET  /v1/workflow/tasks
```

Any future transition/write route must delegate to the Autopilot transition and policy engines rather than mutating state files directly.

### Memory

```text
GET   /v1/memory
GET   /v1/memory/:id
POST  /v1/memory/query
PATCH /v1/memory/:id
POST  /v1/memory/:id/supersede
POST  /v1/memory/:id/archive
DELETE /v1/memory/:id
```

Memory writes validate schema, authority transitions, scope, provenance, and applicable confirmation requirements.

A PATCH operation cannot silently promote `inferred` or `imported-untrusted` content to `user-approved` without an explicit confirmation action that records the authority transition.

### Memory Candidates

```text
GET  /v1/memory-candidates
POST /v1/memory-candidates/:id/promote
POST /v1/memory-candidates/:id/reject
```

Material candidate promotion must preserve the original evidence/source and the approving actor/action.

### Decisions

```text
GET /v1/decisions
GET /v1/decisions/:id
```

Decision editing can reuse memory write operations but must preserve supersession history.

### Knowledge

```text
GET  /v1/knowledge
GET  /v1/knowledge/:id
POST /v1/knowledge/query
```

Management/ingestion endpoints may be added behind explicit provider capability and policy checks.

### Code Intelligence

```text
GET  /v1/code-intelligence/status
POST /v1/code-intelligence/search
POST /v1/code-intelligence/explore
POST /v1/code-intelligence/callers
POST /v1/code-intelligence/callees
POST /v1/code-intelligence/impact
```

These routes are capability-mediated. If the active provider does not support a requested operation, the API returns `unsupported` rather than fabricating a result.

### Skills and Agents

```text
GET /v1/skills
GET /v1/skills/:id
GET /v1/agents
GET /v1/agents/:id
```

Future loadout writes must preserve built-in policy constraints and cannot grant a capability prohibited by DK Core or the host environment.

### Verification

```text
GET /v1/verification
GET /v1/verification/:id
```

Verification records expose evidence and staleness, not merely pass/fail labels.

### Providers

```text
GET  /v1/providers
GET  /v1/providers/:id
POST /v1/providers/:id/activate
POST /v1/providers/:id/deactivate
POST /v1/providers/:id/health-check
```

Activation may only succeed for already-installed/configured providers when their capability class and runtime policy permit it. Missing provider installation is a separate SYSTEM-class action and is never implied by `activate`.

### Settings

```text
GET /v1/settings
PATCH /v1/settings
```

The Control Center auto-open setting must be represented explicitly, including scope and effective value.

Example conceptual shape:

```json
{
  "controlCenter": {
    "autoOpen": {
      "effective": false,
      "source": "default",
      "global": false,
      "project": null
    },
    "portMode": "automatic"
  }
}
```

## Error Model

Responses should distinguish at least:

- `invalid_request`
- `not_found`
- `conflict`
- `stale_state`
- `permission_required`
- `approval_required`
- `unsupported`
- `provider_unavailable`
- `provider_unhealthy`
- `corrupt_state`
- `internal_error`

Errors must not expose secrets or provider credentials.

## Concurrency and State Writes

All writes to Autopilot state, DK settings, or memory stores must use their authoritative locking/transaction mechanisms. The Runtime API must not invent a parallel persistence path.

Conflicting edits should fail closed with sufficient metadata to refresh/retry rather than using last-write-wins silently for authoritative records.

## Observability

The runtime should support local diagnostics sufficient to answer:

- which project/runtime is active;
- active endpoint/port;
- Control Center health;
- memory provider health;
- knowledge/code provider health;
- last indexing/extraction activity;
- current schema/runtime version;
- recoverable errors.

Sensitive content should not be logged by default.

## Acceptance Criteria

- Control Center can operate entirely through the Runtime API.
- Runtime API binds to loopback by default.
- Browser writes are protected against cross-origin/forgery abuse.
- UI operations reuse DK Core validation and approval controls.
- Provider absence returns explicit unavailable/unsupported states.
- API errors do not disclose credentials.
- Concurrent authoritative writes cannot silently corrupt DK state.
- Auto-open settings are readable and writable with clear global/project precedence.
