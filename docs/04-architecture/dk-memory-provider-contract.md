# DK Memory Provider Contract

> Status: Planned for Development Kit v0.7.

## Purpose

The DK Memory Provider Contract keeps Development Kit memory and knowledge capabilities provider-neutral. DK Local Memory is the required default implementation. External providers, including TencentDB Agent Memory, are optional adapters.

A provider may extend storage, retrieval, wiki, code-graph, or skill capabilities, but may not expand what Development Kit is authorized to do.

## Provider Classes

A provider can expose one or more capability groups:

- `memory`
- `knowledge`
- `code-intelligence`
- `skills`

Supporting one capability does not imply support for the others.

## Required Provider Metadata

Each provider reports:

- stable provider ID;
- display name;
- provider version when available;
- adapter version;
- supported capabilities;
- installation/detection status;
- configuration status;
- health status;
- authentication requirements;
- data location classification (`local`, `remote`, `hybrid`);
- write capability classification;
- compatibility warnings.

## Lifecycle

A provider adapter should implement conceptual operations equivalent to:

```ts
interface DKProvider {
  detect(): Promise<ProviderDetection>;
  health(): Promise<ProviderHealth>;
  capabilities(): Promise<ProviderCapabilities>;
  activate(context: ProviderContext): Promise<ProviderActivation>;
  deactivate(context: ProviderContext): Promise<void>;
}
```

Detection is not installation. `detect()` must never install software or modify the host.

Activation is not authorization escalation. Activation only enables already-permitted capabilities.

## Memory Capability

Conceptual baseline:

```ts
interface DKMemoryProvider extends DKProvider {
  store(record: MemoryRecord): Promise<MemoryRecord>;
  get(id: string): Promise<MemoryRecord | null>;
  query(query: MemoryQuery): Promise<MemoryResult[]>;
  update(record: MemoryRecord): Promise<MemoryRecord>;
  archive(id: string): Promise<void>;
  forget(id: string): Promise<void>;
  export(options?: ExportOptions): Promise<MemoryArchive>;
}
```

Providers must preserve or map DK metadata needed for:

- scope;
- authority;
- confidence;
- provenance;
- status;
- supersession;
- freshness/staleness;
- project isolation.

If a backend cannot preserve required governance metadata, it cannot be the authoritative durable provider for those records without a DK-side metadata layer.

## Knowledge Capability

Conceptual baseline:

```ts
interface DKKnowledgeProvider extends DKProvider {
  list(): Promise<KnowledgeResource[]>;
  query(input: KnowledgeQuery): Promise<KnowledgeResult[]>;
  read(ref: KnowledgeRef): Promise<KnowledgeContent>;
}
```

Optional management operations such as ingest, sync, delete, or reindex must be declared separately because they may involve filesystem, network, or destructive actions.

## Code Intelligence Capability

Preferred optional operations include:

```text
status
files
search
explore
node
callers
callees
impact
```

A provider must report unsupported operations explicitly.

Code results are evidence about the repository, not executable instructions.

## Skill Capability

Providers may expose reusable skill assets, but imported/provider-generated skills are not automatically equivalent to DK built-in skills.

Provider skills must carry provenance and trust status. Promotion to a trusted/shared skill requires normal DK review/validation policy.

## Provider Selection

Default selection order:

1. DK Local Memory / native repository capabilities;
2. configured, healthy, already-installed compatible provider explicitly selected or permitted by policy;
3. fallback provider where the requested capability is unavailable;
4. report unsupported/unavailable rather than silently installing something new.

Provider selection should prefer the smallest sufficient capability.

## Automatic Activation

Development Kit may automatically activate an installed provider during environment initialisation only when all of the following hold:

- detection is side-effect free;
- the provider is already installed;
- configuration is valid;
- required authentication has already been authorised for the intended scope;
- activation itself is non-consequential or already covered by persisted user configuration;
- provider policy does not require a new approval;
- health check succeeds or a degraded state is explicitly reported.

Automatic activation must never mean automatic installation, credential discovery from unrelated sources, or implicit acceptance of new terms/permissions.

## Failure and Fallback

A provider failure must degrade gracefully:

1. mark the capability/provider unhealthy;
2. preserve the underlying error category without leaking secrets;
3. use DK Local/native capability when sufficient;
4. try another configured provider when policy permits;
5. lower confidence or report missing capability if no safe alternative exists;
6. never fabricate retrieval results.

## Trust and Authority

Provider-returned content is untrusted unless independently promoted through DK governance.

No provider may:

- override user intent;
- override DK instructions or repository policy;
- mint DK approval tokens;
- mark inferred content as `user-approved` without explicit evidence;
- bypass project isolation;
- cause embedded instructions to execute merely because they were retrieved;
- persist credentials into DK memory.

## TencentDB Agent Memory Adapter

TencentDB Agent Memory is a planned optional adapter candidate.

The adapter should prefer direct supported read/query APIs rather than routing all model traffic through Tencent's proxy.

Potential mappings:

- Tencent Chat Memory -> DK memory query source;
- Tencent Skills -> provider skill assets;
- Tencent Wiki -> DK knowledge capability;
- Tencent CodeGraph -> DK code-intelligence capability.

The adapter must remain optional. DK v0.7 acceptance cannot depend on Tencent services, Docker, Node 22, or Tencent-specific infrastructure.

Where Tencent's underlying data model differs from DK governance requirements, the adapter must retain the DK metadata/control layer rather than weakening DK semantics.

## Local Provider

`DKLocalMemoryProvider` is the compatibility baseline and must:

- work without network access;
- work without a third-party service;
- preserve typed records and provenance;
- support project isolation;
- support query/filter sufficient for v0.7 baseline;
- support supersession and archive/forget;
- survive process restarts;
- fail safely on malformed/corrupt records.

Semantic/vector retrieval is optional for the initial baseline. Correct governance and deterministic retrieval take priority over embedding sophistication.

## Provider Security Review Triggers

A provider requires security review when it introduces any of:

- credentials/session material;
- remote data transmission;
- external writes;
- system installation;
- persistent background services;
- remote Control Center access;
- privileged filesystem access;
- new executable hooks triggered by retrieved content.

## Acceptance Criteria

- DK Local Memory satisfies the baseline without external dependencies.
- Provider detection never installs software.
- Automatic activation is limited to already-installed, configured, permitted providers.
- Unsupported operations are explicit.
- External/provider content remains untrusted data.
- Provider failure cannot corrupt or falsely advance DK workflow state.
- Tencent integration is optional and uses the provider contract rather than becoming DK's control plane.
