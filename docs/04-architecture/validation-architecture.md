# Validation Architecture

## Validation Layers

```mermaid
graph TD
    subgraph Content validation
        V1["npm run validate (validate-skills.mjs)"]
        V2["npm run doctor (sync-plugin.mjs --check)"]
        V3["npm run docs:validate (validate-docs.mjs)"]
    end
    subgraph CI
        C1["ci.yml: validate + doctor on push/PR"]
        C2["publish.yml: validate + doctor + tag check on v* tags"]
    end
    V1 --> C1
    V2 --> C1
    V1 --> C2
    V2 --> C2
    V3 -. "not yet wired into CI" .-> C1
```

## What Each Validator Checks

| Validator | Checks | Fails On |
| :--- | :--- | :--- |
| `validate-skills.mjs` | Skill frontmatter (`name`, `description`), recommended sections, agent/command structure, manifest reference resolution | Errors only (warnings allowed); exit 1 |
| `sync-plugin.mjs --check` | Manifest counts vs directories; missing entries | Never (reports drift, exits 0) |
| `validate-docs.mjs` | Reference-page coverage, link integrity, placeholders, `file://` protocol URLs, SUMMARY navigation | Errors only; exit 1 |

## CI Coverage

- `ci.yml`: runs on push/PR to `main` — `validate-skills.mjs` + `sync-plugin.mjs --check` on Node 22.
- `publish.yml`: same validations, then tag↔package version match, then `npm publish`.

## Gaps (documented)

- `docs:validate` is not wired into CI yet (see [Known Limitations](../11-appendices/known-limitations.md)).
- The doctor check does not fail CI even when it reports drift.

See [validation-reference.md](../07-testing-quality-security/validation-reference.md) and [validator-internals.md](../06-internals/validator-internals.md).
